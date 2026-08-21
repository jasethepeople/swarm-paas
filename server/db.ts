import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  builderApiKeys,
  generatedAppArtifacts,
  generatedAppFiles,
  generatedApps,
  InsertUser,
  rateLimitWindows,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createGeneratedApp(input: {
  id: string;
  userId: number;
  name: string;
  prompt: string;
  model?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(generatedApps).values({ ...input, status: "generating" });
}

export async function getGeneratedAppForUser(appId: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(generatedApps).where(and(eq(generatedApps.id, appId), eq(generatedApps.userId, userId))).limit(1);
  return rows[0];
}

export async function listGeneratedApps(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedApps).where(eq(generatedApps.userId, userId)).orderBy(desc(generatedApps.createdAt));
}

export async function updateGeneratedApp(
  appId: string,
  userId: number,
  updates: Partial<{
    name: string;
    status: "generating" | "ready" | "failed" | "archived";
    summary: string;
    schemaSummary: string;
    routes: string;
    componentTree: string;
    previewConfig: string;
    sourceManifestKey: string;
    sourceBundleKey: string;
    sqliteArtifactKey: string;
    exportArtifactKey: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    error: string;
  }>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(generatedApps).set({ ...updates, updatedAt: new Date() }).where(and(eq(generatedApps.id, appId), eq(generatedApps.userId, userId)));
}

export async function deleteGeneratedApp(appId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(generatedAppFiles).where(eq(generatedAppFiles.appId, appId));
  await db.delete(generatedAppArtifacts).where(eq(generatedAppArtifacts.appId, appId));
  await db.delete(generatedApps).where(and(eq(generatedApps.id, appId), eq(generatedApps.userId, userId)));
}

export async function createGeneratedAppFile(input: {
  id: string;
  appId: string;
  path: string;
  language: string;
  content: string;
  byteSize: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(generatedAppFiles).values(input);
}

export async function listGeneratedAppFiles(appId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedAppFiles).where(eq(generatedAppFiles.appId, appId));
}

export async function getGeneratedAppFile(appId: string, path: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(generatedAppFiles).where(and(eq(generatedAppFiles.appId, appId), eq(generatedAppFiles.path, path))).limit(1);
  return rows[0];
}

export async function createGeneratedAppArtifact(input: {
  id: string;
  appId: string;
  kind: "source_manifest" | "sqlite_database" | "zip_export";
  storageKey: string;
  storageUrl: string;
  filename: string;
  contentType: string;
  byteSize: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(generatedAppArtifacts).values(input);
}

export async function listGeneratedAppArtifacts(appId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedAppArtifacts).where(eq(generatedAppArtifacts.appId, appId)).orderBy(desc(generatedAppArtifacts.createdAt));
}

export async function createBuilderApiKey(input: {
  id: string;
  userId: number;
  label: string;
  keyPrefix: string;
  tokenHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(builderApiKeys).values(input);
}

export async function getBuilderApiKeyByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(builderApiKeys).where(eq(builderApiKeys.tokenHash, tokenHash)).limit(1);
  return rows[0];
}

export async function touchBuilderApiKey(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(builderApiKeys).set({ lastUsedAt: new Date() }).where(eq(builderApiKeys.id, id));
}

/**
 * Uses an atomic MySQL upsert so rate limits are shared across instances and
 * survive process restarts. The row is reset on its first request after expiry.
 */
export async function consumeSharedRateLimit(key: string, limit: number, windowMs: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for rate limiting");
  const nextReset = new Date(Date.now() + windowMs);
  await db.insert(rateLimitWindows).values({ key, count: 1, resetsAt: nextReset }).onDuplicateKeyUpdate({
    set: {
      count: sql`IF(${rateLimitWindows.resetsAt} <= CURRENT_TIMESTAMP, 1, ${rateLimitWindows.count} + 1)`,
      resetsAt: sql`IF(${rateLimitWindows.resetsAt} <= CURRENT_TIMESTAMP, ${nextReset}, ${rateLimitWindows.resetsAt})`,
      updatedAt: new Date(),
    },
  });
  const rows = await db.select().from(rateLimitWindows).where(eq(rateLimitWindows.key, key)).limit(1);
  const state = rows[0];
  if (!state) throw new Error("Rate limit state could not be read");
  return { allowed: state.count <= limit, remaining: Math.max(0, limit - state.count), resetsAt: state.resetsAt.getTime() };
}
