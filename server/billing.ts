import Stripe from "stripe";
import { getOrganizationBillingAccount, upsertOrganizationBillingAccount } from "./db";

const configuredPriceId = () => process.env.VELLUM_STRIPE_PRICE_ID || "";

function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured. Open Settings → Payment to complete setup.");
  return new Stripe(secretKey);
}

export async function createBillingCheckout(input: { organizationId: string; userId: number; email?: string | null; name?: string | null; origin: string }) {
  const priceId = configuredPriceId();
  if (!priceId) throw new Error("Set VELLUM_STRIPE_PRICE_ID after creating a recurring price in Stripe to enable checkout.");
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook signing must be configured before enabling checkout.");
  const stripe = stripeClient();
  const current = await getOrganizationBillingAccount(input.organizationId);
  let customerId = current?.stripeCustomerId || undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: input.email || undefined, name: input.name || undefined, metadata: { organization_id: input.organizationId, user_id: String(input.userId) } });
    customerId = customer.id;
    await upsertOrganizationBillingAccount({ organizationId: input.organizationId, stripeCustomerId: customerId, stripeSubscriptionId: current?.stripeSubscriptionId || undefined });
  }
  const session = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId, line_items: [{ price: priceId, quantity: 1 }], allow_promotion_codes: true, client_reference_id: String(input.userId), metadata: { organization_id: input.organizationId, user_id: String(input.userId), customer_email: input.email || "", customer_name: input.name || "" }, success_url: `${input.origin}/?billing=success`, cancel_url: `${input.origin}/?billing=cancelled` });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { url: session.url };
}

export async function createBillingPortal(input: { organizationId: string; origin: string }) {
  const current = await getOrganizationBillingAccount(input.organizationId);
  if (!current?.stripeCustomerId) throw new Error("Start checkout before opening the billing portal.");
  const stripe = stripeClient();
  const session = await stripe.billingPortal.sessions.create({ customer: current.stripeCustomerId, return_url: `${input.origin}/` });
  return { url: session.url };
}
