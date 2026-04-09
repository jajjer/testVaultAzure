import {
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";

import { storageConnectionString } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import * as rbac from "../rbac.js";
import * as repo from "../sqlRepo.js";

const RUN_RESULT_PATH =
  /^runs\/[^/]+\/results\/[^/]+\/.+/;

function parseConnString(cs: string): {
  accountName: string;
  accountKey: string;
} | null {
  const parts = Object.fromEntries(
    cs.split(";").map((p) => {
      const i = p.indexOf("=");
      if (i < 0) return [p, ""];
      return [p.slice(0, i).toLowerCase(), p.slice(i + 1)];
    })
  );
  const accountName = parts["accountname"];
  const accountKey = parts["accountkey"];
  if (!accountName || !accountKey) return null;
  return { accountName, accountKey };
}

async function requireProjectAccess(req: Request, projectId: string) {
  const u = req.authUser!;
  const profile = await repo.upsertUserOnLogin(u.uid, u.email, u.name);
  if (profile.role === "admin") return { profile, ok: true as const };
  const member = await repo.isProjectMember(projectId, profile.uid);
  if (!member) return { ok: false as const };
  return { profile, ok: true as const };
}

export function createBlobRouter(): Router {
  const r = createRouter();
  r.use(authMiddleware);

  /**
   * POST body: { runId, caseId, fileName, contentType }
   * Returns { uploadUrl, blobPath } for client PUT upload.
   */
  r.post(
    "/projects/:projectId/attachments/upload-sas",
    async (req: Request, res: Response) => {
      try {
        if (!storageConnectionString) {
          res.status(503).json({ error: "Blob storage not configured" });
          return;
        }
        const projectId = req.params.projectId as string;
        const gate = await requireProjectAccess(req, projectId);
        if (!gate.ok) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const { profile } = gate;
        const body = req.body as {
          runId?: unknown;
          caseId?: unknown;
          fileName?: unknown;
          contentType?: unknown;
        };
        const runId = typeof body.runId === "string" ? body.runId.trim() : "";
        const caseId =
          typeof body.caseId === "string" ? body.caseId.trim() : "";
        const fileName =
          typeof body.fileName === "string" ? body.fileName.trim() : "";
        if (!runId || !caseId || !fileName) {
          res.status(400).json({ error: "runId, caseId, fileName required" });
          return;
        }

        const safeName = fileName.replace(/[/\\]/g, "_");
        const blobPath = `projects/${projectId}/runs/${runId}/results/${caseId}/${safeName}`;

        const canManage = rbac.canManageQualityContent(profile.role);
        const isTesterPath =
          rbac.canWriteRunResult(profile.role) &&
          RUN_RESULT_PATH.test(
            `runs/${runId}/results/${caseId}/${safeName}`
          );
        if (!canManage && !isTesterPath) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const parsed = parseConnString(storageConnectionString);
        if (!parsed) {
          res.status(500).json({ error: "Invalid storage connection string" });
          return;
        }
        const { accountName, accountKey } = parsed;
        const container = "testvault";
        const cred = new StorageSharedKeyCredential(accountName, accountKey);
        const sas = generateBlobSASQueryParameters(
          {
            containerName: container,
            blobName: blobPath,
            permissions: BlobSASPermissions.parse("cw"),
            startsOn: new Date(Date.now() - 60_000),
            expiresOn: new Date(Date.now() + 15 * 60_000),
            protocol: SASProtocol.Https,
          },
          cred
        ).toString();

        const url = `https://${accountName}.blob.core.windows.net/${container}/${encodeURIComponent(blobPath).replace(/%2F/g, "/")}?${sas}`;
        res.json({
          uploadUrl: url,
          blobPath,
          contentType:
            typeof body.contentType === "string" ? body.contentType : "application/octet-stream",
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to create upload URL" });
      }
    }
  );

  return r;
}
