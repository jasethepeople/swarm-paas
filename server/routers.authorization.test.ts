import { describe, expect, it, vi } from "vitest";

vi.mock("./rateLimit", () => ({ consumeRegistryRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 119, resetsAt: Date.now() + 60_000 }) }));
vi.mock("./db", () => ({
  listGeneratedApps: vi.fn().mockResolvedValue([]),
  getGeneratedAppForUser: vi.fn().mockResolvedValue(undefined),
  getGeneratedAppFile: vi.fn(),
  listGeneratedAppFiles: vi.fn(),
  listGeneratedAppArtifacts: vi.fn(),
  deleteGeneratedApp: vi.fn(),
  createBuilderApiKey: vi.fn(),
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

const member = { id: 443, openId: "member-443", name: "Member", email: "member@example.test", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("registry ownership boundaries", () => {
  it("rejects anonymous registry access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.apps.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.apps.get({ appId: "private-app" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.apps.files({ appId: "private-app" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.apps.file({ appId: "private-app", path: "client/App.tsx" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.apps.artifacts({ appId: "private-app" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.apps.manifest({ appId: "private-app" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.apps.delete({ appId: "private-app" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns NOT_FOUND for every cross-tenant app resource operation", async () => {
    const caller = appRouter.createCaller(context(member));
    await expect(caller.apps.get({ appId: "another-tenant-app" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.apps.files({ appId: "another-tenant-app" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.apps.file({ appId: "another-tenant-app", path: "client/App.tsx" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.apps.artifacts({ appId: "another-tenant-app" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.apps.manifest({ appId: "another-tenant-app" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.apps.delete({ appId: "another-tenant-app" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
