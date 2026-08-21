import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createBuilderApiKey,
  deleteGeneratedApp,
  getGeneratedAppFile,
  getGeneratedAppForUser,
  listGeneratedAppArtifacts,
  listGeneratedAppFiles,
  listGeneratedApps,
  listGeneratedAppVersions,
  getGeneratedAppVersion,
  createGeneratedAppVersion,
  replaceGeneratedAppFiles,
  updateGeneratedApp,
  createAppShareLink,
  revokeAppShareLink,
  listAppShareLinks,
  getModelRoutingPolicies,
  updateModelRoutingPolicies,
  getOrCreateOrganization,
  getOrganizationMembership,
  listOrganizationMembers,
  createOrganizationAuditEvent,
  listOrganizationAuditEvents,
  upsertOrganizationMember,
  removeOrganizationMember,
  createOrganizationInvitation,
  listOrganizationInvitations,
  getActiveOrganizationInvitation,
  acceptOrganizationInvitation,
  getTenantAnalytics,
  getTenantQuota,
  updateTenantQuota,
} from "./db";
import { consumeRegistryRateLimit } from "./rateLimit";
import { storageGetSignedUrl } from "./storage";
import { selectableModels } from "./appBuilder";
import { diffFileSnapshots } from "./versioning";
import { routingModels } from "./modelRouting";
import { canManageOrganization, canModifyMember, invitationMatchesUser } from "./governance";

const registryProcedure = protectedProcedure.use(({ ctx, next }) => {
  return consumeRegistryRateLimit(ctx.user.id).then(rate => {
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Registry rate limit reached. Please retry shortly." });
  }
    return next();
  });
});

