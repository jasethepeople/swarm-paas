import { and, desc, eq, max, sql, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  appShareLinks,
  builderApiKeys,
  generatedAppArtifacts,
  generatedAppFiles,
  generatedApps,
  generatedAppVersions,
  InsertUser,
  modelRoutingPolicies,
  organizationAuditLogs,
  organizationInvitations,
  organizationMembers,
  organizations,
  rateLimitWindows,
  tenantQuotas,
  tenantUsage,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { canReserveTenantGeneration } from "./tenantControls";
import { defaultModelRates, estimateModelCostMicros, estimateTokens, routeModel, routingModels, type RoutingModel, type RoutingPolicy } from "./modelRouting";

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

export async function getGeneratedAppById(appId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(generatedApps).where(eq(generatedApps.id, appId)).limit(1);
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
    prompt: string;
    model: string;
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

const usagePeriod = () => new Date().toISOString().slice(0, 7);
const usageId = (userId: number, period: string) => `${userId}:${period}`;

export async function getTenantQuota(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select().from(tenantQuotas).where(eq(tenantQuotas.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(tenantQuotas).values({ userId, monthlyGenerationLimit: 12, monthlyTokenLimit: 200000, monthlyBudgetMicros: 2500000, routingPolicy: "balanced" });
  return (await db.select().from(tenantQuotas).where(eq(tenantQuotas.userId, userId)).limit(1))[0]!;
}

export async function getTenantUsage(userId: number, period = usagePeriod()) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select().from(tenantUsage).where(and(eq(tenantUsage.userId, userId), eq(tenantUsage.periodKey, period))).limit(1);
  return rows[0] || { id: usageId(userId, period), userId, periodKey: period, generationCount: 0, inputTokens: 0, outputTokens: 0, estimatedCostMicros: 0, latencyTotalMs: 0, artifactBytes: 0, updatedAt: new Date() };
}

export async function reserveTenantGeneration(userId: number, estimatedCostMicros = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [quota, usage] = await Promise.all([getTenantQuota(userId), getTenantUsage(userId)]);
  if (!canReserveTenantGeneration({ generationCount: usage.generationCount, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, monthlyGenerationLimit: quota.monthlyGenerationLimit, monthlyTokenLimit: quota.monthlyTokenLimit }) || usage.estimatedCostMicros + estimatedCostMicros > quota.monthlyBudgetMicros) {
    return { allowed: false, quota, usage };
  }
  const period = usage.periodKey;
  if (usage.generationCount === 0) {
    await db.insert(tenantUsage).values({ id: usageId(userId, period), userId, periodKey: period, generationCount: 1, inputTokens: 0, outputTokens: 0, estimatedCostMicros: 0, latencyTotalMs: 0, artifactBytes: 0 });
  } else {
    await db.update(tenantUsage).set({ generationCount: usage.generationCount + 1, updatedAt: new Date() }).where(eq(tenantUsage.id, usage.id));
  }
  return { allowed: true, quota, usage: { ...usage, generationCount: usage.generationCount + 1 } };
}

export async function recordTenantGenerationUsage(input: { userId: number; inputTokens: number; outputTokens: number; estimatedCostMicros: number; latencyMs: number; artifactBytes: number }) {
  const db = await getDb();
  if (!db) return;
  const current = await getTenantUsage(input.userId);
  await db.insert(tenantUsage).values({ id: current.id, userId: input.userId, periodKey: current.periodKey, generationCount: current.generationCount, inputTokens: current.inputTokens + input.inputTokens, outputTokens: current.outputTokens + input.outputTokens, estimatedCostMicros: current.estimatedCostMicros + input.estimatedCostMicros, latencyTotalMs: current.latencyTotalMs + input.latencyMs, artifactBytes: current.artifactBytes + input.artifactBytes }).onDuplicateKeyUpdate({
    set: { inputTokens: current.inputTokens + input.inputTokens, outputTokens: current.outputTokens + input.outputTokens, estimatedCostMicros: current.estimatedCostMicros + input.estimatedCostMicros, latencyTotalMs: current.latencyTotalMs + input.latencyMs, artifactBytes: current.artifactBytes + input.artifactBytes, updatedAt: new Date() },
  });
}

export async function getTenantAnalytics(userId: number) {
  const [quota, usage, apps] = await Promise.all([getTenantQuota(userId), getTenantUsage(userId), listGeneratedApps(userId)]);
  const completed = apps.filter(app => app.status === "ready");
  return {
    periodKey: usage.periodKey,
    quota: { generations: quota.monthlyGenerationLimit, tokens: quota.monthlyTokenLimit, budgetMicros: quota.monthlyBudgetMicros, routingPolicy: quota.routingPolicy },
    usage: { generations: usage.generationCount, tokens: usage.inputTokens + usage.outputTokens, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostMicros: usage.estimatedCostMicros, artifactBytes: usage.artifactBytes, averageLatencyMs: completed.length ? Math.round(usage.latencyTotalMs / completed.length) : 0 },
    models: Object.entries(completed.reduce<Record<string, number>>((acc, app) => { acc[app.model || "fallback"] = (acc[app.model || "fallback"] || 0) + 1; return acc; }, {})).map(([model, generations]) => ({ model, generations })),
    recentActivity: apps.slice(0, 6).map(app => ({ id: app.id, name: app.name, status: app.status, model: app.model || "fallback", createdAt: app.createdAt, latencyMs: app.latencyMs || 0, tokens: (app.inputTokens || 0) + (app.outputTokens || 0) })),
  };
}

export async function updateTenantQuota(userId: number, limits: { monthlyGenerationLimit: number; monthlyTokenLimit: number; monthlyBudgetMicros?: number; routingPolicy?: RoutingPolicy }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const current = await getTenantQuota(userId);
  const values = { monthlyGenerationLimit: limits.monthlyGenerationLimit, monthlyTokenLimit: limits.monthlyTokenLimit, monthlyBudgetMicros: limits.monthlyBudgetMicros ?? current.monthlyBudgetMicros, routingPolicy: limits.routingPolicy ?? current.routingPolicy };
  await db.insert(tenantQuotas).values({ userId, ...values }).onDuplicateKeyUpdate({
    set: { ...values, updatedAt: new Date() },
  });
  return getTenantQuota(userId);
}

export async function createGeneratedAppVersion(input: { id: string; appId: string; versionNumber: number; label: string; sourceManifestKey?: string; sqliteArtifactKey?: string; exportArtifactKey?: string; schemaSummary?: string; routes?: string; componentTree?: string; metadata?: string; fileSnapshot: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(generatedAppVersions).values(input);
}

export async function listGeneratedAppVersions(appId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedAppVersions).where(eq(generatedAppVersions.appId, appId)).orderBy(desc(generatedAppVersions.versionNumber));
}

export async function getGeneratedAppVersion(appId: string, versionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(generatedAppVersions).where(and(eq(generatedAppVersions.appId, appId), eq(generatedAppVersions.id, versionId))).limit(1);
  return rows[0];
}

export async function replaceGeneratedAppFiles(appId: string, files: Array<{ id: string; path: string; language: string; content: string; byteSize: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(generatedAppFiles).where(eq(generatedAppFiles.appId, appId));
  if (files.length) await db.insert(generatedAppFiles).values(files.map(file => ({ ...file, appId })));
}

export async function getModelRoutingPolicies(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  let rows = await db.select().from(modelRoutingPolicies).where(eq(modelRoutingPolicies.userId, userId));
  if (!rows.length) {
    await db.insert(modelRoutingPolicies).values(routingModels.map(model => ({ id: nanoid(18), userId, model, ...defaultModelRates[model], enabled: 1 })));
    rows = await db.select().from(modelRoutingPolicies).where(eq(modelRoutingPolicies.userId, userId));
  }
  return rows;
}

export async function updateModelRoutingPolicies(userId: number, policies: Array<{ model: RoutingModel; inputMicrosPer1k: number; outputMicrosPer1k: number; enabled: boolean; priority: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(modelRoutingPolicies).where(eq(modelRoutingPolicies.userId, userId));
  await db.insert(modelRoutingPolicies).values(policies.map(policy => ({ id: nanoid(18), userId, ...policy, enabled: policy.enabled ? 1 : 0 })));
  return getModelRoutingPolicies(userId);
}

export async function resolveTenantModelRoute(userId: number, requestedModel: RoutingModel, prompt: string) {
  const [quota, usage, stored] = await Promise.all([getTenantQuota(userId), getTenantUsage(userId), getModelRoutingPolicies(userId)]);
  const rates = stored.filter(policy => routingModels.includes(policy.model as RoutingModel)).map(policy => ({ model: policy.model as RoutingModel, inputMicrosPer1k: policy.inputMicrosPer1k, outputMicrosPer1k: policy.outputMicrosPer1k, enabled: Boolean(policy.enabled), priority: policy.priority }));
  return routeModel({ requestedModel, policy: quota.routingPolicy as RoutingPolicy, rates, inputTokens: estimateTokens(prompt), budgetRemainingMicros: Math.max(0, quota.monthlyBudgetMicros - usage.estimatedCostMicros) });
}

export async function getOrCreateOrganization(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  let [organization] = await db.select().from(organizations).where(eq(organizations.ownerId, userId)).limit(1);
  if (!organization) {
    organization = { id: nanoid(18), ownerId: userId, name: "Personal workspace", createdAt: new Date(), updatedAt: new Date() };
    await db.insert(organizations).values(organization);
    await db.insert(organizationMembers).values({ id: nanoid(18), organizationId: organization.id, userId, role: "owner" });
    await createOrganizationAuditEvent({ organizationId: organization.id, actorUserId: userId, action: "organization.created", targetType: "organization", targetId: organization.id });
  }
  return organization;
}

export async function getOrganizationMembership(organizationId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))).limit(1);
  return rows[0];
}

export async function listOrganizationMembers(organizationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, organizationId)).orderBy(desc(organizationMembers.createdAt));
}

