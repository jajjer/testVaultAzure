import { DEFAULT_SECTION_ID } from "@/lib/test-case-defaults";
import type { SectionDoc, TestCaseDoc } from "@/types/models";

export interface SectionTreeNode {
  section: SectionDoc;
  children: SectionTreeNode[];
}

export function buildSectionTree(sections: SectionDoc[]): SectionTreeNode[] {
  const byParent = new Map<string | null, SectionDoc[]>();
  for (const s of sections) {
    const key = s.parentSectionId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.order - b.order);
  }
  function build(parentId: string | null): SectionTreeNode[] {
    const list = byParent.get(parentId) ?? [];
    return list.map((section) => ({
      section,
      children: build(section.id),
    }));
  }
  return build(null);
}

/** Depth-first list with depth for indented UI (select, etc.). */
export function flattenSectionsDepthFirst(
  nodes: SectionTreeNode[],
  depth = 0
): { section: SectionDoc; depth: number }[] {
  const out: { section: SectionDoc; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ section: n.section, depth });
    out.push(...flattenSectionsDepthFirst(n.children, depth + 1));
  }
  return out;
}

/** `rootSectionId` plus every descendant section id (nested folders). */
export function collectSubtreeSectionIds(
  rootSectionId: string,
  sections: SectionDoc[]
): Set<string> {
  const ids = new Set<string>([rootSectionId]);
  function walk(parentId: string) {
    for (const s of sections) {
      if (s.parentSectionId === parentId) {
        ids.add(s.id);
        walk(s.id);
      }
    }
  }
  walk(rootSectionId);
  return ids;
}

/** Case ids filed in this folder or any nested folder under it. */
export function caseIdsForFolderSubtree(
  rootSectionId: string,
  cases: TestCaseDoc[],
  sections: SectionDoc[]
): string[] {
  const subtree = collectSubtreeSectionIds(rootSectionId, sections);
  return cases.filter((c) => subtree.has(c.sectionId)).map((c) => c.id);
}

/** Cases with no folder (default bucket). */
export function caseIdsForNoFolder(cases: TestCaseDoc[]): string[] {
  return cases
    .filter((c) => c.sectionId === DEFAULT_SECTION_ID)
    .map((c) => c.id);
}

export type FolderCheckState = "all" | "some" | "none";

export function folderCheckState(
  caseIds: string[],
  selected: Set<string>
): FolderCheckState {
  if (caseIds.length === 0) return "none";
  let n = 0;
  for (const id of caseIds) {
    if (selected.has(id)) n++;
  }
  if (n === 0) return "none";
  if (n === caseIds.length) return "all";
  return "some";
}
