type WindowState = { count: number; resetsAt: number };

import { consumeSharedRateLimit } from "./db";

const windows = new Map<string, WindowState>();

/** A bounded in-memory limiter for managed single-instance development. */
export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetsAt <= now) {
    const next = { count: 1, resetsAt: now + windowMs };
    windows.set(key, next);
    return { allowed: true, remaining: limit - 1, resetsAt: next.resetsAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetsAt: current.resetsAt };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetsAt: current.resetsAt };
}

export async function consumeRegistryRateLimit(userId: number) {
  return consumeSharedRateLimit(`registry:${userId}`, 120, 60_000);
}
