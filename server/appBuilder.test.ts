import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createIsolatedSqliteBundle, createZip, fallbackProject, normalizeGeneratedFiles } from "./appBuilder";
import { consumeRateLimit } from "./rateLimit";

describe("app builder project safety", () => {
  it("creates a container-ready fallback project with an isolated data bundle definition", () => {
    const project = fallbackProject("Build a lightweight planning board for a small product team");
    expect(project.files.some(file => file.path === "Dockerfile")).toBe(true);
    expect(project.files.some(file => file.path.startsWith("client/"))).toBe(true);
    expect(project.schema[0]?.name).toBe("items");
  });

  it("rejects traversal paths in model-authored source files", () => {
    expect(() => normalizeGeneratedFiles([{ path: "../secrets.txt", language: "text", content: "unsafe" }])).toThrow("unsafe path");
  });

  it("rejects duplicate generated source paths before persistence", () => {
    expect(() => normalizeGeneratedFiles([{ path: "client/App.tsx", language: "tsx", content: "one" }, { path: "client/App.tsx", language: "tsx", content: "two" }])).toThrow("duplicate file path");
  });

  it("creates a separate SQLite database and portable ZIP export for each project", async () => {
    const project = fallbackProject("Build a simple launch planning tool");
    const sqlite = await createIsolatedSqliteBundle(project);
    expect(sqlite.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\u0000");
    const archive = await JSZip.loadAsync(await createZip(project, sqlite));
    expect(Object.keys(archive.files)).toContain("Dockerfile");
    expect(Object.keys(archive.files)).toContain("data/app.sqlite");
    expect(Object.keys(archive.files)).toContain(".appbuilder/manifest.json");
  });
});

describe("generation rate limiter", () => {
  it("blocks requests after the configured window limit", () => {
    const key = `test-${Date.now()}`;
    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(false);
  });
});
