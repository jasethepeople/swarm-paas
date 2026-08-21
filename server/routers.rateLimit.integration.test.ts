import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { rateLimitWindows } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const userId = 991_337;
const rateKey = `registry:${userId}`;

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "shared-rate-limit-test-user",
      name: "Shared Rate Limit Tester",
      email: "shared-rate-limit@example.test",
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

afterEach(async () => {
  const db = await getDb();
  await db?.delete(rateLimitWindows).where(eq(rateLimitWindows.key, rateKey));
});

describe("shared registry rate limiter", () => {
  it("enforces the persisted window through an authenticated app registry endpoint", async () => {
    const db = await getDb();
    if (!db) throw new Error("A database connection is required for this integration test");
    await db.insert(rateLimitWindows).values({ key: rateKey, count: 120, resetsAt: new Date(Date.now() + 60_000) });
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.apps.list()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

