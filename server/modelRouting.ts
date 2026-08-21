export const routingModels = ["gpt-5-mini", "gpt-5", "claude-sonnet-4-6", "gemini-3-flash-preview"] as const;
export type RoutingModel = typeof routingModels[number];
export type RoutingPolicy = "manual" | "balanced" | "lowest_cost";

export const defaultModelRates: Record<RoutingModel, { inputMicrosPer1k: number; outputMicrosPer1k: number; priority: number }> = {
  "gpt-5-mini": { inputMicrosPer1k: 250, outputMicrosPer1k: 2000, priority: 10 },
  "gemini-3-flash-preview": { inputMicrosPer1k: 500, outputMicrosPer1k: 3000, priority: 20 },
  "gpt-5": { inputMicrosPer1k: 1250, outputMicrosPer1k: 10000, priority: 30 },
  "claude-sonnet-4-6": { inputMicrosPer1k: 3000, outputMicrosPer1k: 15000, priority: 40 },
};

export type ModelRate = { model: RoutingModel; inputMicrosPer1k: number; outputMicrosPer1k: number; enabled: boolean; priority: number };

export function estimateTokens(prompt: string) {
  return Math.max(64, Math.ceil(prompt.trim().length / 4));
}

export function estimateModelCostMicros(rate: Pick<ModelRate, "inputMicrosPer1k" | "outputMicrosPer1k">, inputTokens: number, outputTokens = 3600) {
  return Math.ceil((inputTokens * rate.inputMicrosPer1k + outputTokens * rate.outputMicrosPer1k) / 1000);
}

export function routeModel(input: { requestedModel: RoutingModel; policy: RoutingPolicy; rates: ModelRate[]; inputTokens: number; budgetRemainingMicros: number }) {
  const candidates = input.rates.filter(rate => rate.enabled).map(rate => ({ ...rate, estimatedCostMicros: estimateModelCostMicros(rate, input.inputTokens) }));
  if (!candidates.length) throw new Error("No enabled models are available for this tenant");
  const underBudget = candidates.filter(candidate => candidate.estimatedCostMicros <= input.budgetRemainingMicros);
  if (!underBudget.length) throw new Error("Tenant model budget would be exceeded by this generation");
  const requested = underBudget.find(candidate => candidate.model === input.requestedModel);
  const ranked = [...underBudget].sort((a, b) => a.estimatedCostMicros - b.estimatedCostMicros || a.priority - b.priority);
  const selected = input.policy === "manual" ? requested : input.policy === "lowest_cost" ? ranked[0] : requested || ranked[0];
  if (!selected) throw new Error("Requested model is disabled or exceeds the tenant budget");
  return { model: selected.model, estimatedCostMicros: selected.estimatedCostMicros, inputTokens: input.inputTokens };
}
