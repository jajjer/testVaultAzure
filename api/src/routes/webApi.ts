import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";

import { authMiddleware } from "../middleware/auth.js";
import * as rbac from "../rbac.js";
import * as repo from "../sqlRepo.js";
async function getProfile(req: Request) {
  const u = req.authUser!;
  return repo.upsertUserOnLogin(u.uid, u.email, u.name);
}

async function requireProjectAccess(
  req: Request,
  projectId: string
): Promise<{ profile: Awaited<ReturnType<typeof getProfile>>; ok: true } | { ok: false; status: number; body: unknown }> {
  const profile = await getProfile(req);
  if (profile.role === "admin") return { profile, ok: true };
  const member = await repo.isProjectMember(projectId, profile.uid);
  if (!member) {
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }
  return { profile, ok: true };
}

export function createWebRouter(): Router {
  const r = createRouter();
  r.use(authMiddleware);

  r.get("/me", async (req: Request, res: Response) => {
    try {
      const profile = await getProfile(req);
      res.json(profile);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });

  r.get("/projects", async (req: Request, res: Response) => {
    try {
      const profile = await getProfile(req);
      const projects = await repo.listProjectsForUser(profile.uid, profile.role);
      res.json(projects);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to list projects" });
    }
  });

  r.post("/projects", async (req: Request, res: Response) => {
    try {
      const profile = await getProfile(req);
      if (!rbac.canManageQualityContent(profile.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = req.body as { name?: unknown; description?: unknown };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const id = await repo.createProject({
        name,
        description,
        owner: {
          uid: profile.uid,
          email: profile.email,
          role: profile.role,
        },
      });
      res.status(201).json({ id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  r.patch("/projects/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      if (!rbac.canManageQualityContent(gate.profile.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = req.body as {
        name?: unknown;
        description?: unknown;
        parameters?: unknown;
        testCasePriorityOptions?: unknown;
        testCaseTypeOptions?: unknown;
      };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const parameters = Array.isArray(body.parameters) ? body.parameters : [];
      await repo.updateProject(projectId, {
        name,
        description,
        parameters: parameters as { key: string; value: string }[],
        testCasePriorityOptions:
          body.testCasePriorityOptions === undefined
            ? undefined
            : (body.testCasePriorityOptions as string[]),
        testCaseTypeOptions:
          body.testCaseTypeOptions === undefined
            ? undefined
            : (body.testCaseTypeOptions as string[]),
      });
      const doc = await repo.loadProjectDoc(projectId);
      res.json(doc);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  r.get("/projects/:projectId/test-cases", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      const cases = await repo.listTestCases(projectId);
      res.json(cases);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load test cases" });
    }
  });

  r.post("/projects/:projectId/test-cases", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      if (!rbac.canManageQualityContent(gate.profile.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const id = await repo.createTestCase(projectId, {
        title: String(body.title ?? ""),
        preconditions: String(body.preconditions ?? ""),
        steps: body.steps,
        priority: String(body.priority ?? "medium"),
        type: String(body.type ?? "functional"),
        status: String(body.status ?? "draft"),
        customFields:
          body.customFields && typeof body.customFields === "object"
            ? (body.customFields as Record<string, unknown>)
            : {},
        sectionId: String(body.sectionId ?? "default"),
        createdBy: gate.profile.uid,
        order:
          typeof body.order === "number" && body.order >= 0
            ? body.order
            : undefined,
      });
      res.status(201).json({ id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create test case" });
    }
  });

  r.patch(
    "/projects/:projectId/test-cases/:caseId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const caseId = req.params.caseId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canManageQualityContent(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const body = req.body as Record<string, unknown>;
        await repo.updateTestCase(projectId, caseId, {
          title: String(body.title ?? ""),
          preconditions: String(body.preconditions ?? ""),
          steps: body.steps,
          priority: String(body.priority ?? "medium"),
          type: String(body.type ?? "functional"),
          status: String(body.status ?? "draft"),
          customFields:
            body.customFields && typeof body.customFields === "object"
              ? (body.customFields as Record<string, unknown>)
              : {},
          sectionId: String(body.sectionId ?? "default"),
          order: Number(body.order ?? 0),
        });
        res.json({ ok: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to update test case" });
      }
    }
  );

  r.delete(
    "/projects/:projectId/test-cases/:caseId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const caseId = req.params.caseId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canManageQualityContent(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        await repo.deleteTestCase(projectId, caseId);
        res.json({ ok: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to delete test case" });
      }
    }
  );

  r.get("/projects/:projectId/sections", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      const sections = await repo.listSections(projectId);
      res.json(sections);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load sections" });
    }
  });

  r.post("/projects/:projectId/sections", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      if (!rbac.canManageQualityContent(gate.profile.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = req.body as {
        name?: unknown;
        parentSectionId?: unknown;
        order?: unknown;
      };
      const name = typeof body.name === "string" ? body.name : "";
      const parentSectionId =
        body.parentSectionId === null || body.parentSectionId === undefined
          ? null
          : String(body.parentSectionId);
      const order =
        typeof body.order === "number" && body.order >= 0 ? body.order : 0;
      const id = await repo.createSection(projectId, {
        name,
        parentSectionId,
        order,
      });
      res.status(201).json({ id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create section" });
    }
  });

  r.patch(
    "/projects/:projectId/sections/:sectionId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const sectionId = req.params.sectionId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canManageQualityContent(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const body = req.body as { name?: unknown };
        const name = typeof body.name === "string" ? body.name : "";
        await repo.updateSectionName(projectId, sectionId, name);
        res.json({ ok: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to update section" });
      }
    }
  );

  r.delete(
    "/projects/:projectId/sections/:sectionId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const sectionId = req.params.sectionId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canManageQualityContent(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        await repo.deleteSectionCascade(projectId, sectionId);
        res.json({ ok: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to delete section" });
      }
    }
  );

  r.get("/projects/:projectId/runs", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      const runs = await repo.listRuns(projectId);
      res.json(runs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load runs" });
    }
  });

  r.post("/projects/:projectId/runs", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      if (!rbac.canManageQualityContent(gate.profile.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = req.body as { name?: unknown; caseIds?: unknown };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const caseIds = Array.isArray(body.caseIds)
        ? (body.caseIds as unknown[]).map((x) => String(x))
        : [];
      if (!name || caseIds.length === 0) {
        res.status(400).json({ error: "name and caseIds required" });
        return;
      }
      const id = await repo.createTestRun(projectId, {
        name,
        caseIds,
        createdBy: gate.profile.uid,
      });
      res.status(201).json({ id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create run" });
    }
  });

  r.patch(
    "/projects/:projectId/runs/:runId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const runId = req.params.runId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canManageQualityContent(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const body = req.body as {
          name?: unknown;
          caseIds?: unknown;
          status?: unknown;
        };
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const caseIds = Array.isArray(body.caseIds)
          ? (body.caseIds as unknown[]).map((x) => String(x))
          : [];
        const status = String(body.status ?? "active");
        if (!name) {
          res.status(400).json({ error: "name required" });
          return;
        }
        await repo.updateRun(projectId, runId, { name, caseIds, status });
        res.json({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not found")) {
          res.status(404).json({ error: msg });
          return;
        }
        console.error(e);
        res.status(500).json({ error: "Failed to update run" });
      }
    }
  );

  r.delete(
    "/projects/:projectId/runs/:runId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const runId = req.params.runId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canManageQualityContent(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        await repo.deleteRun(projectId, runId);
        res.json({ ok: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to delete run" });
      }
    }
  );

  r.get(
    "/projects/:projectId/runs/:runId/results",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const runId = req.params.runId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        const results = await repo.listResults(projectId, runId);
        res.json(results);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to load results" });
      }
    }
  );

  r.put(
    "/projects/:projectId/runs/:runId/results/:caseId",
    async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId as string;
        const runId = req.params.runId as string;
        const caseId = req.params.caseId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(gate.status).json(gate.body);
          return;
        }
        if (!rbac.canWriteRunResult(gate.profile.role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const OUTCOMES = new Set([
          "passed",
          "failed",
          "blocked",
          "skipped",
          "retest",
        ]);
        const body = req.body as { outcome?: unknown };
        const oc = body.outcome;
        const outcome =
          oc === null
            ? null
            : typeof oc === "string" && OUTCOMES.has(oc)
              ? oc
              : null;
        if (oc !== null && oc !== undefined && outcome === null) {
          res.status(400).json({ error: "Invalid outcome" });
          return;
        }
        await repo.setRunResult(projectId, runId, caseId, {
          outcome,
          executedByUid:
            outcome !== null ? gate.profile.uid : null,
        });
        res.json({ ok: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to save result" });
      }
    }
  );

  r.post("/projects/:projectId/suites/ensure-default", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const gate = await requireProjectAccess(req, projectId);
      if (!gate.ok) {
        res.status(gate.status).json(gate.body);
        return;
      }
      await repo.ensureDefaultSuite(projectId);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed" });
    }
  });

  return r;
}
