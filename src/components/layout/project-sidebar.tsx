import { NavLink, useParams } from "react-router-dom";
import { LayoutDashboard, ListChecks, PlayCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const nav = [
  { to: "", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "test-cases", label: "Test Cases", icon: ListChecks, end: false },
  { to: "runs", label: "Runs", icon: PlayCircle, end: false },
] as const;

export function ProjectSidebar({ projectName }: { projectName: string }) {
  const { projectId } = useParams<{ projectId: string }>();
  const base = `/projects/${projectId ?? ""}`;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Project
        </p>
        <p className="mt-1 truncate font-semibold leading-tight" title={projectName}>
          {projectName}
        </p>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to === "" ? base : `${base}/${to}`}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
