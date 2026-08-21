import { describe, expect, it } from "vitest";
import { summarizeWebhookDeliveryTrend } from "../client/src/lib/webhookTrend";

describe("webhook delivery trend", () => {
  it("derives a bounded per-endpoint success trend from persisted outcomes", () => {
    const deliveries = [{ endpointId: "a", status: "delivered" }, { endpointId: "a", status: "failed" }, { endpointId: "a", status: "delivered" }, { endpointId: "b", status: "delivered" }];
    expect(summarizeWebhookDeliveryTrend(deliveries, "a")).toEqual({ total: 3, delivered: 2, failed: 1, successRate: 67 });
    expect(summarizeWebhookDeliveryTrend(deliveries, "missing")).toEqual({ total: 0, delivered: 0, failed: 0, successRate: null });
  });
});
