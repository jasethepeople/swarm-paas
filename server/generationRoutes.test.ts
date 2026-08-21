import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn().mockResolvedValue({ id: 15 }) } }));
vi.mock("./rateLimit", () => ({ consumeRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 5, resetsAt: Date.now() + 60_000 }) }));
vi.mock("./appBuilder", () => ({ selectableModels: ["gpt-5-mini"], executeAppGeneration: vi.fn().mockImplementation(async ({ onEvent, prompt }) => { const message = prompt.includes("quota") ? "Tenant generation quota reached for 2026-08" : "Model output was rejected"; onEvent({ type: "error", appId: "failed-app", message }); throw new Error(message); }) }));

import { registerGenerationRoutes } from "./generationRoutes";

type Handler = (req: any, res: any) => Promise<unknown>;

function routeHarness() {
  const handlers = new Map<string, Handler>();
  registerGenerationRoutes({ post: (path: string, handler: Handler) => { handlers.set(path, handler); } } as any);
  const handler = handlers.get("/api/builder/generate");
  if (!handler) throw new Error("Generation route was not registered");
  return handler;
}

function responseHarness() {
  const response: { code?: number; body?: unknown; stream: string[]; status: (code: number) => typeof response; json: (body: unknown) => typeof response; writeHead: () => void; flushHeaders: () => void; write: (data: string) => void; end: () => void } = {
    stream: [], status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, writeHead() { this.code = 200; }, flushHeaders() {}, write(data) { this.stream.push(data); }, end() {},
  };
  return response;
}

describe("generation stream input and failure handling", () => {
  it("rejects too-short application briefs before opening a stream", async () => {
    const response = responseHarness();
    await routeHarness()({ body: { prompt: "short" } }, response);
    expect(response.code).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining("between 10") });
  });

  it("forwards a sanitized generation failure event and closes the stream", async () => {
    const response = responseHarness();
    await routeHarness()({ body: { prompt: "Build a sufficiently detailed app brief" } }, response);
    expect(response.code).toBe(200);
    expect(response.stream.join("")).toContain("Model output was rejected");
  });

  it("surfaces exhausted tenant quota from the real HTTP generation entrypoint without creating source output", async () => {
    const response = responseHarness();
    await routeHarness()({ body: { prompt: "Build a detailed quota exhaustion verification application" } }, response);
    expect(response.code).toBe(200);
    expect(response.stream.join("")).toContain("Tenant generation quota reached");
    expect(response.stream.join("")).not.toContain('event: file');
  });
});
