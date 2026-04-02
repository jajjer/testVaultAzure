import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirestoreDb } from "@/lib/firebase";
import {
  DEFAULT_SECTION_ID,
  DEFAULT_SUITE_ID,
} from "@/lib/test-case-defaults";
import type { TestCaseDoc, TestCaseStep } from "@/types/models";

interface TestCaseState {
  cases: TestCaseDoc[];
  loading: boolean;
  listen: (projectId: string) => Unsubscribe;
  stop: () => void;
  createTestCase: (
    projectId: string,
    input: {
      title: string;
      preconditions: string;
      steps: TestCaseStep[];
      priority: TestCaseDoc["priority"];
      type: TestCaseDoc["type"];
      status: TestCaseDoc["status"];
      customFields: TestCaseDoc["customFields"];
      sectionId: string;
      createdBy: string;
    }
  ) => Promise<string>;
  updateTestCase: (
    projectId: string,
    caseId: string,
    input: {
      title: string;
      preconditions: string;
      steps: TestCaseStep[];
      priority: TestCaseDoc["priority"];
      type: TestCaseDoc["type"];
      status: TestCaseDoc["status"];
      customFields: TestCaseDoc["customFields"];
      sectionId: string;
      order: number;
    }
  ) => Promise<void>;
  deleteTestCase: (projectId: string, caseId: string) => Promise<void>;
  /** Move case to a folder (or default bucket for “no folder”). */
  moveTestCaseToFolder: (
    projectId: string,
    caseId: string,
    sectionId: string
  ) => Promise<void>;
}

let activeUnsub: Unsubscribe | null = null;
let lastListenProjectId: string | null = null;

function normalizeCase(
  id: string,
  data: Record<string, unknown>
): TestCaseDoc {
  const d = data as Partial<TestCaseDoc>;
  return {
    id,
    projectId: String(d.projectId ?? ""),
    caseNumber:
      typeof d.caseNumber === "number" && d.caseNumber >= 1 ? d.caseNumber : 0,
    suiteId: String(d.suiteId ?? DEFAULT_SUITE_ID),
    sectionId: String(d.sectionId ?? DEFAULT_SECTION_ID),
    title: String(d.title ?? ""),
    preconditions: String(d.preconditions ?? ""),
    steps: Array.isArray(d.steps) ? (d.steps as TestCaseStep[]) : [],
    priority: (d.priority ?? "medium") as TestCaseDoc["priority"],
    type: (d.type ?? "functional") as TestCaseDoc["type"],
    status: (d.status ?? "draft") as TestCaseDoc["status"],
    customFields:
      d.customFields && typeof d.customFields === "object"
        ? (d.customFields as TestCaseDoc["customFields"])
        : {},
    order: typeof d.order === "number" ? d.order : 0,
    createdBy: String(d.createdBy ?? ""),
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
  };
}

export const useTestCaseStore = create<TestCaseState>((set, get) => ({
  cases: [],
  loading: true,

  listen: (projectId: string) => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    if (lastListenProjectId !== projectId) {
      set({ cases: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const q = query(
      collection(getFirestoreDb(), "projects", projectId, "testcases"),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const cases: TestCaseDoc[] = snap.docs.map((d) =>
          normalizeCase(d.id, d.data())
        );
        set({ cases, loading: false });
      },
      (err) => {
        console.error("[Railyard] test cases listener:", err);
        set({ loading: false });
      }
    );
    activeUnsub = unsub;
    return unsub;
  },

  stop: () => {
    lastListenProjectId = null;
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    set({ cases: [], loading: true });
  },

  createTestCase: async (projectId, input) => {
    const db = getFirestoreDb();
    const now = Date.now();
    const existing = get().cases;
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((c) => c.order)) + 1;

    const newCaseRef = doc(
      collection(db, "projects", projectId, "testcases")
    );

    await runTransaction(db, async (transaction) => {
      const projectRef = doc(db, "projects", projectId);
      const projectSnap = await transaction.get(projectRef);
      if (!projectSnap.exists()) {
        throw new Error("Project not found");
      }
      const pdata = projectSnap.data();
      const nextNum =
        typeof pdata.nextCaseNumber === "number" && pdata.nextCaseNumber >= 1
          ? pdata.nextCaseNumber
          : 1;

      transaction.set(newCaseRef, {
        projectId,
        caseNumber: nextNum,
        suiteId: DEFAULT_SUITE_ID,
        sectionId: input.sectionId,
        title: input.title,
        preconditions: input.preconditions,
        steps: input.steps,
        priority: input.priority,
        type: input.type,
        status: input.status,
        customFields: input.customFields,
        order: nextOrder,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      });

      transaction.update(projectRef, {
        nextCaseNumber: nextNum + 1,
        updatedAt: now,
      });
    });

    return newCaseRef.id;
  },

  updateTestCase: async (projectId, caseId, input) => {
    const now = Date.now();
    await updateDoc(
      doc(getFirestoreDb(), "projects", projectId, "testcases", caseId),
      {
        title: input.title,
        preconditions: input.preconditions,
        steps: input.steps,
        priority: input.priority,
        type: input.type,
        status: input.status,
        customFields: input.customFields,
        sectionId: input.sectionId,
        order: input.order,
        updatedAt: now,
      }
    );
  },

  deleteTestCase: async (projectId, caseId) => {
    await deleteDoc(
      doc(getFirestoreDb(), "projects", projectId, "testcases", caseId)
    );
  },

  moveTestCaseToFolder: async (projectId, caseId, sectionId) => {
    const now = Date.now();
    await updateDoc(
      doc(getFirestoreDb(), "projects", projectId, "testcases", caseId),
      { sectionId, updatedAt: now }
    );
  },
}));
