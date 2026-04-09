import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canManageContent, useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const account = useAuthStore((s) => s.account);
  const createProject = useProjectStore((s) => s.createProject);
  const navigate = useNavigate();

  const canCreate =
    profile && account && canManageContent(profile.role);

  if (!canCreate) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !profile) return;
    setSubmitting(true);
    try {
      const id = await createProject({
        name: name.trim(),
        description: description.trim(),
        owner: {
          uid: account.localAccountId,
          email: profile.email,
          role: profile.role,
        },
      });
      setOpen(false);
      setName("");
      setDescription("");
      void navigate(`/projects/${id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Projects group suites, test cases, and runs for a product or team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Patient Portal"
                required
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context for your team"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
