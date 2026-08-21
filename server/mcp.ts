import type { Express, Request } from "express";
import { createHash } from "node:crypto";
import { executeAppGeneration } from "./appBuilder";
import { getBuilderApiKeyByHash, getGeneratedAppForUser, listGeneratedAppArtifacts, listGeneratedApps, touchBuilderApiKey } from "./db";
import { consumeRateLimit } from "./rateLimit";

type JsonRpcRequest = { id?: string | number | null; method?: string; params?: Record<string, unknown> };

const tools = [
  { name: "generate_app", description: "Generate and persist a React/Node.js application from a plain-English brief.", inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  { name: "list_apps", description: "List the caller's generated applications and their registry status.", inputSchema: { type: "object", properties: {} } },
  { name: "get_app", description: "Retrieve a generated application's metadata and schema registry.", inputSchema: { type: "object", properties: { appId: { type: "string" } }, required: ["appId"] } },
  { name: "get_artifacts", description: "Retrieve the durable artifact links for a generated application.", inputSchema: { type: "object", properties: { appId: { type: "string" } }, required: ["appId"] } },
];

function tokenFromRequest(req: Request) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  const header = req.headers["x-builder-api-key"];
  return Array.isArray(header) ? header[0] : header;
}

function reply(res: any, id: JsonRpcRequest["id"], result?: unknown, error?: { code: number; message: string }) {
  res.status(error ? 400 : 200).json(error ? { jsonrpc: "2.0", id: id ?? null, error } : { jsonrpc: "2.0", id: id ?? null, result });
}

export function registerMcpRoutes(app: Express) {
  app.post("/api/mcp", async (req, res) => {
    const body = (req.body || {}) as JsonRpcRequest;
    const token = tokenFromRequest(req);
    if (!token) return reply(res, body.id, undefined, { code: -32001, message: "A Builder API key is required." });
    const apiKey = await getBuilderApiKeyByHash(createHash("sha256").update(token).digest("hex"));
    if (!apiKey || apiKey.revokedAt) return reply(res, body.id, undefined, { code: -32001, message: "The Builder API key is invalid or revoked." });
    const rate = consumeRateLimit(`mcp:${apiKey.id}`, 60, 60_000);
    if (!rate.allowed) return reply(res, body.id, undefined, { code: -32029, message: "MCP request rate limit reached." });
    await touchBuilderApiKey(apiKey.id);
    try {
      if (body.method === "initialize") return reply(res, body.id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "app-builder-registry", version: "1.0.0" } });
      if (body.method === "tools/list") return reply(res, body.id, { tools });
      if (body.method !== "tools/call") return reply(res, body.id, undefined, { code: -32601, message: "Method not found" });
      const name = String(body.params?.name || "");
      const args = (body.params?.arguments || {}) as Record<string, unknown>;
      if (name === "list_apps") return reply(res, body.id, { content: [{ type: "text", text: JSON.stringify(await listGeneratedApps(apiKey.userId)) }] });
      if (name === "get_app") {
        const record = await getGeneratedAppForUser(String(args.appId || ""), apiKey.userId);
        return reply(res, body.id, { content: [{ type: "text", text: JSON.stringify(record || null) }] });
      }
      if (name === "get_artifacts") {
        const record = await getGeneratedAppForUser(String(args.appId || ""), apiKey.userId);
        if (!record) return reply(res, body.id, { content: [{ type: "text", text: "Application not found" }], isError: true });
        return reply(res, body.id, { content: [{ type: "text", text: JSON.stringify(await listGeneratedAppArtifacts(record.id)) }] });
      }
      if (name === "generate_app") {
        const prompt = String(args.prompt || "").trim();
        if (prompt.length < 10 || prompt.length > 8_000) return reply(res, body.id, undefined, { code: -32602, message: "prompt must be between 10 and 8,000 characters" });
        const appRecord = await executeAppGeneration({ userId: apiKey.userId, prompt });
        return reply(res, body.id, { content: [{ type: "text", text: JSON.stringify(appRecord) }] });
      }
      return reply(res, body.id, undefined, { code: -32602, message: "Unknown tool" });
    } catch (error) {
      return reply(res, body.id, undefined, { code: -32000, message: error instanceof Error ? error.message : "MCP tool execution failed" });
    }
  });
}
