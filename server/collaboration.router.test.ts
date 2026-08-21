import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getGeneratedAppWithAccess: vi.fn(async () => ({ app: { id: "app-1", userId: 1, name: "Shared app" }, access: "manager", isOwner: true })),
  createAppCollaborationInvitation: vi.fn(async () => "collab-invite-1"),
  getActiveAppCollaborationInvitation: vi.fn(async () => ({ id: "collab-invite-1", appId: "app-1", email: "owner@example.com", access: "editor", invitedByUserId: 1 })),
  createOrUpdateAppCollaborator: vi.fn(async () => undefined),
  acceptAppCollaborationInvitation: vi.fn(async () => undefined),
  createOrganizationAuditEvent: vi.fn(async () => undefined),
  getOrCreateOrganization: vi.fn(async () => ({ id: "org-1", ownerId: 1, name: "Workspace" })),
}));

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...mocks }));
vi.mock("./rateLimit", () => ({ consumeRegistryRateLimit: vi.fn(async () => ({ allowed: true, remaining: 20, resetsAt: Date.now() + 60_000 })) }));
vi.mock("./webhooks", async importOriginal => ({ ...(await importOriginal<typeof import("./webhooks")>()), dispatchOperationalWebhook: vi.fn(async () => undefined) }));
import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 1, openId: "owner", email: "owner@example.com", name: "Owner", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https", get: () => "vellum.test" } as unknown as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("shared application collaboration", () => {
  it("creates an expiring collaborator invitation and records its audit event", async () => {
    const result = await appRouter.createCaller(context()).apps.inviteCollaborator({ appId: "app-1", email: "collab@example.com", access: "editor", expiresInHours: 24 });
    expect(result.path).toMatch(/^\/collaborate\//);
    expect(mocks.createAppCollaborationInvitation).toHaveBeenCalledWith(expect.objectContaining({ appId: "app-1", email: "collab@example.com", access: "editor" }));
    expect(mocks.createOrganizationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "app.collaborator_invited" }));
  });

  it("accepts an email-matched collaboration invitation with its assigned editor access", async () => {
    await expect(appRouter.createCaller(context()).apps.acceptCollaborationInvitation({ token: "a".repeat(24) })).resolves.toEqual({ success: true, appId: "app-1" });
    expect(mocks.createOrUpdateAppCollaborator).toHaveBeenCalledWith(expect.objectContaining({ appId: "app-1", userId: 1, access: "editor" }));
    expect(mocks.acceptAppCollaborationInvitation).toHaveBeenCalledWith("collab-invite-1");
    expect(mocks.createOrganizationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "app.collaborator_joined" }));
  });
});
