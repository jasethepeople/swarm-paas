import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./rateLimit", () => ({ consumeRegistryRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 119, resetsAt: Date.now() + 60_000 }) }));
vi.mock("./db", () => ({
  getGeneratedAppForUser: vi.fn().mockResolvedValue({ id: "app-manifest", sourceManifestKey: "generated-apps/1/app/source-manifest.json" }),
  listGeneratedApps: vi.fn(), getGeneratedAppFile: vi.fn(), listGeneratedAppFiles: vi.fn(), listGeneratedAppArtifacts: vi.fn(), deleteGeneratedApp: vi.fn(), createBuilderApiKey: vi.fn(),
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn().mockResolvedValue("https://storage.example/manifest.json") }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const member = { id: 1, openId: "manifest-member", name: "Manifest Member", email: "manifest@example.test", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

afterEach(() => vi.unstubAllGlobals());

describe("durable source manifest retrieval", () => {
  it("returns persisted routes, components, and schema to the authenticated preview client", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Workspace", routes: [{ path: "/", purpose: "Home" }], components: ["App"], schema: [{ name: "tasks", fields: [{ name: "id", type: "text", required: true }] }] }) }));
    const context: TrpcContext = { user: member, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
    const manifest = await appRouter.createCaller(context).apps.manifest({ appId: "app-manifest" });
    expect(manifest).toMatchObject({ name: "Workspace", routes: [{ path: "/" }], components: ["App"], schema: [{ name: "tasks" }] });
  });
});
