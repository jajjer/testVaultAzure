import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirestoreDb } from "@/lib/firebase";
import type {
  ProjectDoc,
  ProjectMember,
  ProjectParameter,
} from "@/types/models";

interface ProjectState {
  projects: ProjectDoc[];
  loading: boolean;
  /** Set when the Firestore listener fails (e.g. permission or rules/query mismatch). */
  error: string | null;
  listen: (uid: string) => Unsubscribe;
  stop: () => void;
  createProject: (input: {
    name: string;
    description: string;
    owner: {
      uid: string;
      email: string;
      role: ProjectMember["role"];
    };
  }) => Promise<string>;
  updateProject: (
    projectId: string,
    updates: {
      name: string;
      description: string;
      parameters: ProjectParameter[];
    }
  ) => Promise<void>;
}

let activeUnsub: Unsubscribe | null = null;
/** Avoid clearing the project list when React Strict Mode re-subscribes the same user. */
let lastListenUid: string | null = null;

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: true,
  error: null,

  listen: (uid: string) => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    // Only wipe list when switching accounts — not on dev double-mount / resubscribe.
    if (lastListenUid !== uid) {
      set({ projects: [], loading: true, error: null });
      lastListenUid = uid;
    } else {
      set({ loading: true, error: null });
    }

    const q = query(
      collection(getFirestoreDb(), "projects"),
      where("memberIds", "array-contains", uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const projects: ProjectDoc[] = snap.docs.map((d) => {
          const data = d.data() as Omit<ProjectDoc, "id" | "parameters"> & {
            parameters?: ProjectParameter[];
            nextCaseNumber?: number;
          };
          return {
            id: d.id,
            ...data,
            parameters: data.parameters ?? [],
            nextCaseNumber:
              typeof data.nextCaseNumber === "number" && data.nextCaseNumber >= 1
                ? data.nextCaseNumber
                : 1,
          };
        });
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        set({ projects, loading: false, error: null });
      },
      (err) => {
        console.error("[Railyard] projects listener:", err);
        const message =
          err instanceof Error ? err.message : "Failed to load projects.";
        set({ loading: false, error: message });
      }
    );
    activeUnsub = unsub;
    return unsub;
  },

  stop: () => {
    lastListenUid = null;
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    set({ projects: [], loading: true, error: null });
  },

  createProject: async ({ name, description, owner }) => {
    const now = Date.now();
    const member: ProjectMember = {
      uid: owner.uid,
      email: owner.email,
      role: owner.role,
      addedAt: now,
    };
    const ref = await addDoc(collection(getFirestoreDb(), "projects"), {
      name,
      description,
      parameters: [],
      nextCaseNumber: 1,
      memberIds: [owner.uid],
      members: [member],
      createdBy: owner.uid,
      createdAt: now,
      updatedAt: now,
    });
    const id = ref.id;
    const doc: ProjectDoc = {
      id,
      name,
      description,
      parameters: [],
      nextCaseNumber: 1,
      memberIds: [owner.uid],
      members: [member],
      createdBy: owner.uid,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      projects: [doc, ...state.projects.filter((p) => p.id !== id)],
      loading: false,
      error: null,
    }));
    return id;
  },

  updateProject: async (projectId, updates) => {
    const now = Date.now();
    await updateDoc(doc(getFirestoreDb(), "projects", projectId), {
      name: updates.name,
      description: updates.description,
      parameters: updates.parameters,
      updatedAt: now,
    });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              name: updates.name,
              description: updates.description,
              parameters: updates.parameters,
              updatedAt: now,
            }
          : p
      ),
    }));
  },
}));
