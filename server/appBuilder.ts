import { nanoid } from "nanoid";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import path from "node:path";
import {
  createGeneratedApp,
  createGeneratedAppArtifact,
  createGeneratedAppFile,
  createGeneratedAppVersion,
  getGeneratedAppForUser,
  listGeneratedAppVersions,
  recordTenantGenerationUsage,
  replaceGeneratedAppFiles,
  reserveTenantGeneration,
  updateGeneratedApp,
} from "./db";
import { invokeLLM, streamLLMText } from "./_core/llm";
import { storagePut } from "./storage";

export type GeneratedFile = { path: string; language: string; content: string };
export type AppSchemaTable = { name: string; fields: Array<{ name: string; type: string; required: boolean }> };
export type GeneratedProject = {
  name: string;
  summary: string;
  routes: Array<{ path: string; purpose: string }>;
  schema: AppSchemaTable[];
  components: string[];
  files: GeneratedFile[];
};
export type GenerationEvent =
  | { type: "status"; message: string; appId: string }
  | { type: "file"; path: string; language: string; content: string; appId: string }
  | { type: "token"; text: string; appId: string }
  | { type: "artifact"; kind: string; url: string; appId: string }
  | { type: "complete"; appId: string }
  | { type: "error"; message: string; appId: string };

export const selectableModels = ["gpt-5-mini", "gpt-5", "claude-sonnet-4-6", "gemini-3-flash-preview"] as const;
export type SelectableModel = typeof selectableModels[number];

const codeSchema = {
  name: "generated_micro_application",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      summary: { type: "string" },
      routes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { path: { type: "string" }, purpose: { type: "string" } },
          required: ["path", "purpose"],
        },
      },
      schema: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: { name: { type: "string" }, type: { type: "string" }, required: { type: "boolean" } },
                required: ["name", "type", "required"],
              },
            },
          },
          required: ["name", "fields"],
        },
      },
      components: { type: "array", items: { type: "string" } },
      files: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { path: { type: "string" }, language: { type: "string" }, content: { type: "string" } },
          required: ["path", "language", "content"],
        },
      },
    },
    required: ["name", "summary", "routes", "schema", "components", "files"],
  },
} as const;

function titleFromPrompt(prompt: string) {
  const words = prompt.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 4);
  return words.length ? words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "Untitled Application";
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "generated-app";
}

function escapeForJs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

