import { create } from "zustand";

import { apiJson } from "@/lib/api";
import type { TestResultDoc, TestResultOutcome } from "@/types/models";

interface TestResultState {
  resultsByCaseId: Record<string, TestResultDoc>;
  loading: boolean;
  listen: (projectId: string, runId: string) => () => void;
  stop: () => void;
  setRunResult: (
    projectId: string,
    runId: string,
    caseId: string,
    input: {
      outcome: TestResultOutcome | null;
      executedByUid: string;
    }
  ) => Promise<void>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastKey: string | null = null;

function isOutcome(v: unknown): v is TestResultOutcome {
  return (
    v === "passed" ||
    v === "failed" ||
    v === "blocked" ||
    v === "skipped" ||
    v === "retest"
  );
}

function normalizeResult(
  caseId: string,
  data: Record<string, unknown>
): TestResultDoc {
  const o = data.outcome;
  const outcome: TestResultOutcome | null = isOutcome(o) ? o : null;
  const ex = data.executedAt;
  return {
    caseId,
    runId: String(data.runId ?? ""),
    projectId: String(data.projectId ?? ""),
    outcome,
    comment: String(data.comment ?? ""),
    attachments: Array.isArray(data.attachments)
      ? (data.attachments as TestResultDoc["attachments"])
      : [],
    executedBy:
      data.executedBy === null || data.executedBy === undefined
        ? null
        : String(data.executedBy),
    executedAt:
      ex === null || ex === undefined
        ? null
        : typeof ex === "number"
          ? ex
          : null,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export const useTestResultStore = create<TestResultState>((set) => ({
  resultsByCaseId: {},
  loading: true,

  listen: (projectId: string, runId: string) => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    const key = `${projectId}/${runId}`;
    if (lastKey !== key) {
      set({ resultsByCaseId: {}, loading: true });
      lastKey = key;
    } else {
      set({ loading: true });
    }

    const tick = () => {
      void apiJson<Record<string, Record<string, unknown>>>(
        `/api/projects/${projectId}/runs/${runId}/results`
      )
        .then((raw) => {
          const resultsByCaseId: Record<string, TestResultDoc> = {};
          for (const [caseId, data] of Object.entries(raw)) {
            resultsByCaseId[caseId] = normalizeResult(caseId, data);
          }
          set({ resultsByCaseId, loading: false });
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
    lastKey = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ resultsByCaseId: {}, loading: true });
  },

  setRunResult: async (projectId, runId, caseId, input) => {
    await apiJson(
      `/api/projects/${projectId}/runs/${runId}/results/${caseId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: input.outcome }),
      }
    );
  },
}));
