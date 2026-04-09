import { create } from "zustand";

import { apiJson } from "@/lib/api";
import { DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";
import type { SectionDoc } from "@/types/models";

interface SectionState {
  sections: SectionDoc[];
  loading: boolean;
  listen: (projectId: string) => () => void;
  stop: () => void;
  createFolder: (
    projectId: string,
    name: string,
    parentSectionId?: string | null
  ) => Promise<string>;
  renameFolder: (
    projectId: string,
    sectionId: string,
    name: string
  ) => Promise<void>;
  deleteFolder: (projectId: string, sectionId: string) => Promise<void>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastListenProjectId: string | null = null;

function mapSection(row: Record<string, unknown>): SectionDoc {
  const parent = row.parentSectionId;
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    suiteId: String(row.suiteId ?? DEFAULT_SUITE_ID),
    parentSectionId:
      parent === null || parent === undefined ? null : String(parent),
    name: String(row.name ?? ""),
    order: typeof row.order === "number" ? row.order : 0,
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
  };
}

export const useSectionStore = create<SectionState>((set, get) => ({
  sections: [],
  loading: true,

  listen: (projectId: string) => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (lastListenProjectId !== projectId) {
      set({ sections: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const tick = () => {
      void apiJson<Record<string, unknown>[]>(
        `/api/projects/${projectId}/sections`
      )
        .then((rows) => {
          const sections = rows.map((r) => mapSection(r));
          set({ sections, loading: false });
        })
        .catch(() => set({ loading: false }));
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
    lastListenProjectId = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ sections: [], loading: true });
  },

  createFolder: async (projectId, name, parentSectionId = null) => {
    await apiJson(`/api/projects/${projectId}/suites/ensure-default`, {
      method: "POST",
    });
    const existing = get().sections;
    const parent = parentSectionId ?? null;
    const siblings = existing.filter(
      (s) => (s.parentSectionId ?? null) === parent
    );
    const nextOrder =
      siblings.length === 0
        ? 0
        : Math.max(...siblings.map((s) => s.order)) + 1;

    const res = await apiJson<{ id: string }>(
      `/api/projects/${projectId}/sections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentSectionId: parent,
          order: nextOrder,
        }),
      }
    );
    return res.id;
  },

  renameFolder: async (projectId, sectionId, name) => {
    await apiJson(`/api/projects/${projectId}/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  },

  deleteFolder: async (projectId, sectionId) => {
    await apiJson(`/api/projects/${projectId}/sections/${sectionId}`, {
      method: "DELETE",
    });
  },
}));
