import { useDroppable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Folder, FolderPlus, LayoutGrid, Trash2 } from "lucide-react";

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
import { buildSectionTree, type SectionTreeNode } from "@/lib/section-tree";
import { DND_DROP_UNFILED, dndDropFolderId } from "@/lib/test-case-dnd";
import { cn } from "@/lib/utils";
import { useSectionStore } from "@/store/section-store";
import type { SectionDoc } from "@/types/models";

export type FolderFilter = "all" | "unfiled" | string;

interface FolderSidebarProps {
  projectId: string;
  selected: FolderFilter;
  onSelect: (filter: FolderFilter) => void;
  canWrite: boolean;
}

function UnfiledDropRow({
  selected,
  onSelect,
  itemClass,
}: {
  selected: boolean;
  onSelect: () => void;
  itemClass: (active: boolean) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: DND_DROP_UNFILED });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        itemClass(selected),
        isOver && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
      )}
      onClick={onSelect}
    >
      <Folder className="h-4 w-4 shrink-0 opacity-70" />
      No folder
    </button>
  );
}

function FolderTreeRow({
  node,
  depth,
  folderFilter,
  onSelect,
  onDelete,
  onAddSubfolder,
  canWrite,
  itemClass,
}: {
  node: SectionTreeNode;
  depth: number;
  folderFilter: FolderFilter;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onAddSubfolder: (parent: SectionDoc) => void;
  canWrite: boolean;
  itemClass: (active: boolean) => string;
}) {
  const s = node.section;
  const selected = folderFilter === s.id;
  const dropId = dndDropFolderId(s.id);
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div
      className="flex flex-col gap-0.5"
      style={{ paddingLeft: depth > 0 ? depth * 10 : undefined }}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "group flex min-w-0 items-center gap-0.5 rounded-md",
          isOver && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
        )}
      >
        <button
          type="button"
          className={cn(itemClass(selected), "min-w-0 flex-1")}
          onClick={() => onSelect(s.id)}
        >
          <Folder className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{s.name}</span>
        </button>
        {canWrite ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 hover:text-foreground group-hover:opacity-100"
              onClick={() => onAddSubfolder(s)}
              aria-label={`Add subfolder under ${s.name}`}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 hover:text-destructive group-hover:opacity-100"
              onClick={() => void onDelete(s.id, s.name)}
              aria-label={`Delete folder ${s.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
      </div>
      {node.children.map((child) => (
        <FolderTreeRow
          key={child.section.id}
          node={child}
          depth={depth + 1}
          folderFilter={folderFilter}
          onSelect={onSelect}
          onDelete={onDelete}
          onAddSubfolder={onAddSubfolder}
          canWrite={canWrite}
          itemClass={itemClass}
        />
      ))}
    </div>
  );
}

export function FolderSidebar({
  projectId,
  selected,
  onSelect,
  canWrite,
}: FolderSidebarProps) {
  const sections = useSectionStore((s) => s.sections);
  const loading = useSectionStore((s) => s.loading);
  const createFolder = useSectionStore((s) => s.createFolder);
  const deleteFolder = useSectionStore((s) => s.deleteFolder);

  const tree = useMemo(() => buildSectionTree(sections), [sections]);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openNewFolder(parentId: string | null) {
    setNewParentId(parentId);
    setNewName("");
    setNewOpen(true);
  }

  async function onCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await createFolder(projectId, name, newParentId);
      setNewOpen(false);
      setNewName("");
      setNewParentId(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteFolder(sectionId: string, name: string) {
    const ok = window.confirm(
      `Delete folder “${name}”? Subfolders move up one level. Tests in this folder go to “No folder”.`
    );
    if (!ok) return;
    await deleteFolder(projectId, sectionId);
    if (selected === sectionId) {
      onSelect("unfiled");
    }
  }

  const item = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
      active
        ? "bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    );

  const parentName =
    newParentId == null
      ? null
      : sections.find((s) => s.id === newParentId)?.name ?? null;

  return (
    <>
      <aside className="flex w-full shrink-0 flex-col gap-3 md:w-52">
        <p className="text-sm font-medium text-foreground">Show</p>
        <nav className="flex flex-col gap-0.5">
          <button
            type="button"
            className={item(selected === "all")}
            onClick={() => onSelect("all")}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-70" />
            All tests
          </button>
          <UnfiledDropRow
            selected={selected === "unfiled"}
            onSelect={() => onSelect("unfiled")}
            itemClass={item}
          />
          {loading ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Loading…</p>
          ) : (
            tree.map((node) => (
              <FolderTreeRow
                key={node.section.id}
                node={node}
                depth={0}
                folderFilter={selected}
                onSelect={(id) => onSelect(id)}
                onDelete={onDeleteFolder}
                onAddSubfolder={(parent) => openNewFolder(parent.id)}
                canWrite={canWrite}
                itemClass={item}
              />
            ))
          )}
        </nav>
        {canWrite ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-center"
            onClick={() => openNewFolder(null)}
          >
            Add folder
          </Button>
        ) : null}
      </aside>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={(e) => void onCreateFolder(e)}>
            <DialogHeader>
              <DialogTitle>
                {newParentId ? "New subfolder" : "New folder"}
              </DialogTitle>
              <DialogDescription>
                {newParentId && parentName ? (
                  <span className="block">
                    Inside “{parentName}”. You can also drag tests onto a folder
                    in the list.
                  </span>
                ) : (
                  <span className="block">
                    Name a group, assign tests by dragging them here, or set a
                    folder when you edit a case.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Smoke, Login"
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !newName.trim()}>
                {submitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
