import { afterEach, describe, expect, it } from "vitest";
import { createBillingCheckout, getBillingActivationState } from "./billing";

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

  it("refuses Checkout when webhook signing is unavailable even if a recurring price exists", async () => {
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.VELLUM_STRIPE_PRICE_ID = "price_vellum";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(createBillingCheckout({ organizationId: "org-1", userId: 1, email: "owner@example.com", name: "Owner", origin: "https://vellum.test" })).rejects.toThrow("webhook signing");
    if (originalWebhookSecret) process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("derives exact pending and fully configured go-live activation contracts", () => {
    expect(getBillingActivationState({ secretKeyConfigured: true, webhookSecretConfigured: true, recurringPriceConfigured: false, customerLinked: false })).toEqual({ secretKeyConfigured: true, webhookSecretConfigured: true, recurringPriceConfigured: false, customerLinked: false, canInitiateCheckout: false });
    expect(getBillingActivationState({ secretKeyConfigured: true, webhookSecretConfigured: true, recurringPriceConfigured: true, customerLinked: true })).toEqual({ secretKeyConfigured: true, webhookSecretConfigured: true, recurringPriceConfigured: true, customerLinked: true, canInitiateCheckout: true });
  });
});
