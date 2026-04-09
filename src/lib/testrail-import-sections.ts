import { apiJson } from "@/lib/api";
import { ensureDefaultSuite } from "@/lib/ensure-default-suite";
import { DEFAULT_SECTION_ID, DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";

/** In-memory folder list used during import (mutated as new folders are created). */
export type TestRailSectionRow = {
  id: string;
  parentSectionId: string | null;
  name: string;
  order: number;
};

function findChild(
  sections: TestRailSectionRow[],
  parentId: string | null,
  name: string
): TestRailSectionRow | undefined {
  const n = name.trim();
  return sections.find(
    (s) => (s.parentSectionId ?? null) === parentId && s.name.trim() === n
  );
}

async function loadSections(projectId: string): Promise<TestRailSectionRow[]> {
  const rows = await apiJson<Record<string, unknown>[]>(
    `/api/projects/${projectId}/sections`
  );
  return rows
    .filter((row) => String(row.suiteId ?? DEFAULT_SUITE_ID) === DEFAULT_SUITE_ID)
    .map((row) => {
      const parent = row.parentSectionId;
      return {
        id: String(row.id),
        parentSectionId:
          parent === null || parent === undefined ? null : String(parent),
        name: String(row.name ?? ""),
        order: typeof row.order === "number" ? row.order : 0,
      };
    });
}

/**
 * Resolves a folder path to a section id, creating missing folders under the default suite.
 * Empty path → {@link DEFAULT_SECTION_ID} (unfiled).
 */
export async function ensureSectionPathForImport(
  projectId: string,
  pathSegments: string[],
  /** Mutable cache shared across rows in one import (avoids duplicate creates). */
  sections: TestRailSectionRow[]
): Promise<string> {
  const segs = pathSegments.map((s) => s.trim()).filter(Boolean);
  if (segs.length === 0) return DEFAULT_SECTION_ID;

  await ensureDefaultSuite(projectId);

  let parentId: string | null = null;
  for (const segmentName of segs) {
    let found = findChild(sections, parentId, segmentName);
    if (!found) {
      const siblings = sections.filter(
        (s) => (s.parentSectionId ?? null) === parentId
      );
      const nextOrder =
        siblings.length === 0
          ? 0
          : Math.max(...siblings.map((s) => s.order)) + 1;
      const resp: { id: string } = await apiJson<{ id: string }>(
        `/api/projects/${projectId}/sections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: segmentName.trim(),
            parentSectionId: parentId,
            order: nextOrder,
          }),
        }
      );
      found = {
        id: resp.id,
        parentSectionId: parentId,
        name: segmentName.trim(),
        order: nextOrder,
      };
      sections.push(found);
    }
    parentId = found.id;
  }

  return parentId ?? DEFAULT_SECTION_ID;
}

export async function loadSectionsForImportCache(
  projectId: string
): Promise<TestRailSectionRow[]> {
  await ensureDefaultSuite(projectId);
  return loadSections(projectId);
}
