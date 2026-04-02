import { useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil } from "lucide-react";

import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canManageContent, useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const profile = useAuthStore((s) => s.profile);
  const [editOpen, setEditOpen] = useState(false);

  const name = project?.name ?? "Loading…";
  const canEdit =
    project && profile && canManageContent(profile.role);

  const parameters = project?.parameters ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">Overview</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Dashboard metrics (run progress, pass rate, activity) will appear
            here.
          </p>
        </div>
        {canEdit && project ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Edit project
            </Button>
            <EditProjectDialog
              project={project}
              open={editOpen}
              onOpenChange={setEditOpen}
            />
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {project?.description?.trim()
              ? project.description
              : "No description."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          {parameters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No parameters yet. Use Edit project to add key/value metadata.
            </p>
          ) : (
            <dl className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-x-4">
              {parameters.map((p, i) => (
                <div
                  key={`${p.key}-${i}`}
                  className="contents"
                >
                  <dt className="border-b border-border pb-2 text-sm font-medium text-foreground sm:border-0 sm:pb-0">
                    {p.key}
                  </dt>
                  <dd className="pb-3 text-sm text-muted-foreground sm:pb-2">
                    {p.value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
