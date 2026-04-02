import { useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { NewRunDialog } from "@/features/runs/new-run-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSectionsSync } from "@/hooks/use-sections-sync";
import { useTestCasesSync } from "@/hooks/use-test-cases-sync";
import { useTestRunsSync } from "@/hooks/use-test-runs-sync";
import { cn } from "@/lib/utils";
import { canManageContent, useAuthStore } from "@/store/auth-store";
import { useTestRunStore } from "@/store/test-run-store";
import type { RunStatus, TestRunDoc } from "@/types/models";

function statusStyles(s: RunStatus) {
  switch (s) {
    case "completed":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    case "archived":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";
  }
}

function label(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatWhen(ts: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RunsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useTestCasesSync(projectId);
  useSectionsSync(projectId);
  useTestRunsSync(projectId);

  const runs = useTestRunStore((s) => s.runs);
  const loading = useTestRunStore((s) => s.loading);
  const deleteRun = useTestRunStore((s) => s.deleteRun);
  const profile = useAuthStore((s) => s.profile);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<TestRunDoc | null>(null);
  const canWrite = profile && canManageContent(profile.role);

  const runDialogOpen = createOpen || editingRun !== null;

  async function onDelete(runId: string, runName: string) {
    if (!projectId) return;
    const ok = window.confirm(
      `Delete test run “${runName}”? Result rows under this run will also be removed.`
    );
    if (!ok) return;
    await deleteRun(projectId, runId);
  }

  if (!projectId) {
    return (
      <p className="text-sm text-muted-foreground">Missing project.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test runs</h1>
          <p className="text-sm text-muted-foreground">
            Group test cases into a run, then record pass/fail and notes per case.
          </p>
        </div>
        {canWrite ? (
          <>
            <Button
              className="shrink-0 gap-2"
              onClick={() => {
                setEditingRun(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New test run
            </Button>
            <NewRunDialog
              projectId={projectId}
              open={runDialogOpen}
              editingRun={editingRun}
              onOpenChange={(o) => {
                if (!o) {
                  setCreateOpen(false);
                  setEditingRun(null);
                }
              }}
            />
          </>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading test runs…</p>
      ) : runs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No test runs yet</CardTitle>
            <CardDescription>
              {canWrite
                ? "Create a run to execute a set of test cases and track outcomes."
                : "No runs have been created for this project yet."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">Run</th>
                    <th className="px-4 py-3 font-medium w-[100px]">Status</th>
                    <th className="px-4 py-3 font-medium w-[90px] tabular-nums">
                      Cases
                    </th>
                    <th className="px-4 py-3 font-medium min-w-[160px]">
                      Updated
                    </th>
                    {canWrite ? (
                      <th className="px-4 py-3 w-[100px] text-right">
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {r.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            statusStyles(r.status)
                          )}
                        >
                          {label(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {r.caseIds.length}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatWhen(r.updatedAt)}
                      </td>
                      {canWrite ? (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setCreateOpen(false);
                                setEditingRun(r);
                              }}
                              aria-label={`Edit ${r.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => void onDelete(r.id, r.name)}
                              aria-label={`Delete ${r.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
