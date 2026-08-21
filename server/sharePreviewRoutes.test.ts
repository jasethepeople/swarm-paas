import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ activeLink: vi.fn(async () => ({ id: "share-1", appId: "app-1", versionId: "version-1", expiresAt: new Date(Date.now() + 60_000), revokedAt: null })) }));

vi.mock("./db", () => ({
  getActiveAppShareLink: mocks.activeLink,
  getGeneratedAppById: vi.fn(async () => ({ id: "app-1", name: "Shared tracker", summary: "A secure shared preview", status: "ready", routes: JSON.stringify([{ path: "/", purpose: "Workspace" }]), schemaSummary: "[]" })),
  getGeneratedAppVersion: vi.fn(async () => ({ id: "version-1", metadata: JSON.stringify({ name: "Shared tracker", summary: "A secure shared preview" }), routes: JSON.stringify([{ path: "/", purpose: "Workspace" }]), schemaSummary: "[]", fileSnapshot: JSON.stringify([{ path: "README.md", language: "markdown", content: "# Shared tracker" }]) })),
  listGeneratedAppFiles: vi.fn(async () => [{ path: "README.md", language: "markdown", content: "# Shared tracker" }]),
}));

import { registerSharePreviewRoutes } from "./sharePreviewRoutes";

function routeHarness() {
  const handlers = new Map<string, (req: any, res: any) => Promise<unknown>>();
  registerSharePreviewRoutes({ get: (path: string, handler: any) => handlers.set(path, handler) } as any);
  return handlers.get("/share/:token")!;
}

function responseHarness() {
  const response: { code?: number; body?: string; headers: Record<string, string>; status: (code: number) => typeof response; setHeader: (key: string, value: string) => void; type: () => typeof response; send: (body: string) => typeof response } = { headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, type() { return this; }, send(body) { this.body = body; return this; } };
  return response;
}

describe("public share previews", () => {
  it("renders only a safe static manifest after validating a token", async () => {
    const response = responseHarness();
    await routeHarness()({ params: { token: "abcdefghij_abcdefghij_abcdefghij" } }, response);
    expect(response.body).toContain("READ-ONLY SHARED PREVIEW");
    expect(response.body).toContain("Shared tracker");
    expect(response.headers["Cache-Control"]).toContain("no-store");
    expect(response.body).not.toContain("<script");
  });

  it("does not disclose anything for malformed tokens", async () => {
    const response = responseHarness();
    await routeHarness()({ params: { token: "bad" } }, response);
    expect(response.code).toBe(404);
  });

  it("denies a revoked or expired token without loading app metadata", async () => {
    mocks.activeLink.mockResolvedValueOnce(undefined);
    const response = responseHarness();
    await routeHarness()({ params: { token: "abcdefghij_abcdefghij_abcdefghij" } }, response);
    expect(response.code).toBe(404);
    expect(response.body).toContain("unavailable");
  });
});
