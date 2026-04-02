import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import type { ProjectDoc, ProjectParameter } from "@/types/models";
import { useProjectStore } from "@/store/project-store";

type Row = ProjectParameter & { _localId: string };

function newRow(): Row {
  return { _localId: crypto.randomUUID(), key: "", value: "" };
}

function toRows(params: ProjectParameter[]): Row[] {
  if (params.length === 0) return [newRow()];
  return params.map((p) => ({
    ...p,
    _localId: crypto.randomUUID(),
  }));
}

function rowsToParams(rows: Row[]): ProjectParameter[] {
  return rows
    .map(({ key, value }) => ({
      key: key.trim(),
      value: value.trim(),
    }))
    .filter((p) => p.key.length > 0 || p.value.length > 0);
}

interface EditProjectDialogProps {
  project: ProjectDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: EditProjectDialogProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [rows, setRows] = useState<Row[]>(() => toRows(project.parameters));
  const [submitting, setSubmitting] = useState(false);
  const updateProject = useProjectStore((s) => s.updateProject);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setName(project.name);
      setDescription(project.description);
      setRows(toRows(project.parameters));
    }
    prevOpenRef.current = open;
  }, [open, project]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await updateProject(project.id, {
        name: trimmed,
        description: description.trim(),
        parameters: rowsToParams(rows),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function addRow() {
    setRows((r) => [...r, newRow()]);
  }

  function removeRow(localId: string) {
    setRows((r) => {
      const next = r.filter((row) => row._localId !== localId);
      return next.length === 0 ? [newRow()] : next;
    });
  }

  function patchRow(localId: string, patch: Partial<Pick<Row, "key" | "value">>) {
    setRows((r) =>
      r.map((row) => (row._localId === localId ? { ...row, ...patch } : row))
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update the name, description, and optional parameters for this
              project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-name">Name</Label>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-project-desc">Description</Label>
              <Textarea
                id="edit-project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Parameters</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={addRow}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Key/value pairs for things like environment, product version,
                or team code. Empty rows are ignored when you save.
              </p>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row._localId}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) =>
                        patchRow(row._localId, { key: e.target.value })
                      }
                      className="flex-1"
                      autoComplete="off"
                    />
                    <Input
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) =>
                        patchRow(row._localId, { value: e.target.value })
                      }
                      className="flex-1"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row._localId)}
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
