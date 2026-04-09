import { create } from "zustand";

import { apiJson } from "@/lib/api";
import { DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";
import type { RunStatus, TestRunDoc } from "@/types/models";

interface TestRunState {
  runs: TestRunDoc[];
  loading: boolean;
  listen: (projectId: string) => () => void;
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

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastListenProjectId: string | null = null;

function mapRun(row: Record<string, unknown>): TestRunDoc {
  const caseIds = Array.isArray(row.caseIds)
    ? (row.caseIds as string[])
    : [];
  const rawMap =
    row.runTestNumbers && typeof row.runTestNumbers === "object"
      ? (row.runTestNumbers as Record<string, number>)
      : {};
  const runTestNumbers: Record<string, number> = { ...rawMap };
  for (let i = 0; i < caseIds.length; i++) {
    const cid = caseIds[i];
    if (runTestNumbers[cid] == null) {
      runTestNumbers[cid] = i + 1;
    }
  }
  const completedAt = row.completedAt;
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    name: String(row.name ?? ""),
    suiteId: String(row.suiteId ?? DEFAULT_SUITE_ID),
    caseIds,
    runTestNumbers,
    status: (row.status ?? "active") as TestRunDoc["status"],
    createdBy: String(row.createdBy ?? ""),
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
    completedAt:
      completedAt === null || completedAt === undefined
        ? null
        : Number(completedAt),
  };
}

export const useTestRunStore = create<TestRunState>((set) => ({
  runs: [],
  loading: true,

  listen: (projectId: string) => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (lastListenProjectId !== projectId) {
      set({ runs: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const tick = () => {
      void apiJson<Record<string, unknown>[]>(
        `/api/projects/${projectId}/runs`
      )
        .then((rows) => {
          const runs = rows.map((r) => mapRun(r));
          set({ runs, loading: false });
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
    set({ runs: [], loading: true });
  },

  createRun: async (projectId, input) => {
    const res = await apiJson<{ id: string }>(
      `/api/projects/${projectId}/runs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          caseIds: input.caseIds,
        }),
      }
    );
    return res.id;
  },

  deleteRun: async (projectId, runId) => {
    await apiJson(`/api/projects/${projectId}/runs/${runId}`, {
      method: "DELETE",
    });
  },

  updateRun: async (projectId, runId, input) => {
    await apiJson(`/api/projects/${projectId}/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        caseIds: input.caseIds,
        status: input.status,
      }),
    });
  },
}));
