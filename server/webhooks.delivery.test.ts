import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listWebhookEndpoints: vi.fn(),
  createWebhookDelivery: vi.fn(async () => "delivery-1"),
  completeWebhookDelivery: vi.fn(async () => undefined),
}));

vi.mock("./db", () => mocks);
import { dispatchOperationalWebhook, dispatchWebhookTest, encryptWebhookSecret } from "./webhooks";

describe("operational webhook delivery", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("persists a successful signed delivery outcome", async () => {
    mocks.listWebhookEndpoints.mockResolvedValue([{ id: "endpoint-1", active: 1, events: JSON.stringify(["generation.completed"]), secretCiphertext: encryptWebhookSecret("whsec_example") }]);
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 202 }));
    await dispatchOperationalWebhook("org-1", "generation.completed", { appId: "app-1" });
    expect(mocks.createWebhookDelivery).toHaveBeenCalledWith(expect.objectContaining({ endpointId: "endpoint-1", eventType: "generation.completed" }));
    expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("delivery-1", expect.objectContaining({ status: "delivered", attempts: 1, responseStatus: 202 }));
  });

  it("records a failed delivery after three bounded attempts", async () => {
    mocks.listWebhookEndpoints.mockResolvedValue([{ id: "endpoint-1", active: 1, events: JSON.stringify(["generation.completed"]), secretCiphertext: encryptWebhookSecret("whsec_example") }]);
    globalThis.fetch = vi.fn(async () => new Response("error", { status: 500 }));
    await dispatchOperationalWebhook("org-1", "generation.completed", { appId: "app-1" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("delivery-1", expect.objectContaining({ status: "failed", attempts: 3, responseStatus: 500 }));
  });

  it("sends an explicit signed verification event to a selected endpoint", async () => {
    mocks.listWebhookEndpoints.mockResolvedValue([{ id: "endpoint-1", active: 1, url: "https://events.example.test/vellum", events: "[]", secretCiphertext: encryptWebhookSecret("whsec_example") }]);
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 }));
    await expect(dispatchWebhookTest("org-1", "endpoint-1")).resolves.toEqual({ status: "delivered", attempts: 1, responseStatus: 200 });
    expect(mocks.createWebhookDelivery).toHaveBeenCalledWith(expect.objectContaining({ endpointId: "endpoint-1", eventType: "webhook.test" }));
    expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("delivery-1", expect.objectContaining({ status: "delivered", attempts: 1, responseStatus: 200 }));
  });
});
