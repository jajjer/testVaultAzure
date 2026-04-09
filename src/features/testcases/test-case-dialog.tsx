import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTestCaseRef } from "@/lib/test-case-display";
import {
  coerceToAllowedOption,
  formatTestCaseFieldLabel,
  getTestCasePriorityOptions,
  getTestCaseTypeOptions,
} from "@/lib/test-case-field-options";
import { DEFAULT_SECTION_ID } from "@/lib/test-case-defaults";
import {
  buildSectionTree,
  flattenSectionsDepthFirst,
} from "@/lib/section-tree";
import { cn } from "@/lib/utils";
import type {
  CustomFieldValue,
  TestCaseDoc,
  TestCasePriority,
  TestCaseStatus,
  TestCaseStep,
  TestCaseType,
} from "@/types/models";
import { TestCaseRunHistorySection } from "@/features/testcases/test-case-run-history-section";
import { useTestRunsSync } from "@/hooks/use-test-runs-sync";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { useSectionStore } from "@/store/section-store";
import { useTestCaseStore } from "@/store/test-case-store";

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

const STATUSES: TestCaseStatus[] = ["draft", "active", "deprecated"];

function label(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type StepRow = TestCaseStep & { _id: string };

function newStep(): StepRow {
  return { _id: crypto.randomUUID(), step: "", expectedResult: "" };
}

function toStepRows(steps: TestCaseStep[]): StepRow[] {
  if (steps.length === 0) return [newStep()];
  return steps.map((s) => ({
    ...s,
    _id: crypto.randomUUID(),
  }));
}

function rowsToSteps(rows: StepRow[]): TestCaseStep[] {
  return rows.map(({ step, expectedResult }) => ({
    step: step.trim(),
    expectedResult: expectedResult.trim(),
  }));
}

type CfRow = { _id: string; key: string; value: string };

function newCfRow(): CfRow {
  return { _id: crypto.randomUUID(), key: "", value: "" };
}

function customFieldsToRows(
  cf: Record<string, CustomFieldValue>
): CfRow[] {
  const entries = Object.entries(cf);
  if (entries.length === 0) return [newCfRow()];
  return entries.map(([key, value]) => ({
    _id: crypto.randomUUID(),
    key,
    value: value === null || value === undefined ? "" : String(value),
  }));
}

function rowsToCustomFields(rows: CfRow[]): Record<string, CustomFieldValue> {
  const out: Record<string, CustomFieldValue> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    out[k] = r.value.trim();
  }
  return out;
}

interface TestCaseDialogProps {
  projectId: string;
  mode: "create" | "edit";
  testCase: TestCaseDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Folder for new cases (section id, or default bucket for “no folder”). */
  initialSectionId?: string;
}

