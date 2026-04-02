import { DEFAULT_SECTION_ID } from "@/lib/test-case-defaults";
import type { SectionDoc } from "@/types/models";

export function folderLabel(
  sectionId: string,
  sections: { id: string; name: string }[]
): string {
  if (sectionId === DEFAULT_SECTION_ID) return "No folder";
  return sections.find((s) => s.id === sectionId)?.name ?? "—";
}

/** Full path for nested folders, e.g. `Parent / Child`. */
export function folderPathLabel(
  sectionId: string,
  sections: SectionDoc[]
): string {
  if (sectionId === DEFAULT_SECTION_ID) return "No folder";
  const byId = new Map(sections.map((s) => [s.id, s]));
  const parts: string[] = [];
  let cur: string | undefined = sectionId;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const s = byId.get(cur);
    if (!s) break;
    parts.unshift(s.name);
    cur = s.parentSectionId ?? undefined;
  }
  return parts.length ? parts.join(" / ") : "—";
}
