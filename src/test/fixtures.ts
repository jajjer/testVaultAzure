import { DEFAULT_SECTION_ID, DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";
import type { SectionDoc, TestCaseDoc } from "@/types/models";

export function makeSection(
  id: string,
  name: string,
  parentSectionId: string | null,
  order = 0
): SectionDoc {
  return {
    id,
    projectId: "proj1",
    suiteId: DEFAULT_SUITE_ID,
    parentSectionId,
    name,
    order,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function makeCase(
  id: string,
  sectionId: string,
  overrides: Partial<TestCaseDoc> = {}
): TestCaseDoc {
  return {
    id,
    projectId: "proj1",
    caseNumber: 1,
    suiteId: DEFAULT_SUITE_ID,
    sectionId,
    title: "T",
    preconditions: "",
    steps: [],
    priority: "medium",
    type: "functional",
    status: "draft",
    customFields: {},
    order: 0,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

export { DEFAULT_SECTION_ID };
