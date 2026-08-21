import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn().mockResolvedValue({ id: 77 }) } }));
vi.mock("./db", () => ({
  consumeSharedRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetsAt: Date.now() + 60_000 }),
  getGeneratedAppForUser: vi.fn().mockResolvedValue({ id: "app-77", name: "Release Board" }),
  listGeneratedAppArtifacts: vi.fn().mockResolvedValue([{ kind: "zip_export", storageUrl: "/manus-storage/release-board.zip" }]),
}));

import { registerMockGithubRoutes } from "./mockGithubRoutes";

type Handler = (req: any, res: any) => Promise<unknown>;

function routeHarness() {
  const handlers = new Map<string, Handler>();
  registerMockGithubRoutes({ post: (path: string, handler: Handler) => { handlers.set(path, handler); } } as any);
  const handler = handlers.get("/api/mock-github/repos/:owner/:repository/push");
  if (!handler) throw new Error("Mock GitHub route was not registered");
  return handler;
}

function responseHarness() {
  const response: { code?: number; body?: unknown; status: (code: number) => typeof response; json: (body: unknown) => typeof response } = {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return response;
}

describe("mock GitHub source push", () => {
  it("accepts a caller-owned ZIP artifact and returns a deterministic-shaped commit response", async () => {
    const response = responseHarness();
    await routeHarness()({ params: { owner: "design-lab", repository: "release-board" }, body: { appId: "app-77" } }, response);
    expect(response.code).toBe(201);
    expect(response.body).toMatchObject({ mock: true, repository: "design-lab/release-board", branch: "main", sourceArtifact: "/manus-storage/release-board.zip" });
  });
});

