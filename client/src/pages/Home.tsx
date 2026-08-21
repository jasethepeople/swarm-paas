import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Highlight, themes } from "prism-react-renderer";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Box, Braces, Check, ChevronRight, CircleDot, Code2, Download, FileCode2, FolderTree, Github, KeyRound, Loader2, LockKeyhole, Orbit, Plus, Sparkles, Terminal, Trash2, WandSparkles } from "lucide-react";

type StreamFile = { path: string; language: string; content: string };
type StreamStatus = "idle" | "generating" | "ready" | "error";
type PersistedManifest = { name?: string; summary?: string; routes?: Array<{ path: string; purpose: string }>; schema?: Array<{ name: string; fields: Array<{ name: string; type: string; required: boolean }> }>; components?: string[] };

const ideas = ["A focused customer-feedback tracker for indie teams", "A shared reading list with lightweight tags", "A micro CRM for studio client notes"];

function readableTime(value: Date | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "now" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function decodeSse(buffer: string, onMessage: (event: string, payload: any) => void) {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() || "";
  frames.forEach(frame => {
    const event = frame.match(/^event:\s*(.+)$/m)?.[1] || "message";
    const data = frame.match(/^data:\s*(.+)$/m)?.[1];
    if (!data) return;
    try { onMessage(event, JSON.parse(data)); } catch { /* ignore malformed stream frames */ }
  });
  return remainder;
}

function parseManifest<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function safePreviewHtml(input: { title: string; description: string; routes: Array<{ path: string; purpose: string }>; schema: Array<{ name: string; fields: Array<{ name: string; type: string; required: boolean }> }>; components: string[] }) {
  const escape = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
  const routes = input.routes.slice(0, 4).map(route => `<span class="route"><b>${escape(route.path)}</b>${escape(route.purpose)}</span>`).join("") || "<span class=\"route\"><b>/</b>Primary workspace</span>";
  const components = input.components.slice(0, 5).map(component => `<span class="component">${escape(component)}</span>`).join("") || "<span class=\"component\">App</span>";
  const tables = input.schema.slice(0, 2).map(table => `<section class="table"><strong>${escape(table.name)}</strong><div>${table.fields.slice(0, 5).map(field => `<span>${escape(field.name)} <i>${escape(field.type)}</i></span>`).join("")}</div></section>`).join("") || "<section class=\"table\"><strong>Workspace state</strong><div><span>id <i>text</i></span><span>created_at <i>integer</i></span></div></section>";
  return `<!doctype html><html><head><style>body{margin:0;background:#0f172a;color:#f8fafc;font-family:ui-sans-serif,system-ui}.shell{min-height:100vh;padding:27px;background:radial-gradient(circle at 18% 8%,#38bdf833,transparent 190px),linear-gradient(145deg,#101a35,#182443)}.tag{font:10px ui-monospace;letter-spacing:.18em;color:#67e8f9}.card{margin-top:20px;border:1px solid #94a3b833;border-radius:20px;padding:22px;background:#ffffff0a}.top{display:flex;justify-content:space-between;gap:12px}.pill{display:inline-flex;gap:8px;align-items:center;border:1px solid #5eead455;border-radius:999px;padding:7px 10px;font-size:10px;color:#99f6e4}.dot{width:6px;height:6px;background:#5eead4;border-radius:50%}h1{font-size:27px;line-height:1.05;margin:14px 0 9px}p{color:#cbd5e1;line-height:1.5;font-size:13px;margin:0}.label{font:9px ui-monospace;letter-spacing:.16em;color:#7dd3fc;margin:21px 0 9px}.routes,.components{display:flex;gap:6px;flex-wrap:wrap}.route,.component{border:1px solid #94a3b82b;background:#ffffff08;border-radius:10px;padding:7px 8px;color:#cbd5e1;font-size:10px}.route b{display:block;color:#e0f2fe;margin-bottom:3px;font:10px ui-monospace}.component{color:#d8b4fe}.tables{display:grid;gap:7px}.table{border:1px solid #94a3b82b;border-radius:12px;padding:10px;background:#0f172a44}.table strong{font-size:11px;color:#f8fafc}.table div{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.table span{font:9px ui-monospace;color:#cbd5e1}.table i{color:#67e8f9;font-style:normal}</style></head><body><main class="shell"><div class="top"><span class="tag">MANIFEST-DRIVEN PREVIEW</span><span class="pill"><span class="dot"></span>SAFE MODE</span></div><div class="card"><h1>${escape(input.title)}</h1><p>${escape(input.description || "A generated application preview is ready.")}</p><div class="label">ROUTE SURFACE</div><div class="routes">${routes}</div><div class="label">COMPONENT GRAPH</div><div class="components">${components}</div><div class="label">ISOLATED DATA MODEL</div><div class="tables">${tables}</div></div></main></body></html>`;
}

function AuthPortal() {
  return <main className="min-h-screen orbital-grid grid place-items-center overflow-hidden p-5">
    <section className="glass-panel relative w-full max-w-md overflow-hidden rounded-[2.25rem] p-8 text-center sm:p-10">
      <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] border border-cyan-100/25 bg-cyan-100/10 shadow-[inset_0_1px_1px_rgba(255,255,255,.35)]"><Orbit className="h-9 w-9 text-cyan-100" /></div>
      <p className="relative mt-7 font-mono-ui text-[10px] tracking-[.32em] text-cyan-100/65">VELLUM / ACCESS PORTAL</p>
      <h1 className="relative mt-3 text-3xl font-semibold tracking-tight text-white">Your next software<br />takes shape here.</h1>
      <p className="relative mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-300">Describe an idea, inspect the generated system, and retain every source artifact in your private registry.</p>
      <button onClick={() => startLogin()} className="liquid-hover relative mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white/14 px-5 py-4 text-sm font-semibold text-white backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"><LockKeyhole className="h-4 w-4 text-cyan-100" /> Continue with secure identity <ArrowUpRight className="h-4 w-4" /></button>
      <p className="relative mt-5 text-[11px] text-slate-400">Biometric-style portal · encrypted session · tenant isolated</p>
    </section>
  </main>;
}

