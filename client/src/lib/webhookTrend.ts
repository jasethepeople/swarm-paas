export function summarizeWebhookDeliveryTrend(deliveries: Array<{ status: string; endpointId: string }>, endpointId: string, limit = 8) {
  const recent = deliveries.filter(delivery => delivery.endpointId === endpointId).slice(0, limit);
  const delivered = recent.filter(delivery => delivery.status === "delivered").length;
  const failed = recent.filter(delivery => delivery.status === "failed").length;
  return { total: recent.length, delivered, failed, successRate: recent.length ? Math.round((delivered / recent.length) * 100) : null };
}
