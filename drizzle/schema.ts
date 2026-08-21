import { index, int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const generatedApps = mysqlTable("generated_apps", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  prompt: text("prompt").notNull(),
  status: mysqlEnum("status", ["generating", "ready", "failed", "archived"]).notNull().default("generating"),
  summary: text("summary"),
  model: varchar("model", { length: 96 }),
  schemaSummary: longtext("schemaSummary"),
  routes: longtext("routes"),
  componentTree: longtext("componentTree"),
  previewConfig: longtext("previewConfig"),
  sourceManifestKey: varchar("sourceManifestKey", { length: 512 }),
  sourceBundleKey: varchar("sourceBundleKey", { length: 512 }),
  sqliteArtifactKey: varchar("sqliteArtifactKey", { length: 512 }),
  exportArtifactKey: varchar("exportArtifactKey", { length: 512 }),
  latencyMs: int("latencyMs"),
  inputTokens: int("inputTokens"),
  outputTokens: int("outputTokens"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("generated_apps_user_created_idx").on(table.userId, table.createdAt)]);

export const generatedAppFiles = mysqlTable("generated_app_files", {
  id: varchar("id", { length: 32 }).primaryKey(),
  appId: varchar("appId", { length: 32 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  language: varchar("language", { length: 48 }).notNull(),
  content: longtext("content").notNull(),
  byteSize: int("byteSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("generated_app_files_app_idx").on(table.appId)]);

export const generatedAppArtifacts = mysqlTable("generated_app_artifacts", {
  id: varchar("id", { length: 32 }).primaryKey(),
  appId: varchar("appId", { length: 32 }).notNull(),
  kind: mysqlEnum("kind", ["source_manifest", "sqlite_database", "zip_export"]).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 640 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  contentType: varchar("contentType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("generated_app_artifacts_app_idx").on(table.appId)]);

export const builderApiKeys = mysqlTable("builder_api_keys", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 24 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
}, table => [index("builder_api_keys_user_idx").on(table.userId)]);

export const rateLimitWindows = mysqlTable("rate_limit_windows", {
  key: varchar("key", { length: 192 }).primaryKey(),
  count: int("count").notNull(),
  resetsAt: timestamp("resetsAt").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tenantQuotas = mysqlTable("tenant_quotas", {
  userId: int("userId").primaryKey(),
  monthlyGenerationLimit: int("monthlyGenerationLimit").notNull().default(12),
  monthlyTokenLimit: int("monthlyTokenLimit").notNull().default(200000),
  monthlyBudgetMicros: int("monthlyBudgetMicros").notNull().default(2500000),
  routingPolicy: mysqlEnum("routingPolicy", ["manual", "balanced", "lowest_cost"]).notNull().default("balanced"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tenantUsage = mysqlTable("tenant_usage", {
  id: varchar("id", { length: 40 }).primaryKey(),
  userId: int("userId").notNull(),
  periodKey: varchar("periodKey", { length: 7 }).notNull(),
  generationCount: int("generationCount").notNull().default(0),
  inputTokens: int("inputTokens").notNull().default(0),
  outputTokens: int("outputTokens").notNull().default(0),
  estimatedCostMicros: int("estimatedCostMicros").notNull().default(0),
  latencyTotalMs: int("latencyTotalMs").notNull().default(0),
  artifactBytes: int("artifactBytes").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("tenant_usage_user_period_idx").on(table.userId, table.periodKey)]);

export const generatedAppVersions = mysqlTable("generated_app_versions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  appId: varchar("appId", { length: 32 }).notNull(),
  versionNumber: int("versionNumber").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  sourceManifestKey: varchar("sourceManifestKey", { length: 512 }),
  sqliteArtifactKey: varchar("sqliteArtifactKey", { length: 512 }),
  exportArtifactKey: varchar("exportArtifactKey", { length: 512 }),
  schemaSummary: longtext("schemaSummary"),
  routes: longtext("routes"),
  componentTree: longtext("componentTree"),
  metadata: longtext("metadata"),
  fileSnapshot: longtext("fileSnapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("generated_app_versions_app_idx").on(table.appId, table.versionNumber)]);

export const modelRoutingPolicies = mysqlTable("model_routing_policies", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  model: varchar("model", { length: 96 }).notNull(),
  inputMicrosPer1k: int("inputMicrosPer1k").notNull(),
  outputMicrosPer1k: int("outputMicrosPer1k").notNull(),
  enabled: int("enabled").notNull().default(1),
  priority: int("priority").notNull().default(100),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("model_routing_policies_user_idx").on(table.userId, table.model)]);

export const organizations = mysqlTable("organizations", {
  id: varchar("id", { length: 32 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("organizations_owner_idx").on(table.ownerId)]);

export const organizationMembers = mysqlTable("organization_members", {
  id: varchar("id", { length: 32 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member", "viewer"]).notNull().default("member"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("organization_members_org_user_idx").on(table.organizationId, table.userId)]);

export const organizationInvitations = mysqlTable("organization_invitations", {
  id: varchar("id", { length: 32 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 32 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).notNull().default("member"),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("organization_invitations_org_idx").on(table.organizationId), index("organization_invitations_token_idx").on(table.tokenHash)]);

export const organizationAuditLogs = mysqlTable("organization_audit_logs", {
  id: varchar("id", { length: 32 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 32 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 96 }).notNull(),
  targetType: varchar("targetType", { length: 64 }).notNull(),
  targetId: varchar("targetId", { length: 64 }),
  metadata: longtext("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("organization_audit_org_created_idx").on(table.organizationId, table.createdAt)]);

export const appShareLinks = mysqlTable("app_share_links", {
  id: varchar("id", { length: 32 }).primaryKey(),
  appId: varchar("appId", { length: 32 }).notNull(),
  versionId: varchar("versionId", { length: 32 }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("app_share_links_app_idx").on(table.appId), index("app_share_links_token_idx").on(table.tokenHash)]);

export const appCollaborators = mysqlTable("app_collaborators", {
  id: varchar("id", { length: 32 }).primaryKey(),
  appId: varchar("appId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  access: mysqlEnum("access", ["viewer", "editor", "manager"]).notNull().default("viewer"),
  addedByUserId: int("addedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("app_collaborators_app_user_idx").on(table.appId, table.userId), index("app_collaborators_user_idx").on(table.userId)]);

export const appCollaborationInvitations = mysqlTable("app_collaboration_invitations", {
  id: varchar("id", { length: 32 }).primaryKey(),
  appId: varchar("appId", { length: 32 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  access: mysqlEnum("access", ["viewer", "editor", "manager"]).notNull().default("viewer"),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("app_collaboration_invitations_app_idx").on(table.appId), index("app_collaboration_invitations_token_idx").on(table.tokenHash)]);

export const webhookEndpoints = mysqlTable("webhook_endpoints", {
  id: varchar("id", { length: 32 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 32 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  events: longtext("events").notNull(),
  secretCiphertext: longtext("secretCiphertext").notNull(),
  active: int("active").notNull().default(1),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("webhook_endpoints_organization_idx").on(table.organizationId)]);

export const webhookDeliveries = mysqlTable("webhook_deliveries", {
  id: varchar("id", { length: 32 }).primaryKey(),
  endpointId: varchar("endpointId", { length: 32 }).notNull(),
  eventId: varchar("eventId", { length: 48 }).notNull(),
  eventType: varchar("eventType", { length: 96 }).notNull(),
  status: mysqlEnum("status", ["pending", "delivered", "failed"]).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  responseStatus: int("responseStatus"),
  errorMessage: varchar("errorMessage", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
}, table => [index("webhook_deliveries_endpoint_created_idx").on(table.endpointId, table.createdAt)]);

export const organizationBillingAccounts = mysqlTable("organization_billing_accounts", {
  organizationId: varchar("organizationId", { length: 32 }).primaryKey(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedApp = typeof generatedApps.$inferSelect;
export type GeneratedAppFile = typeof generatedAppFiles.$inferSelect;
export type GeneratedAppArtifact = typeof generatedAppArtifacts.$inferSelect;
export type GeneratedAppVersion = typeof generatedAppVersions.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type AppCollaborator = typeof appCollaborators.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