export function fallbackProject(prompt: string): GeneratedProject {
  const name = titleFromPrompt(prompt);
  const packageName = safeName(name);
  const promptCopy = escapeForJs(prompt.slice(0, 240));
  return {
    name,
    summary: `A generated React and Node.js micro-application for: ${prompt.slice(0, 180)}`,
    routes: [{ path: "/", purpose: "Primary workspace" }, { path: "/api/health", purpose: "Service health probe" }],
    schema: [{ name: "items", fields: [{ name: "id", type: "text", required: true }, { name: "created_at", type: "integer", required: true }, { name: "label", type: "text", required: true }] }],
    components: ["App", "WorkspaceCard", "StatusRail"],
    files: [
      { path: "package.json", language: "json", content: JSON.stringify({ name: packageName, private: true, type: "module", scripts: { dev: "concurrently \"pnpm --dir client dev\" \"pnpm --dir server dev\"", build: "pnpm --dir client build && pnpm --dir server build", start: "node server/dist/index.js" }, dependencies: { express: "^4.21.2", react: "^19.2.1", "react-dom": "^19.2.1" }, devDependencies: { concurrently: "^9.1.2", typescript: "^5.9.3", vite: "^7.1.7" } }, null, 2) },
      { path: "client/src/main.jsx", language: "jsx", content: `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport "./styles.css";\n\nconst prompt = \`${promptCopy}\`;\nfunction App() {\n  return <main className="shell"><p className="eyebrow">GENERATED MICRO-APP</p><h1>${escapeForJs(name)}</h1><p className="prompt">{prompt}</p><section><strong>READY</strong><span> Your workspace is running.</span></section></main>;\n}\ncreateRoot(document.getElementById("root")).render(<App />);\n` },
      { path: "client/src/styles.css", language: "css", content: `:root{font-family:Inter,system-ui;background:#0a0d14;color:#f8fafc}*{box-sizing:border-box}body{margin:0}.shell{min-height:100vh;padding:12vh 10vw;background:radial-gradient(circle at 10% 10%,#334155,transparent 35%),#0a0d14}.eyebrow{letter-spacing:.18em;font-size:.72rem;color:#67e8f9}h1{font-size:clamp(2rem,7vw,5rem);max-width:12ch}.prompt{max-width:58ch;color:#cbd5e1}section{margin-top:3rem;padding:1rem;border:1px solid #334155;border-radius:1rem;background:#ffffff0d}` },
      { path: "client/index.html", language: "html", content: "<div id=\"root\"></div><script type=\"module\" src=\"/src/main.jsx\"></script>" },
      { path: "server/src/index.js", language: "javascript", content: "import express from 'express';\nconst app=express();\napp.get('/api/health',(_,res)=>res.json({status:'ok'}));\napp.listen(process.env.PORT||3001);" },
      { path: "Dockerfile", language: "dockerfile", content: "FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN corepack enable && pnpm install --frozen-lockfile=false && pnpm build\nEXPOSE 3001\nCMD [\"pnpm\", \"start\"]\n" },
      { path: "README.md", language: "markdown", content: `# ${name}\n\nGenerated from: ${prompt}\n\n## Local run\n\n\`pnpm install && pnpm dev\`\n` },
    ],
  };
}

function languageForPath(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  return ({ ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", json: "json", css: "css", html: "html", md: "markdown", sql: "sql", yml: "yaml", yaml: "yaml" } as Record<string, string>)[extension || ""] || "text";
}

export function normalizeGeneratedFiles(files: GeneratedFile[]) {
  const paths = new Set<string>();
  return files.slice(0, 36).map(file => {
    const normalized = file.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized || normalized.split("/").includes("..") || normalized.includes("\0")) {
      throw new Error("Generated a file with an unsafe path");
    }
    if (paths.has(normalized)) throw new Error(`Generated duplicate file path: ${normalized}`);
    paths.add(normalized);
    return { path: normalized, language: file.language || languageForPath(normalized), content: file.content.slice(0, 180_000) };
  });
}

async function generateProject(prompt: string, model: SelectableModel, onToken: (token: string) => void): Promise<{ project: GeneratedProject; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  try {
    const request = {
      model,
      maxTokens: 4_800,
      messages: [
        { role: "system", content: "You are an expert full-stack engineer. Create a small, production-minded React and Node.js micro-application. Return only the requested JSON schema. Include a Dockerfile, a client entry point, a server entry point, a concise package manifest, and only the minimum useful files. Never include secrets." },
        { role: "user", content: `Build an application from this brief:\n${prompt}` },
      ],
      response_format: { type: "json_schema", json_schema: codeSchema },
    } satisfies Parameters<typeof invokeLLM>[0];
    const streamAttempt = streamLLMText(request, onToken);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Model generation exceeded the 45-second interactive budget")), 45_000));
    const streamed = await Promise.race([streamAttempt, timeout]);
    if (streamed?.content) {
      const parsed = JSON.parse(streamed.content) as GeneratedProject;
      return { project: { ...parsed, files: normalizeGeneratedFiles(parsed.files) }, usage: streamed.usage };
    }
    const response = await Promise.race([invokeLLM(request), timeout]);
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") throw new Error("Model returned no structured application payload");
    const parsed = JSON.parse(content) as GeneratedProject;
    return { project: { ...parsed, files: normalizeGeneratedFiles(parsed.files) }, usage: response.usage };
  } catch (error) {
    console.warn("[AppBuilder] Model generation fell back to deterministic project scaffolding:", error instanceof Error ? error.message : error);
    return { project: fallbackProject(prompt) };
  }
}

function sqlIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 54) || "generated_table";
}

