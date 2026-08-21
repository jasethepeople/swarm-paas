import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createBuilderApiKey: vi.fn(), deleteGeneratedApp: vi.fn(), getGeneratedAppFile: vi.fn(), getGeneratedAppForUser: vi.fn(), listGeneratedAppArtifacts: vi.fn(), listGeneratedAppFiles: vi.fn(), listGeneratedApps: vi.fn(), listGeneratedAppVersions: vi.fn(), getGeneratedAppVersion: vi.fn(), createGeneratedAppVersion: vi.fn(), replaceGeneratedAppFiles: vi.fn(), updateGeneratedApp: vi.fn(), getTenantAnalytics: vi.fn(), getTenantQuota: vi.fn(), updateTenantQuota: vi.fn(),
}));

vi.mock("./rateLimit", () => ({ consumeRegistryRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 100, resetsAt: Date.now() + 60_000 }) }));
vi.mock("./db", () => db);
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));
vi.mock("./appBuilder", () => ({ selectableModels: ["gpt-5-mini", "gpt-5"] }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const user = { id: 44, openId: "tenant-44", name: "Tenant", email: "tenant@example.test", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const app = { id: "app-44", userId: 44, name: "Baseline", prompt: "baseline prompt", status: "ready", summary: "baseline", model: "gpt-5-mini", schemaSummary: "[]", routes: "[]", componentTree: "[]", previewConfig: "{}", sourceManifestKey: "manifest", sqliteArtifactKey: "db", exportArtifactKey: "zip" };
const context: TrpcContext = { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };

describe("tenant-control router procedures", () => {
  it("returns tenant analytics and persists owner-controlled quota updates", async () => {
    db.getTenantAnalytics.mockResolvedValue({ periodKey: "2026-08", quota: { generations: 12, tokens: 200000 }, usage: { generations: 1 }, models: [], recentActivity: [] });
    db.getTenantQuota.mockResolvedValue({ monthlyGenerationLimit: 12, monthlyTokenLimit: 200000 });
    db.updateTenantQuota.mockResolvedValue({ monthlyGenerationLimit: 20, monthlyTokenLimit: 250000 });
    const caller = appRouter.createCaller(context);
    await expect(caller.analytics.overview()).resolves.toMatchObject({ usage: { generations: 1 } });
    await expect(caller.analytics.quota()).resolves.toMatchObject({ monthlyGenerationLimit: 12 });
    await expect(caller.analytics.updateQuota({ monthlyGenerationLimit: 20, monthlyTokenLimit: 250000 })).resolves.toMatchObject({ monthlyGenerationLimit: 20 });
    expect(db.updateTenantQuota).toHaveBeenCalledWith(44, { monthlyGenerationLimit: 20, monthlyTokenLimit: 250000 });
  });

  it("backfills a baseline, exposes a file diff, and restores version metadata for the owner", async () => {
    const version = { id: "version-1", appId: app.id, versionNumber: 1, label: "Initial", fileSnapshot: JSON.stringify([{ path: "client/App.tsx", language: "tsx", content: "old" }]), metadata: JSON.stringify({ name: "Baseline", summary: "baseline", prompt: "baseline prompt", model: "gpt-5-mini", previewConfig: { title: "Baseline" } }), schemaSummary: "[]", routes: "[]", componentTree: "[]", sourceManifestKey: "manifest", sqliteArtifactKey: "db", exportArtifactKey: "zip" };
    db.getGeneratedAppForUser.mockResolvedValue(app);
    db.listGeneratedAppFiles.mockResolvedValue([{ path: "client/App.tsx", language: "tsx", content: "current" }]);
    db.listGeneratedAppVersions.mockResolvedValueOnce([]).mockResolvedValueOnce([version]).mockResolvedValue([version]);
    db.getGeneratedAppVersion.mockResolvedValue(version);
    const caller = appRouter.createCaller(context);
    await expect(caller.apps.versions({ appId: app.id })).resolves.toEqual([version]);
    expect(db.createGeneratedAppVersion).toHaveBeenCalledWith(expect.objectContaining({ label: "Imported baseline" }));
    await expect(caller.apps.diff({ appId: app.id, fromVersionId: "version-1", toVersionId: "version-1" })).resolves.toEqual([]);
    await expect(caller.apps.rollback({ appId: app.id, versionId: "version-1" })).resolves.toMatchObject({ success: true, restoredVersion: 1 });
    expect(db.replaceGeneratedAppFiles).toHaveBeenCalledWith(app.id, expect.any(Array));
    expect(db.updateGeneratedApp).toHaveBeenCalledWith(app.id, 44, expect.objectContaining({ name: "Baseline", prompt: "baseline prompt", status: "ready" }));
  });
});
