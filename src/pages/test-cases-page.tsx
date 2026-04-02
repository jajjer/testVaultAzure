import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  FolderSidebar,
  type FolderFilter,
} from "@/features/testcases/folder-sidebar";
import { folderPathLabel } from "@/lib/folder-label";
import {
  dndCaseDragId,
  parseCaseDragId,
  parseFolderDropId,
} from "@/lib/test-case-dnd";
import { TestCaseDialog } from "@/features/testcases/test-case-dialog";
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
import { DEFAULT_SECTION_ID } from "@/lib/test-case-defaults";
import { formatTestCaseRef } from "@/lib/test-case-display";
import { cn } from "@/lib/utils";
import { canManageContent, useAuthStore } from "@/store/auth-store";
import { useSectionStore } from "@/store/section-store";
import { useTestCaseStore } from "@/store/test-case-store";
import type { SectionDoc, TestCaseDoc, TestCasePriority } from "@/types/models";

function priorityStyles(p: TestCasePriority) {
  switch (p) {
    case "critical":
      return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
    case "high":
      return "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200";
    case "medium":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }
}

function label(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function filterCases(
  cases: TestCaseDoc[],
  folderFilter: FolderFilter
): TestCaseDoc[] {
  if (folderFilter === "all") return cases;
  if (folderFilter === "unfiled") {
    return cases.filter((c) => c.sectionId === DEFAULT_SECTION_ID);
  }
  return cases.filter((c) => c.sectionId === folderFilter);
}

function createInitialSectionId(folderFilter: FolderFilter): string {
  if (folderFilter === "all" || folderFilter === "unfiled") {
    return DEFAULT_SECTION_ID;
  }
  return folderFilter;
}

export function TestCasesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useTestCasesSync(projectId);
  useSectionsSync(projectId);

  const cases = useTestCaseStore((s) => s.cases);
  const loading = useTestCaseStore((s) => s.loading);
  const deleteTestCase = useTestCaseStore((s) => s.deleteTestCase);
  const moveTestCaseToFolder = useTestCaseStore((s) => s.moveTestCaseToFolder);
  const sections = useSectionStore((s) => s.sections);
  const profile = useAuthStore((s) => s.profile);

  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TestCaseDoc | null>(null);

  const canWrite = profile && canManageContent(profile.role);

  const filtered = useMemo(
    () => filterCases(cases, folderFilter),
    [cases, folderFilter]
  );

  const initialSectionId = useMemo(
    () => createInitialSectionId(folderFilter),
    [folderFilter]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!projectId || !over) return;
    const caseId = parseCaseDragId(active.id);
    const targetSection = parseFolderDropId(over.id);
    if (!caseId || targetSection === null) return;
    const tc = cases.find((x) => x.id === caseId);
    if (!tc || tc.sectionId === targetSection) return;
    void moveTestCaseToFolder(projectId, caseId, targetSection);
  }

  async function onDelete(c: TestCaseDoc) {
    if (!projectId) return;
    const ok = window.confirm(
      `Delete ${formatTestCaseRef(c.caseNumber)} “${c.title}”? This cannot be undone.`
    );
    if (!ok) return;
    await deleteTestCase(projectId, c.id);
  }

  if (!projectId) {
    return (
      <p className="text-sm text-muted-foreground">Missing project.</p>
    );
  }

  const showFolderColumn = folderFilter === "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test cases</h1>
          <p className="text-sm text-muted-foreground">
            Organize with nested folders. Drag a case by the grip onto a folder,
            or set the folder when editing.
          </p>
        </div>
        {canWrite ? (
          <>
            <Button
              className="shrink-0 gap-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New test case
            </Button>
            <TestCaseDialog
              projectId={projectId}
              mode="create"
              testCase={null}
              open={createOpen}
              onOpenChange={setCreateOpen}
              initialSectionId={initialSectionId}
            />
            {editing ? (
              <TestCaseDialog
                key={editing.id}
                projectId={projectId}
                mode="edit"
                testCase={editing}
                open
                onOpenChange={(o) => {
                  if (!o) setEditing(null);
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex min-h-[280px] flex-col gap-8 md:flex-row md:gap-10">
          <FolderSidebar
            projectId={projectId}
            selected={folderFilter}
            onSelect={setFolderFilter}
            canWrite={!!canWrite}
          />
          <div className="min-w-0 flex-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading test cases…</p>
          ) : cases.length === 0 ? (
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">No test cases yet</CardTitle>
                <CardDescription>
                  {canWrite
                    ? "Create tests here. Folders are optional."
                    : "No cases have been added to this project yet."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing matches this filter. Try another or add a test.
            </p>
          ) : (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        {canWrite ? (
                          <th
                            className="w-10 px-1 py-3 font-medium"
                            aria-label="Drag to folder"
                          />
                        ) : null}
                        {showFolderColumn ? (
                          <th className="px-4 py-3 font-medium min-w-[100px]">
                            Folder
                          </th>
                        ) : null}
                        <th className="px-4 py-3 font-medium w-[88px]">ID</th>
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Priority</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium w-[120px]">
                          Steps
                        </th>
                        {canWrite ? (
                          <th className="px-4 py-3 font-medium w-[100px] text-right">
                            Actions
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <TestCaseTableRow
                          key={c.id}
                          testCase={c}
                          showFolderColumn={showFolderColumn}
                          sections={sections}
                          canWrite={!!canWrite}
                          onEdit={() => setEditing(c)}
                          onDelete={() => void onDelete(c)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </DndContext>
    </div>
  );
}

function TestCaseTableRow({
  testCase: c,
  showFolderColumn,
  sections,
  canWrite,
  onEdit,
  onDelete,
}: {
  testCase: TestCaseDoc;
  showFolderColumn: boolean;
  sections: SectionDoc[];
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dndCaseDragId(c.id),
    disabled: !canWrite,
  });

  return (
    <tr
      ref={setNodeRef}
      className={cn(
        "border-b border-border/60 last:border-0",
        isDragging && "opacity-50"
      )}
    >
      {canWrite ? (
        <td className="px-1 py-3 align-middle">
          <button
            type="button"
            className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag ${c.title} to a folder`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </td>
      ) : null}
      {showFolderColumn ? (
        <td className="px-4 py-3 text-muted-foreground">
          {folderPathLabel(c.sectionId, sections)}
        </td>
      ) : null}
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-medium tabular-nums text-foreground">
          {formatTestCaseRef(c.caseNumber)}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-foreground">{c.title}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            priorityStyles(c.priority)
          )}
        >
          {label(c.priority)}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{label(c.type)}</td>
      <td className="px-4 py-3 text-muted-foreground">{label(c.status)}</td>
      <td className="px-4 py-3 text-muted-foreground tabular-nums">
        {c.steps.length}
      </td>
      {canWrite ? (
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label={`Edit ${c.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => void onDelete()}
              aria-label={`Delete ${c.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}
