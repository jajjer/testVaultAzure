import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";

import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjectStore } from "@/store/project-store";

export function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const loadError = useProjectStore((s) => s.error);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Open a project to manage suites, cases, and runs.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {loadError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              Couldn’t load projects
            </CardTitle>
            <CardDescription className="text-destructive/90">
              {loadError} Check the browser console for details. If you use
              Firestore security rules, redeploy them after changes.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No projects yet</CardTitle>
            <CardDescription>
              Create a project to start organizing test suites and runs.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                      <Link
                        to={`/projects/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {p.description || "No description"}
                    </CardDescription>
                  </div>
                  <FolderKanban className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardHeader>
                <div className="px-6 pb-4">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={`/projects/${p.id}`}>Open</Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
