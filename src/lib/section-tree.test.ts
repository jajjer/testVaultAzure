import { describe, expect, it } from "vitest";

import {
  buildSectionTree,
  caseIdsForFolderSubtree,
  caseIdsForNoFolder,
  collectSubtreeSectionIds,
  flattenSectionsDepthFirst,
  folderCheckState,
} from "@/lib/section-tree";
import { DEFAULT_SECTION_ID, makeCase, makeSection } from "@/test/fixtures";

describe("buildSectionTree", () => {
  it("returns empty array for no sections", () => {
    expect(buildSectionTree([])).toEqual([]);
  });

  it("orders root siblings by order field", () => {
    const sections = [
      makeSection("b", "B", null, 2),
      makeSection("a", "A", null, 0),
      makeSection("c", "C", null, 1),
    ];
    const tree = buildSectionTree(sections);
    expect(tree.map((n) => n.section.id)).toEqual(["a", "c", "b"]);
  });

  it("nests children under parent", () => {
    const sections = [
      makeSection("root", "Root", null, 0),
      makeSection("child", "Child", "root", 0),
    ];
    const tree = buildSectionTree(sections);
    expect(tree).toHaveLength(1);
    expect(tree[0].section.id).toBe("root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].section.id).toBe("child");
    expect(tree[0].children[0].children).toEqual([]);
  });
});

describe("flattenSectionsDepthFirst", () => {
  it("lists nodes with depth", () => {
    const sections = [
      makeSection("r", "R", null, 0),
      makeSection("c", "C", "r", 0),
    ];
    const tree = buildSectionTree(sections);
    const flat = flattenSectionsDepthFirst(tree);
    expect(flat.map((x) => [x.section.id, x.depth])).toEqual([
      ["r", 0],
      ["c", 1],
    ]);
  });
});

describe("collectSubtreeSectionIds", () => {
  it("includes root and all descendants", () => {
    const sections = [
      makeSection("a", "A", null, 0),
      makeSection("b", "B", "a", 0),
      makeSection("c", "C", "b", 0),
    ];
    const ids = collectSubtreeSectionIds("a", sections);
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });

  it("returns only root when there are no children", () => {
    const sections = [makeSection("x", "X", null, 0)];
    expect([...collectSubtreeSectionIds("x", sections)]).toEqual(["x"]);
  });
});

describe("caseIdsForFolderSubtree", () => {
  it("returns cases in folder and nested folders", () => {
    const sections = [
      makeSection("a", "A", null, 0),
      makeSection("b", "B", "a", 0),
    ];
    const cases = [
      makeCase("t1", "a"),
      makeCase("t2", "b"),
      makeCase("t3", DEFAULT_SECTION_ID),
    ];
    const ids = caseIdsForFolderSubtree("a", cases, sections).sort();
    expect(ids).toEqual(["t1", "t2"]);
  });
});

describe("caseIdsForNoFolder", () => {
  it("returns only default section cases", () => {
    const cases = [
      makeCase("a", DEFAULT_SECTION_ID),
      makeCase("b", "sec1"),
    ];
    expect(caseIdsForNoFolder(cases)).toEqual(["a"]);
  });
});

describe("folderCheckState", () => {
  it("returns none for empty case list", () => {
    expect(folderCheckState([], new Set(["a"]))).toBe("none");
  });

  it("returns none, some, all correctly", () => {
    const ids = ["a", "b", "c"];
    expect(folderCheckState(ids, new Set())).toBe("none");
    expect(folderCheckState(ids, new Set(["a"]))).toBe("some");
    expect(folderCheckState(ids, new Set(["a", "b", "c"]))).toBe("all");
  });
});
