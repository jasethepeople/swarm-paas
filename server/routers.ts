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
} from "./db";
import { consumeRegistryRateLimit } from "./rateLimit";
import { storageGetSignedUrl } from "./storage";

const registryProcedure = protectedProcedure.use(({ ctx, next }) => {
  return consumeRegistryRateLimit(ctx.user.id).then(rate => {
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Registry rate limit reached. Please retry shortly." });
  }
    return next();
  });
});

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
  }),
});

export type AppRouter = typeof appRouter;
