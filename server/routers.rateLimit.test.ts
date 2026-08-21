import { describe, expect, it, vi } from "vitest";

vi.mock("./rateLimit", () => ({
  consumeRegistryRateLimit: vi.fn().mockResolvedValue({ allowed: false, remaining: 0, resetsAt: Date.now() + 60_000 }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: 84,
      openId: "registry-rate-limit-user",
      name: "Rate Limit Tester",
      email: "rate-limit@example.test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("apps registry rate limiting", () => {
  it("returns TOO_MANY_REQUESTS before executing every authenticated registry procedure", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.apps.list()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(caller.apps.get({ appId: "blocked-app" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(caller.apps.files({ appId: "blocked-app" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(caller.apps.file({ appId: "blocked-app", path: "client/App.tsx" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(caller.apps.artifacts({ appId: "blocked-app" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(caller.apps.delete({ appId: "blocked-app" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
