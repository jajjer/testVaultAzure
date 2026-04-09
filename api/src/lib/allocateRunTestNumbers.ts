export function allocateRunTestNumbersFromProjectCounter(
  newCaseIds: string[],
  previousCaseIds: string[],
  previousMap: Record<string, number> | undefined,
  projectNextT: number
): { runTestNumbers: Record<string, number>; nextProjectRunTestNumber: number } {
  const prev = previousMap ?? {};
  const map: Record<string, number> = {};
  let nextT =
    typeof projectNextT === "number" && projectNextT >= 1 ? projectNextT : 1;

  for (const cid of newCaseIds) {
    const stayed =
      previousCaseIds.includes(cid) &&
      typeof prev[cid] === "number" &&
      prev[cid] >= 1;
    if (stayed) {
      map[cid] = prev[cid]!;
    } else {
      map[cid] = nextT;
      nextT += 1;
    }
  }

  return { runTestNumbers: map, nextProjectRunTestNumber: nextT };
}
