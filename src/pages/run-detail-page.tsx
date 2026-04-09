import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRunResultsSync } from "@/hooks/use-run-results-sync";
import { useTestCasesSync } from "@/hooks/use-test-cases-sync";
import { useTestRunsSync } from "@/hooks/use-test-runs-sync";
import { formatRunTestRef } from "@/lib/run-test-display";
import { formatTestCaseRef } from "@/lib/test-case-display";
import { getRunTestNumberForCase } from "@/lib/run-test-numbers";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTestCaseStore } from "@/store/test-case-store";
import { useTestResultStore } from "@/store/test-result-store";
import { useTestRunStore } from "@/store/test-run-store";
import type { RunStatus, TestResultOutcome } from "@/types/models";

const OUTCOME_OPTIONS: { value: TestResultOutcome; label: string }[] = [
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "blocked", label: "Blocked" },
  { value: "skipped", label: "Skipped" },
  { value: "retest", label: "Retest" },
];

const outcomeSelectClass = cn(
  "min-w-[140px] max-w-[200px] rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

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

export function RunDetailPage() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();
  useTestRunsSync(projectId);
  useTestCasesSync(projectId);
  useRunResultsSync(projectId, runId);

  const runs = useTestRunStore((s) => s.runs);
  const runsLoading = useTestRunStore((s) => s.loading);
  const cases = useTestCaseStore((s) => s.cases);
  const resultsByCaseId = useTestResultStore((s) => s.resultsByCaseId);
  const resultsLoading = useTestResultStore((s) => s.loading);
  const setRunResult = useTestResultStore((s) => s.setRunResult);

  const account = useAuthStore((s) => s.account);

  const [savingCaseId, setSavingCaseId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const run = runs.find((r) => r.id === runId);

  const caseById = useMemo(
    () => new Map(cases.map((c) => [c.id, c])),
    [cases]
  );

  const rows = useMemo(() => {
    if (!run) return [];
    return run.caseIds.map((caseId) => {
      const c = caseById.get(caseId);
      const tNum = getRunTestNumberForCase(run, caseId);
      return { caseId, testCase: c, tNum };
    });
  }, [run, caseById]);

  async function onOutcomeChange(caseId: string, raw: string) {
    if (!projectId || !runId || !account) return;
    setSaveError(null);
    const outcome =
      raw === ""
        ? null
        : (raw as TestResultOutcome);
    setSavingCaseId(caseId);
    try {
      await setRunResult(projectId, runId, caseId, {
        outcome,
        executedByUid: account.localAccountId,
      });
    } catch (e) {
      console.error(e);
      setSaveError(
        e instanceof Error ? e.message : "Could not save result."
      );
    } finally {
      setSavingCaseId(null);
    }
  }

  if (!projectId || !runId) {
    return (
      <p className="text-sm text-muted-foreground">Missing project or run.</p>
    );
  }

  const backToRuns = `/projects/${projectId}/runs`;
  const canRecord = !!account;

  function caseEditorHref(caseId: string) {
    const returnPath = `/projects/${projectId}/runs/${runId}`;
    return `/projects/${projectId}/test-cases?case=${encodeURIComponent(caseId)}&returnTo=${encodeURIComponent(returnPath)}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit gap-1 px-0" asChild>
          <Link to={backToRuns}>
            <ChevronLeft className="h-4 w-4" />
            Test runs
          </Link>
        </Button>
        {runsLoading ? (
          <p className="text-sm text-muted-foreground">Loading run…</p>
        ) : !run ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Run not found</CardTitle>
              <CardDescription>
                It may have been deleted, or you can return to the list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link to={backToRuns}>Back to runs</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {run.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Each row is one test in this run:{" "}
                  <span className="font-mono">T</span> is unique in the project;{" "}
                  <span className="font-mono">C</span> is the case id. Set the
                  outcome manually when you execute or record a result.
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium",
                  statusStyles(run.status)
                )}
              >
                {label(run.status)}
              </span>
            </div>

            {saveError ? (
              <p className="text-sm text-destructive" role="alert">
                {saveError}
              </p>
            ) : null}

            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium w-[72px]">Run</th>
                        <th className="px-4 py-3 font-medium w-[72px]">Case</th>
                        <th className="px-4 py-3 font-medium min-w-[200px]">
                          Title
                        </th>
                        <th className="px-4 py-3 font-medium w-[200px]">
                          Outcome
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ caseId, testCase, tNum }) => {
                        const res = resultsByCaseId[caseId];
                        const current = res?.outcome ?? null;
                        const value =
                          current === null || current === undefined
                            ? ""
                            : current;
                        const busy = savingCaseId === caseId;

                        return (
                          <tr
                            key={caseId}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="px-4 py-3 align-middle">
                              <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                                {formatRunTestRef(tNum)}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              {testCase ? (
                                <Link
                                  to={caseEditorHref(caseId)}
                                  className="font-mono text-sm text-primary tabular-nums hover:underline"
                                >
                                  {formatTestCaseRef(testCase.caseNumber)}
                                </Link>
                              ) : (
                                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              {testCase ? (
                                <Link
                                  to={caseEditorHref(caseId)}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {testCase.title}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  Case removed from project
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              {resultsLoading && !res ? (
                                <span className="text-xs text-muted-foreground">
                                  …
                                </span>
                              ) : canRecord ? (
                                <select
                                  className={outcomeSelectClass}
                                  value={value}
                                  disabled={busy}
                                  aria-label={`Outcome for ${formatRunTestRef(tNum)}`}
                                  onChange={(e) =>
                                    void onOutcomeChange(caseId, e.target.value)
                                  }
                                >
                                  <option value="">Not set</option>
                                  {OUTCOME_OPTIONS.map(({ value: v, label: l }) => (
                                    <option key={v} value={v}>
                                      {l}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Sign in to record
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
