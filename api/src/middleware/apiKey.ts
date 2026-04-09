import * as crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import * as repo from "../sqlRepo.js";

export function hashApiKey(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

function extractBearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1]!.trim() : undefined;
}

export function createApiKeyMiddleware() {
  return async function apiKeyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const projectId = req.params.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ error: "Missing projectId" });
      return;
    }

    const raw =
      extractBearer(req) ??
      (typeof req.headers["x-testvault-api-key"] === "string"
        ? req.headers["x-testvault-api-key"].trim()
        : undefined);

    if (!raw) {
      res.status(401).json({
        error: "Missing API key",
        hint: "Send Authorization: Bearer <key> or X-TestVault-Api-Key",
      });
      return;
    }

    const keyHash = hashApiKey(raw);
    const pid = await repo.getApiKeyProject(keyHash);
    if (!pid) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    if (pid !== projectId) {
      res.status(403).json({
        error: "API key is not authorized for this project",
      });
      return;
    }

    next();
  };
}
