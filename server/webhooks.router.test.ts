import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getOrCreateOrganization: vi.fn(async () => ({ id: "org-1", ownerId: 1, name: "Workspace" })),
  getOrganizationMembership: vi.fn(async () => ({ id: "member-1", organizationId: "org-1", userId: 1, role: "owner" })),
  listWebhookEndpoints: vi.fn(async () => [{ id: "endpoint-1", organizationId: "org-1", url: "https://events.example.test/vellum", events: "[]", secretCiphertext: "encrypted-value", active: 1, createdByUserId: 1 }]),
  listWebhookDeliveries: vi.fn(async () => [{ id: "delivery-1", endpointId: "endpoint-1", eventType: "webhook.test", status: "delivered", attempts: 1, responseStatus: 200 }]),
}));

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...mocks }));
import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 1, openId: "owner", email: "owner@example.com", name: "Owner", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https", get: () => "vellum.test" } as unknown as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("webhook readiness context", () => {
  it("returns inspectable recent delivery fields while withholding the endpoint secret", async () => {
    const result = await appRouter.createCaller(context()).webhooks.context();
    expect(result.canManage).toBe(true);
    expect(result.endpoints[0]).toMatchObject({ id: "endpoint-1", url: "https://events.example.test/vellum" });
    expect(result.endpoints[0]).toMatchObject({ health: "healthy", latestDeliveryStatus: "delivered" });
    expect(result.endpoints[0]).not.toHaveProperty("secretCiphertext");
    expect(result.deliveries[0]).toMatchObject({ eventType: "webhook.test", status: "delivered", attempts: 1, responseStatus: 200 });
  });

  it("rejects endpoint re-verification for a non-manager membership", async () => {
    mocks.getOrganizationMembership.mockResolvedValueOnce({ id: "member-2", organizationId: "org-1", userId: 1, role: "viewer" });
    await expect(appRouter.createCaller(context()).webhooks.testDelivery({ endpointId: "endpoint-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