export async function createIsolatedSqliteBundle(project: GeneratedProject) {
  const SQL = await initSqlJs({ locateFile: file => path.join(process.cwd(), "node_modules", "sql.js", "dist", file) });
  const database = new SQL.Database();
  for (const table of project.schema.slice(0, 12)) {
    const reservedColumns = new Set(["id", "created_at"]);
    const seenColumns = new Set(reservedColumns);
    const fields = table.fields.slice(0, 24).flatMap(field => {
      const column = sqlIdentifier(field.name);
      if (seenColumns.has(column)) return [];
      seenColumns.add(column);
      return `"${column}" ${field.type.toLowerCase().includes("int") ? "INTEGER" : "TEXT"}${field.required ? " NOT NULL" : ""}`;
    });
    const columns = ["id TEXT PRIMARY KEY", ...fields, "created_at INTEGER NOT NULL"].join(", ");
    database.run(`CREATE TABLE IF NOT EXISTS "${sqlIdentifier(table.name)}" (${columns});`);
  }
  const result = database.export();
  database.close();
  return Buffer.from(result);
}

export async function createZip(project: GeneratedProject, sqliteBundle: Buffer) {
  const archive = new JSZip();
  project.files.forEach(file => archive.file(file.path, file.content));
  archive.file("data/app.sqlite", sqliteBundle);
  archive.file(".appbuilder/manifest.json", JSON.stringify({ name: project.name, summary: project.summary, routes: project.routes, schema: project.schema, components: project.components }, null, 2));
  return Buffer.from(await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }));
}