async function requireOrganizationManager(userId: number) {
  const organization = await getOrCreateOrganization(userId);
  const membership = await getOrganizationMembership(organization.id, userId);
  if (!membership || !canManageOrganization(membership.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Organization manager access is required" });
  }
  return { organization, membership };
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  apps: router({
    list: registryProcedure.query(({ ctx }) => listGeneratedApps(ctx.user.id)),
    get: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      return app;
    }),
    files: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      return listGeneratedAppFiles(app.id);
    }),
    file: registryProcedure.input(z.object({ appId: z.string().min(1).max(32), path: z.string().min(1).max(512) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      const file = await getGeneratedAppFile(app.id, input.path);
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      return file;
    }),
    artifacts: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      return listGeneratedAppArtifacts(app.id);
    }),
    manifest: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      if (!app.sourceManifestKey) throw new TRPCError({ code: "NOT_FOUND", message: "Source manifest is not available" });
      const signedUrl = await storageGetSignedUrl(app.sourceManifestKey);
      const response = await fetch(signedUrl);
      if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Source manifest could not be retrieved" });
      return (await response.json()) as unknown;
    }),
    delete: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).mutation(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      await deleteGeneratedApp(app.id, ctx.user.id);
      return { success: true };
    }),
    versions: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      let versions = await listGeneratedAppVersions(app.id);
      if (!versions.length) {
        const files = await listGeneratedAppFiles(app.id);
        if (files.length) {
          await createGeneratedAppVersion({ id: nanoid(18), appId: app.id, versionNumber: 1, label: "Imported baseline", sourceManifestKey: app.sourceManifestKey || undefined, sqliteArtifactKey: app.sqliteArtifactKey || undefined, exportArtifactKey: app.exportArtifactKey || undefined, schemaSummary: app.schemaSummary || undefined, routes: app.routes || undefined, componentTree: app.componentTree || undefined, metadata: JSON.stringify({ name: app.name, summary: app.summary, prompt: app.prompt, model: app.model, previewConfig: app.previewConfig ? JSON.parse(app.previewConfig) : undefined }), fileSnapshot: JSON.stringify(files.map(file => ({ path: file.path, language: file.language, content: file.content }))) });
          versions = await listGeneratedAppVersions(app.id);
        }
      }
      return versions;
    }),
    diff: registryProcedure.input(z.object({ appId: z.string().min(1).max(32), fromVersionId: z.string().min(1).max(32), toVersionId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      const [fromVersion, toVersion] = await Promise.all([getGeneratedAppVersion(app.id, input.fromVersionId), getGeneratedAppVersion(app.id, input.toVersionId)]);
      if (!fromVersion || !toVersion) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      const fromFiles = JSON.parse(fromVersion.fileSnapshot) as Array<{ path: string; language: string; content: string }>;
      const toFiles = JSON.parse(toVersion.fileSnapshot) as Array<{ path: string; language: string; content: string }>;
      return diffFileSnapshots(fromFiles, toFiles);
    }),
    rollback: registryProcedure.input(z.object({ appId: z.string().min(1).max(32), versionId: z.string().min(1).max(32) })).mutation(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      const target = await getGeneratedAppVersion(app.id, input.versionId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      const currentFiles = await listGeneratedAppFiles(app.id);
      const versions = await listGeneratedAppVersions(app.id);
      await createGeneratedAppVersion({ id: nanoid(18), appId: app.id, versionNumber: Math.max(0, ...versions.map(version => version.versionNumber)) + 1, label: "Pre-rollback safeguard", sourceManifestKey: app.sourceManifestKey || undefined, sqliteArtifactKey: app.sqliteArtifactKey || undefined, exportArtifactKey: app.exportArtifactKey || undefined, schemaSummary: app.schemaSummary || undefined, routes: app.routes || undefined, componentTree: app.componentTree || undefined, metadata: JSON.stringify({ name: app.name, summary: app.summary, prompt: app.prompt, model: app.model, previewConfig: app.previewConfig ? JSON.parse(app.previewConfig) : undefined }), fileSnapshot: JSON.stringify(currentFiles.map(file => ({ path: file.path, language: file.language, content: file.content }))) });
      const files = JSON.parse(target.fileSnapshot) as Array<{ path: string; language: string; content: string }>;
      let metadata = target.metadata ? JSON.parse(target.metadata) as { name?: string; summary?: string; prompt?: string; model?: string; previewConfig?: unknown } : undefined;
      if (!metadata && target.sourceManifestKey) {
        try {
          const response = await fetch(await storageGetSignedUrl(target.sourceManifestKey));
          if (response.ok) {
            const manifest = await response.json() as { name?: string; summary?: string };
            const inferredPrompt = manifest.summary?.match(/for:\s*(.+)$/i)?.[1];
            metadata = { name: manifest.name, summary: manifest.summary, prompt: inferredPrompt, previewConfig: { title: manifest.name, description: manifest.summary } };
          }
        } catch { /* Legacy snapshots still restore their source files if manifest metadata is unavailable. */ }
      }
      await replaceGeneratedAppFiles(app.id, files.map(file => ({ id: nanoid(18), path: file.path, language: file.language, content: file.content, byteSize: Buffer.byteLength(file.content) })));
      await updateGeneratedApp(app.id, ctx.user.id, { name: metadata?.name || app.name, summary: metadata?.summary || app.summary || "", prompt: metadata?.prompt || app.prompt, model: metadata?.model || app.model || "gpt-5-mini", previewConfig: metadata?.previewConfig ? JSON.stringify(metadata.previewConfig) : app.previewConfig || "", schemaSummary: target.schemaSummary || "[]", routes: target.routes || "[]", componentTree: target.componentTree || "[]", sourceManifestKey: target.sourceManifestKey || "", sqliteArtifactKey: target.sqliteArtifactKey || "", exportArtifactKey: target.exportArtifactKey || "", sourceBundleKey: target.sourceManifestKey || "", status: "ready" });
      return { success: true, restoredVersion: target.versionNumber };
    }),
    shares: registryProcedure.input(z.object({ appId: z.string().min(1).max(32) })).query(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      return listAppShareLinks(app.id);
    }),
    createShare: registryProcedure.input(z.object({ appId: z.string().min(1).max(32), versionId: z.string().min(1).max(32), expiresInHours: z.number().int().min(1).max(720).default(72) })).mutation(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      if (!await getGeneratedAppVersion(app.id, input.versionId)) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      const rawToken = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
      const id = await createAppShareLink({ appId: app.id, versionId: input.versionId, createdByUserId: ctx.user.id, tokenHash: createHash("sha256").update(rawToken).digest("hex"), expiresAt });
      const organization = await getOrCreateOrganization(ctx.user.id);
      await createOrganizationAuditEvent({ organizationId: organization.id, actorUserId: ctx.user.id, action: "preview.share_created", targetType: "app_share_link", targetId: id, metadata: JSON.stringify({ appId: app.id, versionId: input.versionId, expiresInHours: input.expiresInHours }) });
      return { id, path: `/share/${rawToken}`, expiresAt };
    }),
    revokeShare: registryProcedure.input(z.object({ appId: z.string().min(1).max(32), shareId: z.string().min(1).max(32) })).mutation(async ({ ctx, input }) => {
      const app = await getGeneratedAppForUser(input.appId, ctx.user.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      await revokeAppShareLink(input.shareId, app.id);
      const organization = await getOrCreateOrganization(ctx.user.id);
      await createOrganizationAuditEvent({ organizationId: organization.id, actorUserId: ctx.user.id, action: "preview.share_revoked", targetType: "app_share_link", targetId: input.shareId, metadata: JSON.stringify({ appId: app.id }) });
      return { success: true };
    }),
  }),
  analytics: router({
    overview: protectedProcedure.query(({ ctx }) => getTenantAnalytics(ctx.user.id)),
    quota: protectedProcedure.query(({ ctx }) => getTenantQuota(ctx.user.id)),
    updateQuota: protectedProcedure.input(z.object({ monthlyGenerationLimit: z.number().int().min(1).max(1000), monthlyTokenLimit: z.number().int().min(10_000).max(20_000_000), monthlyBudgetMicros: z.number().int().min(10_000).max(500_000_000).optional(), routingPolicy: z.enum(["manual", "balanced", "lowest_cost"]).optional() })).mutation(({ ctx, input }) => updateTenantQuota(ctx.user.id, input)),
  }),
  routing: router({
    policies: protectedProcedure.query(({ ctx }) => getModelRoutingPolicies(ctx.user.id)),
    updatePolicies: protectedProcedure.input(z.object({ policies: z.array(z.object({ model: z.enum(routingModels), inputMicrosPer1k: z.number().int().min(1).max(100_000), outputMicrosPer1k: z.number().int().min(1).max(100_000), enabled: z.boolean(), priority: z.number().int().min(1).max(999) })).min(1).max(routingModels.length) })).mutation(({ ctx, input }) => updateModelRoutingPolicies(ctx.user.id, input.policies)),
  }),
  organization: router({
    context: protectedProcedure.query(async ({ ctx }) => {
      const organization = await getOrCreateOrganization(ctx.user.id);
      const [membership, members, invitations, audit] = await Promise.all([getOrganizationMembership(organization.id, ctx.user.id), listOrganizationMembers(organization.id), listOrganizationInvitations(organization.id), listOrganizationAuditEvents(organization.id)]);
      return { organization, membership, members, invitations, audit };
    }),
    invite: protectedProcedure.input(z.object({ email: z.string().email().max(320), role: z.enum(["admin", "member", "viewer"]), expiresInHours: z.number().int().min(1).max(720).default(168) })).mutation(async ({ ctx, input }) => {
      const { organization } = await requireOrganizationManager(ctx.user.id);
      const rawToken = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
      const id = await createOrganizationInvitation({ organizationId: organization.id, email: input.email, role: input.role, tokenHash: createHash("sha256").update(rawToken).digest("hex"), invitedByUserId: ctx.user.id, expiresAt });
      await createOrganizationAuditEvent({ organizationId: organization.id, actorUserId: ctx.user.id, action: "member.invited", targetType: "organization_invitation", targetId: id, metadata: JSON.stringify({ email: input.email, role: input.role, expiresAt }) });
      return { id, path: `/invite/${rawToken}`, expiresAt };
    }),
    acceptInvitation: protectedProcedure.input(z.object({ token: z.string().min(20).max(160) })).mutation(async ({ ctx, input }) => {
      const invitation = await getActiveOrganizationInvitation(createHash("sha256").update(input.token).digest("hex"));
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation is invalid or expired" });
      if (!invitationMatchesUser(invitation.email, ctx.user.email)) throw new TRPCError({ code: "FORBIDDEN", message: "This invitation was issued to a different email address" });
      await upsertOrganizationMember({ organizationId: invitation.organizationId, userId: ctx.user.id, role: invitation.role });
      await acceptOrganizationInvitation(invitation.id);
      await createOrganizationAuditEvent({ organizationId: invitation.organizationId, actorUserId: ctx.user.id, action: "member.joined", targetType: "organization_member", targetId: String(ctx.user.id) });
      return { success: true };
    }),
    updateRole: protectedProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["admin", "member", "viewer"]) })).mutation(async ({ ctx, input }) => {
      const { organization } = await requireOrganizationManager(ctx.user.id);
      if (!canModifyMember("owner", input.userId, organization.ownerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "The owner role cannot be changed here" });
      await upsertOrganizationMember({ organizationId: organization.id, userId: input.userId, role: input.role });
      await createOrganizationAuditEvent({ organizationId: organization.id, actorUserId: ctx.user.id, action: "member.role_updated", targetType: "organization_member", targetId: String(input.userId), metadata: JSON.stringify({ role: input.role }) });
      return { success: true };
    }),
    removeMember: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { organization } = await requireOrganizationManager(ctx.user.id);
      if (!canModifyMember("owner", input.userId, organization.ownerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "The organization owner cannot be removed" });
      await removeOrganizationMember(organization.id, input.userId);
      await createOrganizationAuditEvent({ organizationId: organization.id, actorUserId: ctx.user.id, action: "member.removed", targetType: "organization_member", targetId: String(input.userId) });
      return { success: true };
    }),
  }),
  developer: router({
    createApiKey: protectedProcedure.input(z.object({ label: z.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      const rawKey = `ab_live_${randomBytes(24).toString("base64url")}`;
      await createBuilderApiKey({
        id: nanoid(18),
        userId: ctx.user.id,
        label: input.label,
        keyPrefix: rawKey.slice(0, 16),
        tokenHash: createHash("sha256").update(rawKey).digest("hex"),
      });
      return { apiKey: rawKey, endpoint: "/api/mcp" };
    }),
    models: protectedProcedure.query(() => selectableModels),
  }),
});

export type AppRouter = typeof appRouter;
