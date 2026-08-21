import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { createWebhookDelivery, completeWebhookDelivery, listWebhookEndpoints } from "./db";

export const webhookEventTypes = ["generation.completed", "organization.invitation.created", "collaboration.invitation.created"] as const;
export type WebhookEventType = (typeof webhookEventTypes)[number];

export function isSafeWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
    return url.protocol === "https:" && !privateIpv4 && hostname !== "localhost" && hostname !== "::1";
  } catch {
    return false;
  }
}

const key = createHash("sha256").update(process.env.JWT_SECRET || "vellum-webhook-development-key").digest();

export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptWebhookSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Webhook secret is unavailable");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

async function sendWithRetry(url: string, payload: string, signature: string) {
  let lastError = "Delivery failed";
  let status: number | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-vellum-event": signature.split(".")[0], "x-vellum-signature": signature, "x-vellum-delivery": randomBytes(12).toString("hex") }, body: payload, signal: AbortSignal.timeout(5000) });
      status = response.status;
      if (response.ok) return { delivered: true, attempts: attempt, status };
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 500) : "Network delivery failure";
    }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 250));
  }
  return { delivered: false, attempts: 3, status, error: lastError };
}

export async function dispatchOperationalWebhook(organizationId: string, eventType: WebhookEventType, data: Record<string, unknown>) {
  const endpoints = await listWebhookEndpoints(organizationId);
  const eventId = `evt_${randomBytes(16).toString("hex")}`;
  const occurredAt = new Date().toISOString();
  await Promise.all(endpoints.filter(endpoint => endpoint.active && JSON.parse(endpoint.events) as string[]).filter(endpoint => (JSON.parse(endpoint.events) as string[]).includes(eventType)).map(async endpoint => {
    const deliveryId = await createWebhookDelivery({ endpointId: endpoint.id, eventId, eventType });
    try {
      const payload = JSON.stringify({ id: eventId, type: eventType, occurredAt, data });
      const secret = decryptWebhookSecret(endpoint.secretCiphertext);
      const signature = `${eventType}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
      const outcome = await sendWithRetry(endpoint.url, payload, signature);
      await completeWebhookDelivery(deliveryId, outcome.delivered ? { status: "delivered", attempts: outcome.attempts, responseStatus: outcome.status } : { status: "failed", attempts: outcome.attempts, responseStatus: outcome.status, errorMessage: outcome.error });
    } catch (error) {
      await completeWebhookDelivery(deliveryId, { status: "failed", attempts: 1, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Webhook encryption or delivery failure" });
    }
  }));
}

export async function dispatchWebhookTest(organizationId: string, endpointId: string) {
  const endpoint = (await listWebhookEndpoints(organizationId)).find(candidate => candidate.id === endpointId && candidate.active);
  if (!endpoint) throw new Error("Webhook endpoint is unavailable");
  const eventId = `evt_${randomBytes(16).toString("hex")}`;
  const payload = JSON.stringify({ id: eventId, type: "webhook.test", occurredAt: new Date().toISOString(), data: { test: true, message: "Vellum webhook verification" } });
  const deliveryId = await createWebhookDelivery({ endpointId: endpoint.id, eventId, eventType: "webhook.test" });
  try {
    const secret = decryptWebhookSecret(endpoint.secretCiphertext);
    const signature = `webhook.test.${createHmac("sha256", secret).update(payload).digest("hex")}`;
    const outcome = await sendWithRetry(endpoint.url, payload, signature);
    await completeWebhookDelivery(deliveryId, outcome.delivered ? { status: "delivered", attempts: outcome.attempts, responseStatus: outcome.status } : { status: "failed", attempts: outcome.attempts, responseStatus: outcome.status, errorMessage: outcome.error });
    return { status: outcome.delivered ? "delivered" as const : "failed" as const, attempts: outcome.attempts, responseStatus: outcome.status };
  } catch (error) {
    await completeWebhookDelivery(deliveryId, { status: "failed", attempts: 1, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Webhook test delivery failed" });
    return { status: "failed" as const, attempts: 1 };
  }
}
