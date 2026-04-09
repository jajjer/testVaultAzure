import { describe, expect, it } from "vitest";

import { caseIdForRunTestNumber } from "./runTestNumber.js";

describe("caseIdForRunTestNumber", () => {
  it("returns case id for matching T", () => {
    expect(caseIdForRunTestNumber({ a: 1, b: 5 }, 5)).toBe("b");
  });

  it("returns undefined when T not in map", () => {
    expect(caseIdForRunTestNumber({ a: 1 }, 2)).toBeUndefined();
  });
});
