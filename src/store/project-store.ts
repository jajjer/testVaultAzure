import { create } from "zustand";

import { apiJson } from "@/lib/api";
import type {
  ProjectDoc,
  ProjectMember,
  ProjectParameter,
  UserRole,
} from "@/types/models";

interface ProjectState {
  projects: ProjectDoc[];
  loading: boolean;
  error: string | null;
  listen: (uid: string, role: UserRole) => () => void;
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
      testCasePriorityOptions?: string[];
      testCaseTypeOptions?: string[];
    }
  ) => Promise<void>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastListenUid: string | null = null;

async function loadProjects(): Promise<ProjectDoc[]> {
  return apiJson<ProjectDoc[]>("/api/projects");
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: true,
  error: null,

  listen: (uid: string, role: UserRole) => {
    void role;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (lastListenUid !== uid) {
      set({ projects: [], loading: true, error: null });
      lastListenUid = uid;
    } else {
      set({ loading: true, error: null });
    }

    const tick = () => {
      void loadProjects()
        .then((projects) => {
          projects.sort((a, b) => b.updatedAt - a.updatedAt);
          set({ projects, loading: false, error: null });
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "Failed to load projects.";
          set({ loading: false, error: message });
        });
    };
    tick();
    pollTimer = setInterval(tick, 3000);

    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  },

  stop: () => {
    lastListenUid = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ projects: [], loading: true, error: null });
  },

  createProject: async ({ name, description }) => {
    const res = await apiJson<{ id: string }>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const projects = await loadProjects();
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ projects, loading: false, error: null });
    return res.id;
  },

  updateProject: async (projectId, updates) => {
    const doc = await apiJson<ProjectDoc>(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        parameters: updates.parameters,
        testCasePriorityOptions: updates.testCasePriorityOptions,
        testCaseTypeOptions: updates.testCaseTypeOptions,
      }),
    });
    set((state) => ({
      projects: state.projects.map((p) => (p.id === projectId ? doc : p)),
    }));
  },
}));
