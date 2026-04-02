import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirestoreDb } from "@/lib/firebase";
import { DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";
import type { RunStatus, TestRunDoc } from "@/types/models";

interface TestRunState {
  runs: TestRunDoc[];
  loading: boolean;
  listen: (projectId: string) => Unsubscribe;
  stop: () => void;
  createRun: (
    projectId: string,
    input: {
      name: string;
      caseIds: string[];
      createdBy: string;
    }
  ) => Promise<string>;
  deleteRun: (projectId: string, runId: string) => Promise<void>;
  updateRun: (
    projectId: string,
    runId: string,
    input: {
      name: string;
      caseIds: string[];
      status: RunStatus;
    }
  ) => Promise<void>;
}

let activeUnsub: Unsubscribe | null = null;
let lastListenProjectId: string | null = null;

function normalizeRun(id: string, data: Record<string, unknown>): TestRunDoc {
  const d = data as Partial<TestRunDoc>;
  const completedAt = d.completedAt;
  return {
    id,
    projectId: String(d.projectId ?? ""),
    name: String(d.name ?? ""),
    suiteId: String(d.suiteId ?? DEFAULT_SUITE_ID),
    caseIds: Array.isArray(d.caseIds) ? (d.caseIds as string[]) : [],
    status: (d.status ?? "active") as TestRunDoc["status"],
    createdBy: String(d.createdBy ?? ""),
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
    completedAt:
      completedAt === null
        ? null
        : typeof completedAt === "number"
          ? completedAt
          : null,
  };
}

export const useTestRunStore = create<TestRunState>((set) => ({
  runs: [],
  loading: true,

  listen: (projectId: string) => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    if (lastListenProjectId !== projectId) {
      set({ runs: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const q = query(
      collection(getFirestoreDb(), "projects", projectId, "runs"),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const runs: TestRunDoc[] = snap.docs.map((d) =>
          normalizeRun(d.id, d.data())
        );
        set({ runs, loading: false });
      },
      (err) => {
        console.error("[Railyard] test runs listener:", err);
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
    set({ runs: [], loading: true });
  },

  createRun: async (projectId, input) => {
    const db = getFirestoreDb();
    const now = Date.now();
    const ref = await addDoc(
      collection(db, "projects", projectId, "runs"),
      {
        projectId,
        name: input.name,
        suiteId: DEFAULT_SUITE_ID,
        caseIds: input.caseIds,
        status: "active",
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }
    );
    return ref.id;
  },

  deleteRun: async (projectId, runId) => {
    const db = getFirestoreDb();
    const resultsSnap = await getDocs(
      collection(db, "projects", projectId, "runs", runId, "results")
    );
    const batch = writeBatch(db);
    resultsSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "projects", projectId, "runs", runId));
    await batch.commit();
  },

  updateRun: async (projectId, runId, input) => {
    const db = getFirestoreDb();
    const now = Date.now();
    const runRef = doc(db, "projects", projectId, "runs", runId);
    const snap = await getDoc(runRef);
    if (!snap.exists()) {
      throw new Error("Test run not found");
    }
    const prev = snap.data() as {
      caseIds?: unknown;
      completedAt?: unknown;
    };
    const prevIds: string[] = Array.isArray(prev.caseIds)
      ? (prev.caseIds as string[])
      : [];
    const newIds = input.caseIds;
    const removed = prevIds.filter((id) => !newIds.includes(id));

    const prevCompleted = prev.completedAt;
    let completedAt: number | null =
      prevCompleted === null || prevCompleted === undefined
        ? null
        : typeof prevCompleted === "number"
          ? prevCompleted
          : null;
    if (input.status === "completed") {
      if (completedAt == null) completedAt = now;
    } else {
      completedAt = null;
    }

    const CHUNK = 400;
    for (let i = 0; i < removed.length; i += CHUNK) {
      const slice = removed.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((caseId) => {
        batch.delete(
          doc(
            db,
            "projects",
            projectId,
            "runs",
            runId,
            "results",
            caseId
          )
        );
      });
      await batch.commit();
    }

    await updateDoc(runRef, {
      name: input.name.trim(),
      caseIds: newIds,
      status: input.status,
      updatedAt: now,
      completedAt,
    });
  },
}));
