import type { Express } from "express";
import { createHash } from "node:crypto";
import { getActiveAppShareLink, getGeneratedAppById, getGeneratedAppVersion, listGeneratedAppFiles } from "./db";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

export function registerSharePreviewRoutes(app: Express) {
  app.get("/share/:token", async (req, res) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9_-]{20,160}$/.test(token)) return res.status(404).send("Preview unavailable");
    const link = await getActiveAppShareLink(createHash("sha256").update(token).digest("hex"));
    if (!link) return res.status(404).send("This preview link is unavailable, expired, or revoked.");
    const appRecord = await getGeneratedAppById(link.appId);
    if (!appRecord || appRecord.status !== "ready") return res.status(404).send("Preview unavailable");
    if (!link.versionId) return res.status(404).send("This preview link is not bound to an immutable application version.");
    const version = await getGeneratedAppVersion(appRecord.id, link.versionId);
    if (!version) return res.status(404).send("The shared application version is unavailable.");
    const metadata = parseJson<{ name?: string; summary?: string; prompt?: string }>(version?.metadata, {});
    const routes = parseJson<Array<{ path: string; purpose: string }>>(version?.routes || appRecord.routes, []);
    const schema = parseJson<Array<{ name: string; fields: Array<{ name: string; type: string }> }>>(version?.schemaSummary || appRecord.schemaSummary, []);
    const files = parseJson<Array<{ path: string; language: string; content: string }>>(version.fileSnapshot, []);
    const title = metadata.name || appRecord.name;
    const summary = metadata.summary || appRecord.summary || "Read-only generated application preview.";
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Shared Preview</title><style>body{margin:0;background:#080d18;color:#edf4ff;font-family:ui-sans-serif,system-ui;padding:clamp(24px,6vw,88px)}main{max-width:980px;margin:auto}.tag{color:#74e9ff;letter-spacing:.18em;font-size:11px}.card{margin-top:24px;padding:28px;border:1px solid #29405f;background:#0f1830;border-radius:18px}h1{font-size:clamp(32px,6vw,68px);margin:10px 0}p{color:#bdd0e9;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}code{display:block;white-space:pre-wrap;overflow:auto;background:#060b16;border:1px solid #213654;padding:14px;border-radius:10px;color:#bdeeff}small{color:#7891b2}</style></head><body><main><div class="tag">READ-ONLY SHARED PREVIEW</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p><div class="card"><div class="grid"><section><h2>Routes</h2>${routes.map(route => `<p><strong>${escapeHtml(route.path)}</strong><br><small>${escapeHtml(route.purpose)}</small></p>`).join("") || "<p>None defined.</p>"}</section><section><h2>Schema</h2>${schema.map(table => `<p><strong>${escapeHtml(table.name)}</strong><br><small>${table.fields.map(field => `${escapeHtml(field.name)} · ${escapeHtml(field.type)}`).join(" · ")}</small></p>`).join("") || "<p>None defined.</p>"}</section></div></div><div class="card"><h2>Source map</h2>${files.slice(0, 10).map(file => `<p><strong>${escapeHtml(file.path)}</strong> <small>${escapeHtml(file.language)}</small></p>`).join("")}</div><p><small>This is a non-executable, read-only application manifest preview. Link access expires automatically.</small></p></main></body></html>`);
  });
}