export async function executeAppGeneration(input: { userId: number; prompt: string; model?: SelectableModel; appId?: string; onEvent?: (event: GenerationEvent) => void }) {
  const appId = input.appId || nanoid(18);
  const onEvent = input.onEvent || (() => undefined);
  const model = input.model && selectableModels.includes(input.model) ? input.model : "gpt-5-mini";
  const startingName = titleFromPrompt(input.prompt);
  const startedAt = Date.now();
  let existingApp: Awaited<ReturnType<typeof getGeneratedAppForUser>> | undefined;
  let versionNumber = 1;
  try {
    const reservation = await reserveTenantGeneration(input.userId);
    if (!reservation.allowed) throw new Error(`Tenant generation quota reached for ${reservation.usage.periodKey}`);
    existingApp = input.appId ? await getGeneratedAppForUser(input.appId, input.userId) : undefined;
    if (input.appId && !existingApp) throw new Error("Application not found");
    if (existingApp) {
      const versions = await listGeneratedAppVersions(appId);
      versionNumber = Math.max(0, ...versions.map(version => version.versionNumber)) + 1;
      await updateGeneratedApp(appId, input.userId, { status: "generating", prompt: input.prompt, model, error: "" });
    } else {
      await createGeneratedApp({ id: appId, userId: input.userId, name: startingName, prompt: input.prompt, model });
    }
    onEvent({ type: "status", message: "Interpreting the application brief", appId });
    const generated = await generateProject(input.prompt, model, token => onEvent({ type: "token", text: token, appId }));
    const project = { ...generated.project, files: normalizeGeneratedFiles(generated.project.files) };
    onEvent({ type: "status", message: "Writing application files", appId });
    project.files.forEach(file => onEvent({ type: "file", path: file.path, language: file.language, content: file.content, appId }));

    onEvent({ type: "status", message: "Packaging isolated SQLite state and export archive", appId });
    const sqliteBundle = await createIsolatedSqliteBundle(project);
    const zipBundle = await createZip(project, sqliteBundle);
    const root = `generated-apps/${input.userId}/${appId}/versions/v${versionNumber}`;
    const manifest = JSON.stringify({ appId, generatedAt: new Date().toISOString(), ...project }, null, 2);
    const [manifestStorage, sqliteStorage, zipStorage] = await Promise.all([
      storagePut(`${root}/source-manifest.json`, manifest, "application/json"),
      storagePut(`${root}/app.sqlite`, sqliteBundle, "application/vnd.sqlite3"),
      storagePut(`${root}/${safeName(project.name)}.zip`, zipBundle, "application/zip"),
    ]);
    await Promise.all([
      createGeneratedAppArtifact({ id: nanoid(18), appId, kind: "source_manifest", storageKey: manifestStorage.key, storageUrl: manifestStorage.url, filename: "source-manifest.json", contentType: "application/json", byteSize: Buffer.byteLength(manifest) }),
      createGeneratedAppArtifact({ id: nanoid(18), appId, kind: "sqlite_database", storageKey: sqliteStorage.key, storageUrl: sqliteStorage.url, filename: "app.sqlite", contentType: "application/vnd.sqlite3", byteSize: sqliteBundle.byteLength }),
      createGeneratedAppArtifact({ id: nanoid(18), appId, kind: "zip_export", storageKey: zipStorage.key, storageUrl: zipStorage.url, filename: `${safeName(project.name)}.zip`, contentType: "application/zip", byteSize: zipBundle.byteLength }),
    ]);
    const versionFiles = project.files.map(file => ({ id: nanoid(18), path: file.path, language: file.language, content: file.content, byteSize: Buffer.byteLength(file.content) }));
    if (existingApp) await replaceGeneratedAppFiles(appId, versionFiles);
    else await Promise.all(versionFiles.map(file => createGeneratedAppFile({ ...file, appId })));
    await updateGeneratedApp(appId, input.userId, {
      name: project.name.slice(0, 160),
      status: "ready",
      summary: project.summary,
      schemaSummary: JSON.stringify(project.schema),
      routes: JSON.stringify(project.routes),
      componentTree: JSON.stringify(project.components),
      previewConfig: JSON.stringify({ title: project.name, description: project.summary, prompt: input.prompt }),
      sourceManifestKey: manifestStorage.key,
      sourceBundleKey: manifestStorage.key,
      sqliteArtifactKey: sqliteStorage.key,
      exportArtifactKey: zipStorage.key,
      latencyMs: Date.now() - startedAt,
      inputTokens: generated.usage?.prompt_tokens || 0,
      outputTokens: generated.usage?.completion_tokens || 0,
    });
    const artifactBytes = Buffer.byteLength(manifest) + sqliteBundle.byteLength + zipBundle.byteLength;
    await Promise.all([
      createGeneratedAppVersion({ id: nanoid(18), appId, versionNumber, label: existingApp ? `Revision ${versionNumber}` : "Initial assembly", sourceManifestKey: manifestStorage.key, sqliteArtifactKey: sqliteStorage.key, exportArtifactKey: zipStorage.key, schemaSummary: JSON.stringify(project.schema), routes: JSON.stringify(project.routes), componentTree: JSON.stringify(project.components), metadata: JSON.stringify({ name: project.name, summary: project.summary, prompt: input.prompt, model, previewConfig: { title: project.name, description: project.summary, prompt: input.prompt } }), fileSnapshot: JSON.stringify(project.files) }),
      recordTenantGenerationUsage({ userId: input.userId, inputTokens: generated.usage?.prompt_tokens || 0, outputTokens: generated.usage?.completion_tokens || 0, latencyMs: Date.now() - startedAt, artifactBytes }),
    ]);
    onEvent({ type: "artifact", kind: "zip_export", url: zipStorage.url, appId });
    onEvent({ type: "complete", appId });
    return await getGeneratedAppForUser(appId, input.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    await updateGeneratedApp(appId, input.userId, { status: existingApp ? "ready" : "failed", error: message, latencyMs: Date.now() - startedAt });
    onEvent({ type: "error", message, appId });
    throw error;
  }
}