export function TestCaseDialog({
  projectId,
  mode,
  testCase,
  open,
  onOpenChange,
  initialSectionId = DEFAULT_SECTION_ID,
}: TestCaseDialogProps) {
  const [title, setTitle] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [stepRows, setStepRows] = useState<StepRow[]>([newStep()]);
  const [priority, setPriority] = useState<TestCasePriority>("medium");
  const [type, setType] = useState<TestCaseType>("functional");
  const [status, setStatus] = useState<TestCaseStatus>("draft");
  const [cfRows, setCfRows] = useState<CfRow[]>([newCfRow()]);
  const [sectionId, setSectionId] = useState<string>(DEFAULT_SECTION_ID);
  const [submitting, setSubmitting] = useState(false);

  const createTestCase = useTestCaseStore((s) => s.createTestCase);
  const updateTestCase = useTestCaseStore((s) => s.updateTestCase);
  const account = useAuthStore((s) => s.account);
  const sections = useSectionStore((s) => s.sections);
  const folderOptions = flattenSectionsDepthFirst(buildSectionTree(sections));
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId)
  );
  const priorityOptions = useMemo(
    () => getTestCasePriorityOptions(project),
    [project]
  );
  const typeOptions = useMemo(
    () => getTestCaseTypeOptions(project),
    [project]
  );
  const prevOpenRef = useRef(false);

  useTestRunsSync(projectId);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (mode === "edit" && testCase) {
        setTitle(testCase.title);
        setPreconditions(testCase.preconditions);
        setStepRows(toStepRows(testCase.steps));
        setPriority(
          coerceToAllowedOption(testCase.priority, priorityOptions)
        );
        setType(coerceToAllowedOption(testCase.type, typeOptions));
        setStatus(testCase.status);
        setCfRows(customFieldsToRows(testCase.customFields));
        setSectionId(testCase.sectionId || DEFAULT_SECTION_ID);
      } else {
        setTitle("");
        setPreconditions("");
        setStepRows([newStep()]);
        setPriority(priorityOptions[0] ?? "medium");
        setType(typeOptions[0] ?? "functional");
        setStatus("draft");
        setCfRows([newCfRow()]);
        setSectionId(initialSectionId);
      }
    }
    prevOpenRef.current = open;
  }, [
    open,
    mode,
    testCase,
    initialSectionId,
    priorityOptions,
    typeOptions,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const steps = rowsToSteps(stepRows);
    const customFields = rowsToCustomFields(cfRows);

    const ownerUid = account?.localAccountId;
    if (mode === "create" && !ownerUid) return;

    setSubmitting(true);
    try {
      if (mode === "create" && ownerUid) {
        await createTestCase(projectId, {
          title: t,
          preconditions: preconditions.trim(),
          steps,
          priority,
          type,
          status,
          customFields,
          sectionId,
          createdBy: ownerUid,
        });
      } else if (testCase) {
        await updateTestCase(projectId, testCase.id, {
          title: t,
          preconditions: preconditions.trim(),
          steps,
          priority,
          type,
          status,
          customFields,
          sectionId,
          order: testCase.order,
        });
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function patchStep(id: string, patch: Partial<TestCaseStep>) {
    setStepRows((rows) =>
      rows.map((r) => (r._id === id ? { ...r, ...patch } : r))
    );
  }

  function removeStep(id: string) {
    setStepRows((rows) => {
      const next = rows.filter((r) => r._id !== id);
      return next.length === 0 ? [newStep()] : next;
    });
  }

  function moveStep(id: string, dir: -1 | 1) {
    setStepRows((rows) => {
      const i = rows.findIndex((r) => r._id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function patchCf(id: string, patch: Partial<Pick<CfRow, "key" | "value">>) {
    setCfRows((rows) =>
      rows.map((r) => (r._id === id ? { ...r, ...patch } : r))
    );
  }

  function removeCf(id: string) {
    setCfRows((rows) => {
      const next = rows.filter((r) => r._id !== id);
      return next.length === 0 ? [newCfRow()] : next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "New test case" : "Edit test case"}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              {mode === "edit" && testCase ? (
                <span className="block font-mono text-sm font-medium text-foreground">
                  {formatTestCaseRef(testCase.caseNumber)}
                </span>
              ) : (
                <span className="block text-muted-foreground">
                  A case ID (e.g. C1) is assigned when you save.
                </span>
              )}
              <span className="block">
                Steps are executed in order. Custom fields are optional metadata
                for reporting or integrations.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tc-title">Title</Label>
              <Input
                id="tc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short name for this case"
                required
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tc-folder">Folder</Label>
              <select
                id="tc-folder"
                className={selectClass}
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value={DEFAULT_SECTION_ID}>No folder</option>
                {folderOptions.map(({ section: s, depth }) => (
                  <option key={s.id} value={s.id}>
                    {`${"\u00A0\u00A0".repeat(depth)}${s.name}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Optional—leave as “No folder” or pick a group you created.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="tc-priority">Priority</Label>
                <select
                  id="tc-priority"
                  className={selectClass}
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as TestCasePriority)
                  }
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>
                      {formatTestCaseFieldLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tc-type">Type</Label>
                <select
                  id="tc-type"
                  className={selectClass}
                  value={type}
                  onChange={(e) => setType(e.target.value as TestCaseType)}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {formatTestCaseFieldLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tc-status">Status</Label>
                <select
                  id="tc-status"
                  className={selectClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tc-pre">Preconditions</Label>
              <Textarea
                id="tc-pre"
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                placeholder="Environment, data, or state required before steps"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    setStepRows((r) => [...r, newStep()])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add step
                </Button>
              </div>
              <div className="space-y-3">
                {stepRows.map((row, idx) => (
                  <div
                    key={row._id}
                    className="rounded-md border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Step {idx + 1}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={idx === 0}
                          onClick={() => moveStep(row._id, -1)}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={idx === stepRows.length - 1}
                          onClick={() => moveStep(row._id, 1)}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeStep(row._id)}
                          aria-label="Remove step"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Action"
                      value={row.step}
                      onChange={(e) =>
                        patchStep(row._id, { step: e.target.value })
                      }
                      rows={2}
                    />
                    <Textarea
                      placeholder="Expected result"
                      value={row.expectedResult}
                      onChange={(e) =>
                        patchStep(row._id, {
                          expectedResult: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Custom fields</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setCfRows((r) => [...r, newCfRow()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add field
                </Button>
              </div>
              <div className="space-y-2">
                {cfRows.map((row) => (
                  <div key={row._id} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) =>
                        patchCf(row._id, { key: e.target.value })
                      }
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) =>
                        patchCf(row._id, { value: e.target.value })
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCf(row._id)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {mode === "edit" && testCase ? (
            <TestCaseRunHistorySection
              projectId={projectId}
              caseId={testCase.id}
              enabled={open && mode === "edit"}
            />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting
                ? "Saving…"
                : mode === "create"
                  ? "Create"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
