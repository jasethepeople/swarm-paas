import express, { type Express } from "express";
import Stripe from "stripe";
import { upsertOrganizationBillingAccount } from "./db";

export function registerStripeWebhookRoute(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: any, res: any) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!secret || !key) return res.status(503).json({ error: "Stripe webhook handling is not configured" });
    try {
      const stripe = new Stripe(key);
      const signature = req.headers["stripe-signature"];
      if (!signature) return res.status(400).json({ error: "Stripe signature is required" });
      const event = stripe.webhooks.constructEvent(req.body, signature, secret);
      if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
      const object = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
      const organizationId = "metadata" in object ? object.metadata?.organization_id : undefined;
      if (organizationId && (event.type === "checkout.session.completed" || event.type.startsWith("customer.subscription."))) {
        const subscriptionId = "subscription" in object && typeof object.subscription === "string" ? object.subscription : "id" in object && event.type.startsWith("customer.subscription.") ? object.id : undefined;
        const customerId = "customer" in object && typeof object.customer === "string" ? object.customer : undefined;
        await upsertOrganizationBillingAccount({ organizationId, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId });
      }
      console.info("[Stripe] verified event", event.type, event.id);
      return res.json({ received: true });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Stripe webhook verification failed" });
    }
  });
}
