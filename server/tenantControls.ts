export function canReserveTenantGeneration(input: {
  generationCount: number;
  inputTokens: number;
  outputTokens: number;
  monthlyGenerationLimit: number;
  monthlyTokenLimit: number;
}) {
  return input.generationCount < input.monthlyGenerationLimit
    && input.inputTokens + input.outputTokens < input.monthlyTokenLimit;
}
