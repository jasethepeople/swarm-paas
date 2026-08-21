import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getOrCreateOrganization: vi.fn(async () => ({ id: "org-1", ownerId: 1, name: "Workspace", createdAt: new Date(), updatedAt: new Date() })),
  getOrganizationMembership: vi.fn(async () => ({ id: "member-1", organizationId: "org-1", userId: 1, role: "owner", createdAt: new Date(), updatedAt: new Date() })),
  createOrganizationInvitation: vi.fn(async () => "invite-1"),
  createOrganizationAuditEvent: vi.fn(async () => undefined),
  upsertOrganizationMember: vi.fn(async () => undefined),
  removeOrganizationMember: vi.fn(async () => undefined),
  getActiveOrganizationInvitation: vi.fn(async () => ({ id: "invite-1", organizationId: "org-1", email: "owner@example.com", role: "member" })),
  acceptOrganizationInvitation: vi.fn(async () => undefined),
}));

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...mocks }));
import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 1, openId: "owner", email: "owner@example.com", name: "Owner", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("organization procedures", () => {
  it("creates an expiring invitation and audits the action", async () => {
    const result = await appRouter.createCaller(context()).organization.invite({ email: "member@example.com", role: "member", expiresInHours: 24 });
    expect(result.path).toMatch(/^\/invite\//);
    expect(mocks.createOrganizationInvitation).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", email: "member@example.com", role: "member" }));
    expect(mocks.createOrganizationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "member.invited" }));
  });

  it("updates a non-owner role and produces an audit record", async () => {
    await appRouter.createCaller(context()).organization.updateRole({ userId: 2, role: "viewer" });
    expect(mocks.upsertOrganizationMember).toHaveBeenCalledWith({ organizationId: "org-1", userId: 2, role: "viewer" });
    expect(mocks.createOrganizationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "member.role_updated" }));
  });

  it("removes a non-owner member and produces an audit record", async () => {
    await expect(appRouter.createCaller(context()).organization.removeMember({ userId: 2 })).resolves.toEqual({ success: true });
    expect(mocks.removeOrganizationMember).toHaveBeenCalledWith("org-1", 2);
    expect(mocks.createOrganizationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "member.removed", targetId: "2" }));
  });

  it("accepts an email-matched invitation and audits the membership join", async () => {
    await expect(appRouter.createCaller(context()).organization.acceptInvitation({ token: "a".repeat(24) })).resolves.toEqual({ success: true });
    expect(mocks.acceptOrganizationInvitation).toHaveBeenCalledWith("invite-1");
    expect(mocks.createOrganizationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "member.joined" }));
  });
});
