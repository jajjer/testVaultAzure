/** TestRail-style reference shown in the UI (e.g. `C12`). */
export function formatTestCaseRef(caseNumber: number): string {
  if (typeof caseNumber !== "number" || caseNumber < 1) {
    return "—";
  }
  return `C${caseNumber}`;
}
