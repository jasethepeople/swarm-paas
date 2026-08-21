import type { Express } from "express";
import { sdk } from "./_core/sdk";
import { executeAppGeneration, type GenerationEvent } from "./appBuilder";
import { selectableModels, type SelectableModel } from "./appBuilder";
import { consumeRateLimit } from "./rateLimit";

function writeEvent(res: Parameters<Express["post"]>[1] extends never ? never : any, event: GenerationEvent) {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function registerGenerationRoutes(app: Express) {
  app.post("/api/builder/generate", async (req, res) => {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const appId = typeof req.body?.appId === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(req.body.appId) ? req.body.appId : undefined;
    const requestedModel = typeof req.body?.model === "string" && selectableModels.includes(req.body.model as SelectableModel) ? req.body.model as SelectableModel : "gpt-5-mini";
    if (prompt.length < 10 || prompt.length > 8_000) {
      res.status(400).json({ error: "Provide an application brief between 10 and 8,000 characters." });
      return;
    }
    const limit = consumeRateLimit(`generation:${user.id}`, 6, 60_000);
    if (!limit.allowed) {
      res.setHeader("retry-after", Math.ceil((limit.resetsAt - Date.now()) / 1000));
      res.status(429).json({ error: "Generation rate limit reached. Please retry shortly." });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    try {
      await executeAppGeneration({ userId: user.id, prompt, model: requestedModel, appId, onEvent: event => writeEvent(res, event) });
    } catch {
      // The event stream already contains a user-safe error payload.
    } finally {
      res.end();
    }
  });
}
