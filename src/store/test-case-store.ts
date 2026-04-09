import { create } from "zustand";

import { apiJson } from "@/lib/api";
import {
  DEFAULT_SECTION_ID,
  DEFAULT_SUITE_ID,
} from "@/lib/test-case-defaults";
import type { TestCaseDoc, TestCaseStep } from "@/types/models";

interface TestCaseState {
  cases: TestCaseDoc[];
  loading: boolean;
  listen: (projectId: string) => () => void;
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
      order?: number;
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
  moveTestCaseToFolder: (
    projectId: string,
    caseId: string,
    sectionId: string
  ) => Promise<void>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastListenProjectId: string | null = null;

function mapRow(row: Record<string, unknown>): TestCaseDoc {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    caseNumber: Number(row.caseNumber ?? 0),
    suiteId: String(row.suiteId ?? DEFAULT_SUITE_ID),
    sectionId: String(row.sectionId ?? DEFAULT_SECTION_ID),
    title: String(row.title ?? ""),
    preconditions: String(row.preconditions ?? ""),
    steps: Array.isArray(row.steps) ? (row.steps as TestCaseStep[]) : [],
    priority: (row.priority ?? "medium") as TestCaseDoc["priority"],
    type: (row.type ?? "functional") as TestCaseDoc["type"],
    status: (row.status ?? "draft") as TestCaseDoc["status"],
    customFields:
      row.customFields && typeof row.customFields === "object"
        ? (row.customFields as TestCaseDoc["customFields"])
        : {},
    order: typeof row.order === "number" ? row.order : 0,
    createdBy: String(row.createdBy ?? ""),
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
  };
}

export const useTestCaseStore = create<TestCaseState>((set, get) => ({
  cases: [],
  loading: true,

  listen: (projectId: string) => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (lastListenProjectId !== projectId) {
      set({ cases: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const tick = () => {
      void apiJson<Record<string, unknown>[]>(
        `/api/projects/${projectId}/test-cases`
      )
        .then((rows) => {
          const cases = rows.map((r) => mapRow(r));
          set({ cases, loading: false });
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
    set({ cases: [], loading: true });
  },

  createTestCase: async (projectId, input) => {
    const res = await apiJson<{ id: string }>(
      `/api/projects/${projectId}/test-cases`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          preconditions: input.preconditions,
          steps: input.steps,
          priority: input.priority,
          type: input.type,
          status: input.status,
          customFields: input.customFields,
          sectionId: input.sectionId,
          order: input.order,
        }),
      }
    );
    return res.id;
  },

  updateTestCase: async (projectId, caseId, input) => {
    await apiJson(`/api/projects/${projectId}/test-cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        preconditions: input.preconditions,
        steps: input.steps,
        priority: input.priority,
        type: input.type,
        status: input.status,
        customFields: input.customFields,
        sectionId: input.sectionId,
        order: input.order,
      }),
    });
  },

  deleteTestCase: async (projectId, caseId) => {
    await apiJson(`/api/projects/${projectId}/test-cases/${caseId}`, {
      method: "DELETE",
    });
  },

  moveTestCaseToFolder: async (projectId, caseId, sectionId) => {
    const c = get().cases.find((x) => x.id === caseId);
    if (!c) return;
    await apiJson(`/api/projects/${projectId}/test-cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: c.title,
        preconditions: c.preconditions,
        steps: c.steps,
        priority: c.priority,
        type: c.type,
        status: c.status,
        customFields: c.customFields,
        sectionId,
        order: c.order,
      }),
    });
  },
}));