export async function createOrganizationAuditEvent(input: { organizationId: string; actorUserId: number; action: string; targetType: string; targetId?: string; metadata?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(organizationAuditLogs).values({ id: nanoid(18), ...input });
}

export async function listOrganizationAuditEvents(organizationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizationAuditLogs).where(eq(organizationAuditLogs.organizationId, organizationId)).orderBy(desc(organizationAuditLogs.createdAt)).limit(60);
}

export async function upsertOrganizationMember(input: { organizationId: string; userId: number; role: "owner" | "admin" | "member" | "viewer" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = await getOrganizationMembership(input.organizationId, input.userId);
  if (existing) await db.update(organizationMembers).set({ role: input.role, updatedAt: new Date() }).where(eq(organizationMembers.id, existing.id));
  else await db.insert(organizationMembers).values({ id: nanoid(18), ...input });
}

export async function removeOrganizationMember(organizationId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)));
}

export async function createOrganizationInvitation(input: { organizationId: string; email: string; role: "admin" | "member" | "viewer"; tokenHash: string; invitedByUserId: number; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const id = nanoid(18);
  await db.insert(organizationInvitations).values({ id, ...input, email: input.email.toLowerCase() });
  return id;
}

export async function listOrganizationInvitations(organizationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizationInvitations).where(eq(organizationInvitations.organizationId, organizationId)).orderBy(desc(organizationInvitations.createdAt));
}

export async function getActiveOrganizationInvitation(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(organizationInvitations).where(eq(organizationInvitations.tokenHash, tokenHash)).limit(1);
  const invitation = rows[0];
  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) return undefined;
  return invitation;
}

export async function acceptOrganizationInvitation(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(organizationInvitations).set({ acceptedAt: new Date() }).where(eq(organizationInvitations.id, id));
}

export async function createAppShareLink(input: { appId: string; versionId?: string; tokenHash: string; createdByUserId: number; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const id = nanoid(18);
  await db.insert(appShareLinks).values({ id, ...input });
  return id;
}

export async function listAppShareLinks(appId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appShareLinks).where(eq(appShareLinks.appId, appId)).orderBy(desc(appShareLinks.createdAt));
}

export async function revokeAppShareLink(id: string, appId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(appShareLinks).set({ revokedAt: new Date() }).where(and(eq(appShareLinks.id, id), eq(appShareLinks.appId, appId)));
}

export async function getActiveAppShareLink(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(appShareLinks).where(eq(appShareLinks.tokenHash, tokenHash)).limit(1);
  const link = rows[0];
  if (!link || link.revokedAt || link.expiresAt.getTime() <= Date.now()) return undefined;
  return link;
}
