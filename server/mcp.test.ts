import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getBuilderApiKeyByHash: vi.fn().mockResolvedValue({ id: "key-1", userId: 42, revokedAt: null }),
  touchBuilderApiKey: vi.fn().mockResolvedValue(undefined),
  listGeneratedApps: vi.fn().mockResolvedValue([{ id: "app-1", name: "Registry App", status: "ready" }]),
  getGeneratedAppForUser: vi.fn(),
  listGeneratedAppArtifacts: vi.fn(),
}));
vi.mock("./rateLimit", () => ({ consumeRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 59, resetsAt: Date.now() + 60_000 }) }));
vi.mock("./appBuilder", () => ({ executeAppGeneration: vi.fn() }));

import { registerMcpRoutes } from "./mcp";

type Handler = (req: any, res: any) => Promise<unknown>;

function routeHarness() {
  const handlers = new Map<string, Handler>();
  registerMcpRoutes({ post: (path: string, handler: Handler) => { handlers.set(path, handler); } } as any);
  const handler = handlers.get("/api/mcp");
  if (!handler) throw new Error("MCP route was not registered");
  return handler;
}

function responseHarness() {
  const response: { code?: number; body?: unknown; status: (code: number) => typeof response; json: (body: unknown) => typeof response } = {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return response;
}

describe("MCP-compatible registry endpoint", () => {
  it("advertises external-agent tools after API-key authentication", async () => {
    const response = responseHarness();
    await routeHarness()({ headers: { authorization: "Bearer ab_live_test" }, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }, response);
    expect(response.code).toBe(200);
    expect(response.body).toMatchObject({ result: { tools: expect.arrayContaining([expect.objectContaining({ name: "generate_app" }), expect.objectContaining({ name: "get_artifacts" })]) } });
  });

  it("returns the caller-owned registry through the list_apps tool", async () => {
    const response = responseHarness();
    await routeHarness()({ headers: { "x-builder-api-key": "ab_live_test" }, body: { jsonrpc: "2.0", id: "list", method: "tools/call", params: { name: "list_apps", arguments: {} } } }, response);
    expect(response.code).toBe(200);
    expect(response.body).toMatchObject({ result: { content: [expect.objectContaining({ type: "text" })] } });
    expect(JSON.stringify(response.body)).toContain("Registry App");
  });
});
