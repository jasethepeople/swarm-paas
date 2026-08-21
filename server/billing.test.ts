import { afterEach, describe, expect, it } from "vitest";
import { createBillingCheckout } from "./billing";

describe("billing checkout configuration", () => {
  const originalPriceId = process.env.VELLUM_STRIPE_PRICE_ID;

  afterEach(() => {
    if (originalPriceId) process.env.VELLUM_STRIPE_PRICE_ID = originalPriceId;
    else delete process.env.VELLUM_STRIPE_PRICE_ID;
  });

  it("keeps checkout safely disabled until a recurring Stripe Price ID is configured", async () => {
    delete process.env.VELLUM_STRIPE_PRICE_ID;
    await expect(createBillingCheckout({ organizationId: "org-1", userId: 1, email: "owner@example.com", name: "Owner", origin: "https://vellum.test" })).rejects.toThrow("VELLUM_STRIPE_PRICE_ID");
  });
});
