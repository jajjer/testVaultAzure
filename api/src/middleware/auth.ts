import type { NextFunction, Request, Response } from "express";

import type { EntraUserClaims } from "../auth/verifyEntraJwt.js";
import { verifyBearerToken } from "../auth/verifyEntraJwt.js";
import { skipAuth } from "../config.js";

const DEV_HEADER = "x-testvault-dev-user";

export type AuthUser = EntraUserClaims;

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
  }
}

function parseDevUserHeader(req: Request): AuthUser | null {
  const raw = req.headers[DEV_HEADER];
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as {
      uid?: string;
      email?: string;
      displayName?: string;
    };
    if (!o.uid || !o.email) return null;
    return {
      uid: o.uid,
      email: o.email,
      name: o.displayName ?? o.email.split("@")[0] ?? "Dev User",
    };
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (skipAuth) {
    const dev = parseDevUserHeader(req);
    if (dev) {
      req.authUser = dev;
      next();
      return;
    }
    res.status(401).json({
      error: "SKIP_AUTH is on: send X-TestVault-Dev-User JSON header",
    });
    return;
  }

  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = h.slice(7).trim();
  try {
    req.authUser = await verifyBearerToken(token);
    next();
  } catch (e) {
    console.error("[auth] JWT verify failed", e);
    res.status(401).json({ error: "Invalid token" });
  }
}