function CodePanel({ files, selected, onSelect }: { files: StreamFile[]; selected: string; onSelect: (path: string) => void }) {
  const current = files.find(file => file.path === selected) || files[0];
  return <section className="glass-panel-soft flex min-h-[360px] overflow-hidden rounded-3xl">
    <aside className="w-[40%] min-w-44 border-r border-white/10 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 text-[10px] font-semibold tracking-[.18em] text-slate-400"><FolderTree className="h-3.5 w-3.5" /> SOURCE MAP</div>
      <div className="space-y-1">{files.map(file => <button key={file.path} onClick={() => onSelect(file.path)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition-colors ${selected === file.path ? "bg-cyan-100/12 text-cyan-50" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}><FileCode2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.path}</span></button>)}</div>
    </aside>
    <div className="min-w-0 flex-1 overflow-auto">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="font-mono-ui text-[11px] text-slate-300">{current?.path || "waiting for source"}</span><span className="rounded-full bg-white/5 px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wider text-slate-500">{current?.language || "text"}</span></div>
      {current ? <Highlight theme={themes.nightOwl} code={current.content} language={(current.language === "jsx" ? "jsx" : current.language === "tsx" ? "tsx" : current.language === "dockerfile" ? "docker" : current.language) as any}>{({ style, tokens, getLineProps, getTokenProps }) => <pre style={{ ...style, background: "transparent", margin: 0, padding: "1rem", fontSize: "11px", lineHeight: 1.7, fontFamily: "DM Mono, monospace" }}>{tokens.map((line, index) => <div key={index} {...getLineProps({ line })}><span className="mr-4 inline-block w-5 select-none text-right text-slate-600">{index + 1}</span>{line.map((token, tokenIndex) => <span key={tokenIndex} {...getTokenProps({ token })} />)}</div>)}</pre>}</Highlight> : <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-500">Generated source will resolve here.</div>}
    </div>
  </section>;
}

function Studio() {
  const { user, logout } = useAuth();
  const [prompt, setPrompt] = useState(ideas[0]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [statusCopy, setStatusCopy] = useState("Awaiting an application brief");
  const [files, setFiles] = useState<StreamFile[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [preview, setPreview] = useState({ title: "Untitled workspace", description: "Submit a concise application brief to activate a safe interactive preview." });
  const [creatingKey, setCreatingKey] = useState(false);
  const apps = trpc.apps.list.useQuery();
  const artifactQuery = trpc.apps.artifacts.useQuery({ appId: selectedAppId || "unselected" }, { enabled: Boolean(selectedAppId) });
  const manifestQuery = trpc.apps.manifest.useQuery({ appId: selectedAppId || "unselected" }, { enabled: Boolean(selectedAppId) });
  const utils = trpc.useUtils();
  const deleteApp = trpc.apps.delete.useMutation({ onSuccess: () => { utils.apps.list.invalidate(); setSelectedAppId(null); setFiles([]); toast.success("Application removed from the registry"); } });
  const makeKey = trpc.developer.createApiKey.useMutation({ onSuccess: result => { setCreatingKey(false); navigator.clipboard?.writeText(result.apiKey); toast.success("Builder API key copied once to clipboard"); }, onError: () => { setCreatingKey(false); toast.error("Could not create a Builder API key"); } });

  const activeApp = useMemo(() => apps.data?.find(app => app.id === selectedAppId), [apps.data, selectedAppId]);
  const zipArtifact = artifactQuery.data?.find(artifact => artifact.kind === "zip_export");
  const schemaTables = useMemo(() => parseManifest<Array<{ name: string; fields: Array<{ name: string; type: string; required: boolean }> }>>(activeApp?.schemaSummary, []), [activeApp?.schemaSummary]);
  const routeManifest = useMemo(() => parseManifest<Array<{ path: string; purpose: string }>>(activeApp?.routes, []), [activeApp?.routes]);
  const componentManifest = useMemo(() => parseManifest<string[]>(activeApp?.componentTree, []), [activeApp?.componentTree]);
  const persistedManifest = manifestQuery.data as PersistedManifest | undefined;
  const previewSchema = persistedManifest?.schema?.length ? persistedManifest.schema : schemaTables;
  const previewRoutes = persistedManifest?.routes?.length ? persistedManifest.routes : routeManifest;
  const previewComponents = persistedManifest?.components?.length ? persistedManifest.components : componentManifest;

  async function chooseApp(appId: string) {
    setSelectedAppId(appId);
    const record = apps.data?.find(app => app.id === appId);
    if (record) setPreview({ title: record.name, description: record.summary || record.prompt });
    try {
      const source = await utils.apps.files.fetch({ appId });
      const hydrated = source.map(file => ({ path: file.path, language: file.language, content: file.content }));
      setFiles(hydrated);
      setSelectedFile(hydrated[0]?.path || "");
      setStatus("ready");
      setStatusCopy("Registry artifact loaded");
    } catch { toast.error("Could not load source files"); }
  }

  async function generate() {
    if (prompt.trim().length < 10) return toast.error("Describe the app in at least 10 characters");
    setStatus("generating"); setStatusCopy("Opening generation stream"); setFiles([]); setSelectedFile(""); setSelectedAppId(null);
    try {
      const response = await fetch("/api/builder/generate", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({ error: "Generation unavailable" }))).error);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let remainder = ""; let streamFailed = false;
      while (true) {
        const next = await reader.read(); if (next.done) break;
        remainder = decodeSse(remainder + decoder.decode(next.value, { stream: true }), (_event, payload) => {
          if (payload.appId) setSelectedAppId(payload.appId);
          if (payload.type === "status") setStatusCopy(payload.message);
          if (payload.type === "file") { setFiles(previous => [...previous, { path: payload.path, language: payload.language, content: payload.content }]); setSelectedFile(current => current || payload.path); }
          if (payload.type === "complete") { setStatus("ready"); setStatusCopy("Generation complete — artifacts have been sealed"); setPreview({ title: payload.name || "Generated micro-app", description: prompt }); utils.apps.list.invalidate(); toast.success("Application and durable artifacts are ready"); }
          if (payload.type === "error") { streamFailed = true; setStatus("error"); setStatusCopy(payload.message); toast.error(payload.message); }
        });
      }
      if (!streamFailed) { setStatus("ready"); setStatusCopy("Generation complete — registry synchronizing"); await utils.apps.list.invalidate(); }
    } catch (error) { const message = error instanceof Error ? error.message : "Generation could not start"; setStatus("error"); setStatusCopy(message); toast.error(message); }
  }

  async function pushMockGithub() {
    if (!selectedAppId) return;
    const name = (activeApp?.name || "generated-app").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    try {
      const response = await fetch(`/api/mock-github/repos/${encodeURIComponent(user?.name?.toLowerCase().replace(/\s+/g, "-") || "workspace")}/${encodeURIComponent(name)}/push`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId: selectedAppId }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Mock GitHub push failed");
      toast.success(`Mock push accepted · ${result.commit}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Mock GitHub push failed"); }
  }

  const displayFiles = files;
  return <div className="min-h-screen orbital-grid p-3 sm:p-5"><div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1760px] gap-4">
    <aside className="glass-panel hidden w-64 shrink-0 flex-col rounded-[2rem] p-4 lg:flex">
      <div className="flex items-center gap-3 px-2 py-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-200/15 text-cyan-100"><Orbit className="h-5 w-5" /></div><div><p className="font-mono-ui text-[10px] tracking-[.23em] text-cyan-100/70">VELLUM</p><p className="text-xs text-slate-400">App Assembly</p></div></div>
      <button onClick={() => { setSelectedAppId(null); setFiles([]); setStatus("idle"); setStatusCopy("Awaiting an application brief"); }} className="liquid-hover mt-7 flex items-center gap-3 rounded-2xl border border-cyan-100/20 bg-cyan-100/10 px-3 py-3 text-sm font-medium text-cyan-50"><Plus className="h-4 w-4" /> New assembly</button>
      <div className="mt-8"><p className="px-2 font-mono-ui text-[10px] tracking-[.18em] text-slate-500">YOUR REGISTRY</p><div className="mt-3 space-y-2 overflow-y-auto">{apps.isLoading ? <div className="px-2 py-3 text-xs text-slate-500">Synchronizing registry…</div> : apps.data?.length ? apps.data.map(app => <div key={app.id} className={`group rounded-2xl px-3 py-3 transition-colors ${selectedAppId === app.id ? "bg-white/13 text-white" : "bg-white/[.025] text-slate-400 hover:bg-white/6 hover:text-slate-100"}`}><button onClick={() => chooseApp(app.id)} className="flex w-full items-center gap-3 text-left"><span className={`h-2 w-2 rounded-full ${app.status === "ready" ? "bg-emerald-300" : app.status === "failed" ? "bg-rose-300" : "bg-amber-200 animate-pulse"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{app.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">{readableTime(app.createdAt)} · {parseManifest<any[]>(app.schemaSummary, []).length || 0} tables</span></span><ChevronRight className="h-3.5 w-3.5" /></button><div className="mt-2 flex gap-1"><button onClick={() => chooseApp(app.id)} className="rounded-lg px-2 py-1 text-[9px] text-cyan-100 hover:bg-cyan-100/10">Preview</button>{app.exportArtifactKey ? <a href={`/manus-storage/${app.exportArtifactKey}`} className="rounded-lg px-2 py-1 text-[9px] text-slate-300 hover:bg-white/10">Export</a> : null}<button onClick={() => deleteApp.mutate({ appId: app.id })} className="rounded-lg px-2 py-1 text-[9px] text-rose-100 hover:bg-rose-200/10">Delete</button></div></div>) : <div className="px-2 py-4 text-xs leading-5 text-slate-500">Your generated applications will appear here.</div>}</div></div>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.045] p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-200"><CircleDot className="h-3.5 w-3.5 text-cyan-200" /> Stable workspace</div><p className="mt-1.5 text-[10px] leading-4 text-slate-500">Artifacts are retained separately from this interactive session.</p></div>
      <div className="mt-3 flex items-center justify-between px-2"><span className="max-w-32 truncate text-xs text-slate-300">{user?.name || "Member"}</span><button onClick={logout} className="text-xs text-slate-500 hover:text-white">Sign out</button></div>
    </aside>
    <main className="min-w-0 flex-1"><header className="glass-panel flex items-center justify-between rounded-[1.6rem] px-4 py-3 sm:px-5"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-200/15 text-cyan-100 lg:hidden"><Orbit className="h-4 w-4" /></div><div><p className="font-mono-ui text-[10px] tracking-[.22em] text-cyan-100/70">APP BUILDER / LAB</p><p className="text-xs text-slate-400">{statusCopy}</p></div></div><div className="flex items-center gap-2"><button onClick={() => { setCreatingKey(true); makeKey.mutate({ label: "Studio agent key" }); }} disabled={creatingKey} className="liquid-hover hidden items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-xs text-slate-200 sm:flex"><KeyRound className="h-3.5 w-3.5" /> {creatingKey ? "Creating…" : "Agent key"}</button><div className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-cyan-50">{user?.name?.slice(0, 1).toUpperCase() || "U"}</div></div></header>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(350px,.9fr)]"><section className="glass-panel rounded-[2rem] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-mono-ui text-[10px] tracking-[.22em] text-fuchsia-100/75">01 / INTENT</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Describe what should exist.</h1></div><WandSparkles className="h-5 w-5 shrink-0 text-cyan-100" /></div><textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="mt-5 min-h-36 w-full resize-none rounded-2xl border border-white/15 bg-slate-950/25 p-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-100/40 focus:ring-2 focus:ring-cyan-100/10" placeholder="Build an app that…" />
        <div className="mt-3 flex flex-wrap gap-2">{ideas.map(idea => <button key={idea} onClick={() => setPrompt(idea)} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-cyan-100/25 hover:text-cyan-50">{idea}</button>)}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-[11px] text-slate-400"><LockKeyhole className="h-3.5 w-3.5 text-cyan-100" /> Private generation · source retained</div><button onClick={generate} disabled={status === "generating"} className="liquid-hover flex items-center gap-2 rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-60">{status === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{status === "generating" ? "Assembling…" : "Generate app"}</button></div></section>
        <section className="glass-panel overflow-hidden rounded-[2rem]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="font-mono-ui text-[10px] tracking-[.22em] text-cyan-100/70">02 / SAFE PREVIEW</p><p className="mt-1 text-xs text-slate-400">{manifestQuery.isFetching ? "Loading persisted manifest" : "Persisted-manifest visual response"}</p></div><span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status === "ready" ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100" : status === "error" ? "border-rose-200/20 bg-rose-300/10 text-rose-100" : "border-amber-100/20 bg-amber-100/10 text-amber-50"}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "ready" ? "bg-emerald-300" : status === "error" ? "bg-rose-300" : "bg-amber-200"}`} />{status === "ready" ? "READY" : status === "error" ? "ATTENTION" : "STANDBY"}</span></div><div className="p-3"><iframe title="Generated app safe preview" sandbox="" srcDoc={safePreviewHtml({ title: persistedManifest?.name || activeApp?.name || preview.title, description: persistedManifest?.summary || activeApp?.summary || preview.description, routes: previewRoutes, schema: previewSchema, components: previewComponents })} className="h-[304px] w-full rounded-[1.35rem] border border-white/10 bg-slate-950" /></div></section></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(350px,.9fr)]"><div><div className="mb-2 flex items-center justify-between px-1"><div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-cyan-100" /><span className="font-mono-ui text-[10px] tracking-[.18em] text-slate-400">03 / GENERATED SOURCE</span></div><span className="text-[10px] text-slate-500">{displayFiles.length} files</span></div><CodePanel files={displayFiles} selected={selectedFile} onSelect={setSelectedFile} /></div>
        <section className="glass-panel rounded-[2rem] p-5"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] tracking-[.22em] text-fuchsia-100/70">04 / ARTIFACTS</p><h2 className="mt-1 text-lg font-semibold text-white">Portable by design</h2></div><Box className="h-5 w-5 text-fuchsia-100" /></div><div className="mt-5 space-y-2">{["source_manifest", "sqlite_database", "zip_export"].map(kind => { const artifact = artifactQuery.data?.find(item => item.kind === kind); const label = kind === "source_manifest" ? "Source manifest" : kind === "sqlite_database" ? "Isolated SQLite bundle" : "ZIP source export"; return <div key={kind} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.045] px-3 py-3"><div className="flex items-center gap-3"><div className={`grid h-8 w-8 place-items-center rounded-xl ${artifact ? "bg-cyan-100/12 text-cyan-100" : "bg-white/[.04] text-slate-500"}`}>{artifact ? <Check className="h-4 w-4" /> : <Braces className="h-4 w-4" />}</div><span className="text-xs text-slate-300">{label}</span></div>{artifact ? <a href={artifact.storageUrl} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title={`Download ${label}`}><Download className="h-3.5 w-3.5" /></a> : <span className="text-[10px] text-slate-600">waiting</span>}</div> })}</div>
          <div className="mt-5 grid grid-cols-2 gap-2"><button disabled={!zipArtifact} onClick={() => { if (zipArtifact) window.location.assign(zipArtifact.storageUrl); }} className="liquid-hover flex items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[.06] px-3 py-3 text-xs text-slate-200 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> ZIP</button><button disabled={!selectedAppId} onClick={pushMockGithub} className="liquid-hover flex items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[.06] px-3 py-3 text-xs text-slate-200 disabled:opacity-40"><Github className="h-3.5 w-3.5" /> Mock push</button></div>
          <div className="mt-3 flex gap-2"><button disabled={!selectedAppId || deleteApp.isPending} onClick={() => selectedAppId && deleteApp.mutate({ appId: selectedAppId })} className="liquid-hover flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-100/12 bg-rose-300/[.05] px-3 py-2.5 text-xs text-rose-100 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Remove registry entry</button></div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.045] p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[11px] font-semibold text-slate-100"><Braces className="h-3.5 w-3.5 text-cyan-100" /> Schema registry</div><span className="font-mono-ui text-[9px] text-slate-500">{previewSchema.length} TABLES</span></div><div className="mt-2 space-y-1">{previewSchema.length ? previewSchema.slice(0, 2).map(table => <div key={table.name} className="flex items-center justify-between text-[10px] text-slate-400"><span>{table.name}</span><span className="font-mono-ui text-cyan-100/70">{table.fields.length} fields</span></div>) : <p className="text-[10px] text-slate-500">Select a generated application to inspect its isolated model.</p>}</div></div>
          <div className="mt-3 rounded-2xl border border-cyan-100/12 bg-cyan-100/[.05] p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-50"><Terminal className="h-3.5 w-3.5" /> Programmatic access</div><p className="mt-1 text-[10px] leading-4 text-slate-400">Create a Builder API key to invoke generation, query registries, or retrieve artifacts from your external agent.</p></div></section></div>
    </main></div></div>;
}

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-100" /></div>;
  return user ? <Studio /> : <AuthPortal />;
}
