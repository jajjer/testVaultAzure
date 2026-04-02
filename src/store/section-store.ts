import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { ensureDefaultSuite } from "@/lib/ensure-default-suite";
import { getFirestoreDb } from "@/lib/firebase";
import { DEFAULT_SECTION_ID, DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";
import type { SectionDoc } from "@/types/models";

interface SectionState {
  sections: SectionDoc[];
  loading: boolean;
  listen: (projectId: string) => Unsubscribe;
  stop: () => void;
  createFolder: (
    projectId: string,
    name: string,
    parentSectionId?: string | null
  ) => Promise<string>;
  renameFolder: (projectId: string, sectionId: string, name: string) => Promise<void>;
  deleteFolder: (projectId: string, sectionId: string) => Promise<void>;
}

let activeUnsub: Unsubscribe | null = null;
let lastListenProjectId: string | null = null;

function normalizeSection(
  id: string,
  data: Record<string, unknown>
): SectionDoc {
  const d = data as Partial<SectionDoc>;
  const parent = d.parentSectionId;
  return {
    id,
    projectId: String(d.projectId ?? ""),
    suiteId: String(d.suiteId ?? DEFAULT_SUITE_ID),
    parentSectionId:
      parent === null || parent === undefined ? null : String(parent),
    name: String(d.name ?? ""),
    order: typeof d.order === "number" ? d.order : 0,
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
  };
}

export const useSectionStore = create<SectionState>((set, get) => ({
  sections: [],
  loading: true,

  listen: (projectId: string) => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }

    if (lastListenProjectId !== projectId) {
      set({ sections: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const db = getFirestoreDb();
    const q = query(
      collection(
        db,
        "projects",
        projectId,
        "suites",
        DEFAULT_SUITE_ID,
        "sections"
      ),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const sections: SectionDoc[] = snap.docs.map((d) =>
          normalizeSection(d.id, d.data())
        );
        set({ sections, loading: false });
      },
      (err) => {
        console.error("[Railyard] sections listener:", err);
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
    set({ sections: [], loading: true });
  },

  createFolder: async (projectId, name, parentSectionId = null) => {
    const db = getFirestoreDb();
    await ensureDefaultSuite(projectId);
    const now = Date.now();
    const existing = get().sections;
    const parent = parentSectionId ?? null;
    const siblings = existing.filter(
      (s) => (s.parentSectionId ?? null) === parent
    );
    const nextOrder =
      siblings.length === 0
        ? 0
        : Math.max(...siblings.map((s) => s.order)) + 1;

    const ref = await addDoc(
      collection(
        db,
        "projects",
        projectId,
        "suites",
        DEFAULT_SUITE_ID,
        "sections"
      ),
      {
        projectId,
        suiteId: DEFAULT_SUITE_ID,
        parentSectionId: parent,
        name: name.trim(),
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      }
    );
    return ref.id;
  },

  renameFolder: async (projectId, sectionId, name) => {
    const now = Date.now();
    await updateDoc(
      doc(
        getFirestoreDb(),
        "projects",
        projectId,
        "suites",
        DEFAULT_SUITE_ID,
        "sections",
        sectionId
      ),
      { name: name.trim(), updatedAt: now }
    );
  },

  deleteFolder: async (projectId, sectionId) => {
    const db = getFirestoreDb();
    const now = Date.now();
    const sectionRef = doc(
      db,
      "projects",
      projectId,
      "suites",
      DEFAULT_SUITE_ID,
      "sections",
      sectionId
    );
    const selfSnap = await getDoc(sectionRef);
    if (!selfSnap.exists()) return;
    const parentId =
      (selfSnap.data() as { parentSectionId?: string | null })
        .parentSectionId ?? null;

    const childSectionsSnap = await getDocs(
      query(
        collection(
          db,
          "projects",
          projectId,
          "suites",
          DEFAULT_SUITE_ID,
          "sections"
        ),
        where("parentSectionId", "==", sectionId)
      )
    );

    const casesSnap = await getDocs(
      query(
        collection(db, "projects", projectId, "testcases"),
        where("sectionId", "==", sectionId)
      )
    );

    const CHUNK = 400;

    // Reparent direct child folders to this folder's parent
    const childSectionDocs = childSectionsSnap.docs;
    for (let i = 0; i < childSectionDocs.length; i += CHUNK) {
      const slice = childSectionDocs.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((d) => {
        batch.update(d.ref, {
          parentSectionId: parentId,
          updatedAt: now,
        });
      });
      await batch.commit();
    }

    const docs = casesSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((d) => {
        batch.update(d.ref, {
          sectionId: DEFAULT_SECTION_ID,
          updatedAt: now,
        });
      });
      await batch.commit();
    }

    await deleteDoc(sectionRef);
  },
}));
