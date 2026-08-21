import { describe, expect, it } from "vitest";
import { defaultModelRates, estimateModelCostMicros, routeModel } from "./modelRouting";

const rates = Object.entries(defaultModelRates).map(([model, rate]) => ({ model: model as keyof typeof defaultModelRates, ...rate, enabled: true }));

describe("budget-aware model routing", () => {
  it("uses the requested model for manual policy when it fits the remaining budget", () => {
    const result = routeModel({ requestedModel: "gpt-5", policy: "manual", rates, inputTokens: 700, budgetRemainingMicros: 100_000 });
    expect(result.model).toBe("gpt-5");
    expect(result.estimatedCostMicros).toBe(estimateModelCostMicros(defaultModelRates["gpt-5"], 700));
  });

  it("selects the lowest enabled estimated-cost candidate when policy requires it", () => {
    const result = routeModel({ requestedModel: "claude-sonnet-4-6", policy: "lowest_cost", rates, inputTokens: 700, budgetRemainingMicros: 100_000 });
    expect(result.model).toBe("gpt-5-mini");
  });

  it("rejects routing when no enabled candidate can fit within the remaining budget", () => {
    expect(() => routeModel({ requestedModel: "gpt-5-mini", policy: "balanced", rates, inputTokens: 900, budgetRemainingMicros: 1 })).toThrow("budget");
  });
});
