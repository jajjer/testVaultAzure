import { apiJson } from "@/lib/api";

/** Ensures default suite exists (server-side); safe to call before section operations. */
export async function ensureDefaultSuite(projectId: string): Promise<void> {
  await apiJson(`/api/projects/${projectId}/suites/ensure-default`, {
    method: "POST",
  });
}
