import type { UniqueIdentifier } from "@dnd-kit/core";

import { DEFAULT_SECTION_ID } from "@/lib/test-case-defaults";

export const DND_DROP_UNFILED = "drop-unfiled";

export function dndDropFolderId(sectionId: string): string {
  return `drop-folder-${sectionId}`;
}

export function dndCaseDragId(caseId: string): string {
  return `case-${caseId}`;
}

export function parseCaseDragId(id: UniqueIdentifier): string | null {
  const s = String(id);
  if (s.startsWith("case-")) return s.slice(5);
  return null;
}

/** Resolves drop target to a section id, or null if not a folder drop zone. */
export function parseFolderDropId(
  overId: UniqueIdentifier | undefined | null
): string | null {
  if (overId == null) return null;
  const s = String(overId);
  if (s === DND_DROP_UNFILED) return DEFAULT_SECTION_ID;
  if (s.startsWith("drop-folder-")) return s.slice("drop-folder-".length);
  return null;
}
