import { describe, expect, it } from "vitest";

import { folderLabel, folderPathLabel } from "@/lib/folder-label";
import { DEFAULT_SECTION_ID, makeSection } from "@/test/fixtures";

describe("folderLabel", () => {
  it('returns "No folder" for default section id', () => {
    expect(folderLabel(DEFAULT_SECTION_ID, [])).toBe("No folder");
  });

  it("returns section name when found", () => {
    const sections = [{ id: "s1", name: "Smoke" }];
    expect(folderLabel("s1", sections)).toBe("Smoke");
  });

  it("returns em dash when section missing", () => {
    expect(folderLabel("missing", [])).toBe("—");
  });
});

describe("folderPathLabel", () => {
  it('returns "No folder" for default bucket', () => {
    expect(folderPathLabel(DEFAULT_SECTION_ID, [])).toBe("No folder");
  });

  it("joins ancestors for nested folders", () => {
    const sections = [
      makeSection("root", "Root", null, 0),
      makeSection("child", "Child", "root", 0),
    ];
    expect(folderPathLabel("child", sections)).toBe("Root / Child");
  });

  it("returns em dash when section id missing from list", () => {
    expect(folderPathLabel("unknown", [])).toBe("—");
  });
});
