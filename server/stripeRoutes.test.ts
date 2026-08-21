import express from "express";
import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsertOrganizationBillingAccount: vi.fn(async () => undefined) }));
vi.mock("./db", () => mocks);
import { registerStripeWebhookRoute } from "./stripeRoutes";

const testSecret = "whsec_test_vellum_signature";
const testKey = "sk_test_51VellumWebhookKey";
const stripe = new Stripe(testKey);

async function callWebhook(payload: Record<string, unknown>, signature: string) {
  const app = express();
  registerStripeWebhookRoute(app);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const listener = app.listen(0, () => resolve(listener)); });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const response = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body: JSON.stringify(payload) });
  await new Promise<void>(resolve => server.close(() => resolve()));
  return response;
}

describe("Stripe webhook route", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalKey) process.env.STRIPE_SECRET_KEY = originalKey; else delete process.env.STRIPE_SECRET_KEY;
    if (originalSecret) process.env.STRIPE_WEBHOOK_SECRET = originalSecret; else delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  it("fails closed when payment webhook credentials are not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const response = await callWebhook({}, "invalid");
    expect(response.status).toBe(503);
  });

  it("returns the required verification response for a signed Stripe test event", async () => {
    process.env.STRIPE_SECRET_KEY = testKey;
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
    const payload = { id: "evt_test_vellum", object: "event", type: "checkout.session.completed", data: { object: { object: "checkout.session", metadata: { organization_id: "org-1" } } } };
    const signature = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(payload), secret: testSecret });
    const response = await callWebhook(payload, signature);
    await expect(response.json()).resolves.toEqual({ verified: true });
    expect(mocks.upsertOrganizationBillingAccount).not.toHaveBeenCalled();
  });

  it("rejects an invalid Stripe signature", async () => {
    process.env.STRIPE_SECRET_KEY = testKey;
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
    const response = await callWebhook({ id: "evt_invalid", object: "event", type: "checkout.session.completed", data: { object: {} } }, "t=1,v1=invalid");
    expect(response.status).toBe(400);
  });

  it("persists only Stripe customer and subscription identifiers from a verified subscription event", async () => {
    process.env.STRIPE_SECRET_KEY = testKey;
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
    const payload = { id: "evt_live_vellum", object: "event", type: "checkout.session.completed", data: { object: { object: "checkout.session", customer: "cus_vellum", subscription: "sub_vellum", metadata: { organization_id: "org-1" } } } };
    const signature = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(payload), secret: testSecret });
    const response = await callWebhook(payload, signature);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.upsertOrganizationBillingAccount).toHaveBeenCalledWith({ organizationId: "org-1", stripeCustomerId: "cus_vellum", stripeSubscriptionId: "sub_vellum" });
  });
});
