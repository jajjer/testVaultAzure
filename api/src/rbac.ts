import type { UserRole } from "./types.js";

export function canManageQualityContent(role: UserRole): boolean {
  return role === "admin" || role === "test_lead";
}

export function canWriteRunResult(role: UserRole): boolean {
  return role === "admin" || role === "test_lead" || role === "tester";
}
