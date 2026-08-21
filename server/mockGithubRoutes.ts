import type { Express } from "express";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { getGeneratedAppForUser, listGeneratedAppArtifacts } from "./db";
import { consumeSharedRateLimit } from "./db";

export function registerMockGithubRoutes(app: Express) {
  app.post("/api/mock-github/repos/:owner/:repository/push", async (req, res) => {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const appId = typeof req.body?.appId === "string" ? req.body.appId : "";
    if (!appId) return res.status(400).json({ error: "appId is required" });
    const rate = await consumeSharedRateLimit(`mock-github:${user.id}`, 30, 60_000).catch(() => null);
    if (!rate?.allowed) return res.status(429).json({ error: "Mock GitHub push rate limit reached" });
    const generatedApp = await getGeneratedAppForUser(appId, user.id);
    if (!generatedApp) return res.status(404).json({ error: "Application not found" });
    const artifacts = await listGeneratedAppArtifacts(appId);
    const zip = artifacts.find(artifact => artifact.kind === "zip_export");
    if (!zip) return res.status(409).json({ error: "An export artifact is not yet available" });
    const owner = String(req.params.owner || "workspace").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 64) || "workspace";
    const repository = String(req.params.repository || "generated-app").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 100) || "generated-app";
    const commit = nanoid(12).toLowerCase();
    return res.status(201).json({
      mock: true,
      repository: `${owner}/${repository}`,
      branch: "main",
      commit,
      sourceArtifact: zip.storageUrl,
      htmlUrl: `https://github.example/${owner}/${repository}/commit/${commit}`,
      message: "Mock GitHub accepted the generated source bundle.",
    });
  });
}
