import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folder } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTestCaseRef } from "@/lib/test-case-display";
import {
  buildSectionTree,
  caseIdsForFolderSubtree,
  caseIdsForNoFolder,
  folderCheckState,
  type SectionTreeNode,
} from "@/lib/section-tree";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useSectionStore } from "@/store/section-store";
import { useTestCaseStore } from "@/store/test-case-store";
import { useTestRunStore } from "@/store/test-run-store";
import type { RunStatus, SectionDoc, TestCaseDoc, TestRunDoc } from "@/types/models";

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

const RUN_STATUSES: RunStatus[] = ["active", "completed", "archived"];

interface NewRunDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this run instead of creating a new one. */
  editingRun?: TestRunDoc | null;
}

function sortCases(cases: TestCaseDoc[]): TestCaseDoc[] {
  return [...cases].sort((a, b) => {
    const an = a.caseNumber || 999999;
    const bn = b.caseNumber || 999999;
    if (an !== bn) return an - bn;
    return a.title.localeCompare(b.title);
  });
}

function statusLabel(s: RunStatus) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FolderCheckboxRow({
  label,
  caseIds,
  selected,
  onToggle,
  depth,
}: {
  label: string;
  caseIds: string[];
  selected: Set<string>;
  onToggle: () => void;
  depth: number;
}) {
  const state = folderCheckState(caseIds, selected);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) el.indeterminate = state === "some";
  }, [state]);

  const disabled = caseIds.length === 0;
  const checked = state === "all";

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-sm hover:bg-muted/80",
        disabled && "cursor-not-allowed opacity-50"
      )}
      style={{ paddingLeft: 10 + depth * 14 }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-input"
        checked={checked}
        disabled={disabled}
        onChange={() => {
          if (!disabled) onToggle();
        }}
      />
      <Folder className="h-4 w-4 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {caseIds.length}
      </span>
    </label>
  );
}

function FolderSubtree({
  nodes,
  depth,
  cases,
  sections,
  selected,
  toggleCaseIds,
}: {
  nodes: SectionTreeNode[];
  depth: number;
  cases: TestCaseDoc[];
  sections: SectionDoc[];
  selected: Set<string>;
  toggleCaseIds: (ids: string[]) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const ids = caseIdsForFolderSubtree(node.section.id, cases, sections);
        return (
          <div key={node.section.id}>
            <FolderCheckboxRow
              label={node.section.name}
              caseIds={ids}
              selected={selected}
              depth={depth}
              onToggle={() => toggleCaseIds(ids)}
            />
            {node.children.length > 0 ? (
              <FolderSubtree
                nodes={node.children}
                depth={depth + 1}
                cases={cases}
                sections={sections}
                selected={selected}
                toggleCaseIds={toggleCaseIds}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function NewRunDialog({
  projectId,
  open,
  onOpenChange,
  editingRun = null,
}: NewRunDialogProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<RunStatus>("active");
  const [submitting, setSubmitting] = useState(false);

  const cases = useTestCaseStore((s) => s.cases);
  const casesLoading = useTestCaseStore((s) => s.loading);
  const sections = useSectionStore((s) => s.sections);
  const sectionsLoading = useSectionStore((s) => s.loading);
  const createRun = useTestRunStore((s) => s.createRun);
  const updateRun = useTestRunStore((s) => s.updateRun);
  const account = useAuthStore((s) => s.account);
  const wasOpenRef = useRef(false);

  const isEdit = editingRun != null;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      if (editingRun) {
        setName(editingRun.name);
        setSelected(new Set(editingRun.caseIds));
        setStatus(editingRun.status);
      } else {
        setName("");
        setSelected(new Set());
        setStatus("active");
      }
    }
    wasOpenRef.current = open;
  }, [open, editingRun]);

  const sorted = sortCases(cases);
  const sectionTree = useMemo(() => buildSectionTree(sections), [sections]);
  const noFolderCaseIds = useMemo(
    () => caseIdsForNoFolder(sorted),
    [sorted]
  );

  const toggleCaseIds = useCallback((caseIds: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const all =
        caseIds.length > 0 && caseIds.every((id) => next.has(id));
      if (all) caseIds.forEach((id) => next.delete(id));
      else caseIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(sorted.map((c) => c.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const caseIds = Array.from(selected);
    if (!trimmed || caseIds.length === 0) return;

    if (isEdit && editingRun) {
      setSubmitting(true);
      try {
        await updateRun(projectId, editingRun.id, {
          name: trimmed,
          caseIds,
          status,
        });
        onOpenChange(false);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!account?.localAccountId) return;

    setSubmitting(true);
    try {
      await createRun(projectId, {
        name: trimmed,
        caseIds,
        createdBy: account.localAccountId,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const foldersReady = !sectionsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-xl">
        <form
          className="flex min-h-0 flex-col gap-0"
          onSubmit={(e) => void onSubmit(e)}
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit test run" : "New test run"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Change the name, status, or which cases are in this run. Removing a case deletes its recorded results for this run."
                : "Pick folders to bulk-select tests (including subfolders), then refine the list below if needed."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2 px-1 pt-1">
              <Label htmlFor="run-name">Run name</Label>
              <Input
                id="run-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sprint 14 regression"
                required
                autoComplete="off"
              />
            </div>

            {isEdit ? (
              <div className="grid gap-2 px-1">
                <Label htmlFor="run-status">Status</Label>
                <select
                  id="run-status"
                  className={selectClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RunStatus)}
                >
                  {RUN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Folders</Label>
              <p className="text-xs text-muted-foreground">
                Checking a folder adds every test in that folder and nested
                subfolders. Uncheck to remove them. The number shows how many
                tests are in that folder tree.
              </p>
              {!foldersReady ? (
                <p className="text-sm text-muted-foreground">
                  Loading folders…
                </p>
              ) : (
                <ScrollArea className="h-[min(200px,28vh)] rounded-md border">
                  <div className="p-2">
                    <FolderCheckboxRow
                      label="No folder"
                      caseIds={noFolderCaseIds}
                      selected={selected}
                      depth={0}
                      onToggle={() => toggleCaseIds(noFolderCaseIds)}
                    />
                    <FolderSubtree
                      nodes={sectionTree}
                      depth={0}
                      cases={sorted}
                      sections={sections}
                      selected={selected}
                      toggleCaseIds={toggleCaseIds}
                    />
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Tests (individual)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={selectAll}
                    disabled={sorted.length === 0}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={clearSelection}
                    disabled={selected.size === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              {casesLoading ? (
                <p className="text-sm text-muted-foreground">Loading cases…</p>
              ) : sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add test cases in the Test cases tab before creating a run.
                </p>
              ) : (
                <ScrollArea className="h-[min(280px,40vh)] rounded-md border">
                  <ul className="divide-y p-2">
                    {sorted.map((c) => {
                      const checked = selected.has(c.id);
                      return (
                        <li key={c.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/80",
                              checked && "bg-muted/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-input"
                              checked={checked}
                              onChange={() => toggle(c.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-mono text-xs font-medium text-muted-foreground">
                                {formatTestCaseRef(c.caseNumber)}
                              </span>{" "}
                              <span className="text-foreground">{c.title}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
              <p className="text-xs text-muted-foreground">
                {selected.size} of {sorted.length} selected
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                !name.trim() ||
                selected.size === 0 ||
                sorted.length === 0
              }
            >
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
