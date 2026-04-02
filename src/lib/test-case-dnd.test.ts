import { describe, expect, it } from "vitest";

import { DEFAULT_SECTION_ID } from "@/lib/test-case-defaults";
import {
  DND_DROP_UNFILED,
  dndCaseDragId,
  dndDropFolderId,
  parseCaseDragId,
  parseFolderDropId,
} from "@/lib/test-case-dnd";

describe("dnd ids", () => {
  it("builds stable folder and case drag ids", () => {
    expect(dndDropFolderId("sec-1")).toBe("drop-folder-sec-1");
    expect(dndCaseDragId("case-abc")).toBe("case-case-abc");
  });
});

describe("parseCaseDragId", () => {
  it("parses case id from draggable id", () => {
    expect(parseCaseDragId("case-xyz")).toBe("xyz");
    expect(parseCaseDragId("case-case-1")).toBe("case-1");
  });

  it("returns null for non-case ids", () => {
    expect(parseCaseDragId("drop-folder-x")).toBeNull();
    expect(parseCaseDragId("case")).toBeNull();
  });
});

describe("parseFolderDropId", () => {
  it("returns null for missing or unknown ids", () => {
    expect(parseFolderDropId(undefined)).toBeNull();
    expect(parseFolderDropId(null)).toBeNull();
    expect(parseFolderDropId("random")).toBeNull();
  });

  it("maps unfiled drop zone to default section id", () => {
    expect(parseFolderDropId(DND_DROP_UNFILED)).toBe(DEFAULT_SECTION_ID);
  });

  it("strips drop-folder- prefix", () => {
    expect(parseFolderDropId("drop-folder-abc123")).toBe("abc123");
  });
});
