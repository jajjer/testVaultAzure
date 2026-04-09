import cors from "cors";
import express from "express";

import { createBlobRouter } from "./routes/blobRoutes.js";
import { createIntegrationRouter } from "./routes/integrationApi.js";
import { createWebRouter } from "./routes/webApi.js";

export function createApp(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).type("text/plain").send("ok");
  });

  app.use("/api", createWebRouter());
  app.use("/api/v1/projects/:projectId", createIntegrationRouter());
  app.use("/api", createBlobRouter());

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      console.error("[api] unhandled", err);
      res.status(500).json({ error: "Internal error" });
    }
  );

  return app;
}
