import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reserveTenantGeneration: vi.fn().mockResolvedValue({ allowed: false, usage: { periodKey: "2026-08" } }),
  resolveTenantModelRoute: vi.fn().mockResolvedValue({ model: "gpt-5-mini", estimatedCostMicros: 2_000, inputTokens: 40 }),
  createGeneratedApp: vi.fn(),
  updateGeneratedApp: vi.fn(),
}));

vi.mock("./db", () => ({
  createGeneratedApp: mocks.createGeneratedApp,
  createGeneratedAppArtifact: vi.fn(),
  createGeneratedAppFile: vi.fn(),
  createGeneratedAppVersion: vi.fn(),
  getGeneratedAppForUser: vi.fn(),
  listGeneratedAppVersions: vi.fn(),
  recordTenantGenerationUsage: vi.fn(),
  replaceGeneratedAppFiles: vi.fn(),
  reserveTenantGeneration: mocks.reserveTenantGeneration,
  resolveTenantModelRoute: mocks.resolveTenantModelRoute,
  updateGeneratedApp: mocks.updateGeneratedApp,
}));

import { executeAppGeneration } from "./appBuilder";

describe("generation quota enforcement", () => {
  it("blocks a build before creating an application when tenant allowance is exhausted", async () => {
    await expect(executeAppGeneration({ userId: 88, prompt: "Build a customer tracker with a clear workflow" })).rejects.toThrow("quota reached");
    expect(mocks.createGeneratedApp).not.toHaveBeenCalled();
    expect(mocks.updateGeneratedApp).toHaveBeenCalledWith(expect.any(String), 88, expect.objectContaining({ status: "failed" }));
  });
});
