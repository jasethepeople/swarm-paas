import { trpc } from "@/lib/trpc";
import { ClipboardCheck, Copy, RadioTower, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const receiverExample = `const crypto = require("node:crypto");
const valid = crypto.createHmac("sha256", process.env.VELLUM_WEBHOOK_SECRET)
  .update(rawBody).digest("hex");
// compare valid with x-vellum-signature after the event prefix`;

function State({ ready, label }: { ready: boolean; label: string }) {
  return <div className="flex items-center justify-between rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><span className="text-slate-300">{label}</span><span className={ready ? "font-mono-ui text-emerald-200" : "font-mono-ui text-amber-100"}>{ready ? "ready" : "pending"}</span></div>;
}

export function OperationalReadinessPanel() {
  const webhooks = trpc.webhooks.context.useQuery();
  const billing = trpc.billing.overview.useQuery();
  const copyReceiverGuide = async () => {
    await navigator.clipboard?.writeText(receiverExample);
    toast.success("Webhook receiver verification example copied");
  };

  return <div className="mt-4 grid gap-4 xl:grid-cols-2">
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-fuchsia-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-fuchsia-100/70">12 / RECEIVER READINESS</p><h2 className="mt-1 text-base font-semibold text-white">Verify before production</h2></div></div><button onClick={copyReceiverGuide} className="liquid-hover rounded-xl border border-white/12 bg-white/[.045] p-2 text-slate-200" title="Copy verification example"><Copy className="h-3.5 w-3.5" /></button></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">Your receiver should preserve the raw JSON body, calculate HMAC-SHA256 with the copied endpoint secret, and compare it against the signature header before handling an event.</p>
      <pre className="mt-3 max-h-28 overflow-auto rounded-xl border border-white/10 bg-slate-950/30 p-3 font-mono-ui text-[9px] leading-4 text-cyan-50">{receiverExample}</pre>
      <div className="mt-4 border-t border-white/10 pt-3"><p className="font-mono-ui text-[9px] tracking-[.16em] text-slate-500">RECENT DELIVERY INSPECTOR</p>{webhooks.data?.deliveries.length ? webhooks.data.deliveries.slice(0, 3).map(delivery => <div key={delivery.id} className="mt-2 flex items-center justify-between rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><span className="font-mono-ui text-slate-300">{delivery.eventType}</span><span className={delivery.status === "delivered" ? "text-emerald-200" : delivery.status === "failed" ? "text-rose-100" : "text-amber-100"}>{delivery.status} · {delivery.attempts}x{delivery.responseStatus ? ` · HTTP ${delivery.responseStatus}` : ""}</span></div>) : <p className="mt-2 text-[10px] text-slate-500">Add a public HTTPS endpoint and use test delivery to inspect a signed result here.</p>}</div>
    </section>
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-emerald-100/70">13 / STRIPE READINESS</p><h2 className="mt-1 text-base font-semibold text-white">Activation checklist</h2></div></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">This workspace exposes configuration state only. No purchase is created until a recurring Price ID is supplied and you choose to start Checkout.</p>
      <div className="mt-4 space-y-2"><State ready={Boolean(billing.data?.activation.secretKeyConfigured)} label="Stripe server credentials" /><State ready={Boolean(billing.data?.activation.webhookSecretConfigured)} label="Stripe webhook verification" /><State ready={Boolean(billing.data?.activation.recurringPriceConfigured)} label="Recurring workspace price" /><State ready={Boolean(billing.data?.activation.customerLinked)} label="Workspace customer link" /></div>
      <div className="mt-4 rounded-xl border border-emerald-100/12 bg-emerald-100/[.045] p-3 text-[10px] leading-4 text-emerald-50"><ClipboardCheck className="mb-1 h-3.5 w-3.5" />When you are ready, create a recurring Stripe Price and provide its `price_…` ID. The existing Checkout action will then become available to workspace managers.</div>
    </section>
  </div>;
}
