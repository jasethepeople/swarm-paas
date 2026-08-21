import { describe, expect, it } from "vitest";
import { canReserveTenantGeneration } from "./tenantControls";
import { selectableModels } from "./appBuilder";

describe("tenant generation controls", () => {
  it("allows work within both monthly generation and token limits", () => {
    expect(canReserveTenantGeneration({ generationCount: 2, inputTokens: 100, outputTokens: 200, monthlyGenerationLimit: 3, monthlyTokenLimit: 1_000 })).toBe(true);
  });

  it("rejects work at either quota ceiling", () => {
    expect(canReserveTenantGeneration({ generationCount: 3, inputTokens: 0, outputTokens: 0, monthlyGenerationLimit: 3, monthlyTokenLimit: 1_000 })).toBe(false);
    expect(canReserveTenantGeneration({ generationCount: 0, inputTokens: 700, outputTokens: 300, monthlyGenerationLimit: 3, monthlyTokenLimit: 1_000 })).toBe(false);
  });

  it("exposes only curated selectable generation models", () => {
    expect(selectableModels).toContain("gpt-5-mini");
    expect(selectableModels).not.toContain("untrusted-model");
  });
});
