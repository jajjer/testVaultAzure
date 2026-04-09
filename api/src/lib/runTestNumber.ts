export function caseIdForRunTestNumber(
  runTestNumbers: Record<string, number> | undefined,
  runTestNumber: number
): string | undefined {
  if (!runTestNumbers || runTestNumber < 1) return undefined;
  for (const [caseId, num] of Object.entries(runTestNumbers)) {
    if (num === runTestNumber) return caseId;
  }
  return undefined;
}
