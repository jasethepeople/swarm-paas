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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tenantUsage = mysqlTable("tenant_usage", {
  id: varchar("id", { length: 40 }).primaryKey(),
  userId: int("userId").notNull(),
  periodKey: varchar("periodKey", { length: 7 }).notNull(),
  generationCount: int("generationCount").notNull().default(0),
  inputTokens: int("inputTokens").notNull().default(0),
  outputTokens: int("outputTokens").notNull().default(0),
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

export type GeneratedApp = typeof generatedApps.$inferSelect;
export type GeneratedAppFile = typeof generatedAppFiles.$inferSelect;
export type GeneratedAppArtifact = typeof generatedAppArtifacts.$inferSelect;
export type GeneratedAppVersion = typeof generatedAppVersions.$inferSelect;
