import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getOrCreateOrganization: vi.fn(async () => ({ id: "org-1", ownerId: 1, name: "Workspace" })),
  getOrganizationMembership: vi.fn(async () => ({ id: "member-1", organizationId: "org-1", userId: 1, role: "owner" })),
  getTenantAnalytics: vi.fn(async () => ({ periodKey: "2026-08", quota: { generations: 12 }, usage: { generations: 2, estimatedCostMicros: 240000 }, models: [], recentActivity: [] })),
  getOrganizationBillingAccount: vi.fn(async () => ({ organizationId: "org-1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" })),
  createBillingCheckout: vi.fn(async () => ({ url: "https://checkout.stripe.test/session" })),
  createBillingPortal: vi.fn(async () => ({ url: "https://billing.stripe.test/session" })),
}));

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...mocks }));
vi.mock("./billing", () => ({ createBillingCheckout: mocks.createBillingCheckout, createBillingPortal: mocks.createBillingPortal }));
import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 1, openId: "owner", email: "owner@example.com", name: "Owner", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: { origin: "https://vellum.test" }, protocol: "https", get: () => "vellum.test" } as unknown as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("billing API", () => {
  it("returns organization usage and the minimal linked Stripe identifiers", async () => {
    const overview = await appRouter.createCaller(context()).billing.overview();
    expect(overview.usage.usage.generations).toBe(2);
    expect(overview.account?.stripeCustomerId).toBe("cus_1");
    expect(overview.canManage).toBe(true);
    expect(overview.activation).toEqual(expect.objectContaining({ recurringPriceConfigured: false, customerLinked: true }));
  });

  it("delegates checkout and portal creation with the authenticated workspace context", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.billing.checkout()).resolves.toEqual({ url: "https://checkout.stripe.test/session" });
    await expect(caller.billing.portal()).resolves.toEqual({ url: "https://billing.stripe.test/session" });
    expect(mocks.createBillingCheckout).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", userId: 1, origin: "https://vellum.test" }));
    expect(mocks.createBillingPortal).toHaveBeenCalledWith({ organizationId: "org-1", origin: "https://vellum.test" });
  });
});
