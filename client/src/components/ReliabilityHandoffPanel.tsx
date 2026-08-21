import { trpc } from "@/lib/trpc";
import { getCollaborationInvitationStatus } from "@/lib/collaborationStatus";
import { Copy, HeartPulse, MailCheck, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const stripeHandoff = `Vellum billing activation checklist
1. Claim or open your Stripe workspace.
2. Create a recurring Product and Price.
3. Copy the Price ID (price_…).
4. Add it as VELLUM_STRIPE_PRICE_ID.
5. Return to Vellum and start Checkout as a workspace manager.`;

function InvitationState({ invitation }: { invitation: { acceptedAt: Date | null; expiresAt: Date; email: string; access: string } }) {
  const state = getCollaborationInvitationStatus(invitation);
  const className = state === "accepted" ? "text-emerald-200" : state === "expired" ? "text-rose-100" : "text-amber-100";
  return <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><span className="min-w-0 truncate text-slate-300">{invitation.email} · {invitation.access}</span><span className={`shrink-0 font-mono-ui ${className}`}>{state}</span></div>;
}

export function ReliabilityHandoffPanel({ appId }: { appId: string | null }) {
  const webhooks = trpc.webhooks.context.useQuery();
  const collaboration = trpc.apps.collaboration.useQuery({ appId: appId || "unselected" }, { enabled: Boolean(appId) });
  const copyHandoff = async () => { await navigator.clipboard?.writeText(stripeHandoff); toast.success("Stripe activation handoff copied"); };
  return <div className="mt-4 grid gap-4 xl:grid-cols-3">
    <section className="glass-panel rounded-[2rem] p-5"><div className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-fuchsia-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-fuchsia-100/70">14 / ENDPOINT HEALTH</p><h2 className="mt-1 text-base font-semibold text-white">Webhook health</h2></div></div><p className="mt-3 text-[10px] leading-4 text-slate-400">Health reflects the most recent recorded delivery for each endpoint.</p><div className="mt-4">{webhooks.data?.endpoints.length ? webhooks.data.endpoints.slice(0, 3).map(endpoint => <div key={endpoint.id} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><span className="truncate text-slate-300">{endpoint.url}</span><span className={endpoint.health === "healthy" ? "font-mono-ui text-emerald-200" : endpoint.health === "degraded" ? "font-mono-ui text-rose-100" : "font-mono-ui text-amber-100"}>{endpoint.health}</span></div>) : <p className="text-[10px] text-slate-500">No endpoints to assess yet.</p>}</div></section>
    <section className="glass-panel rounded-[2rem] p-5"><div className="flex items-center gap-2"><MailCheck className="h-4 w-4 text-cyan-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-cyan-100/70">15 / INVITATION LEDGER</p><h2 className="mt-1 text-base font-semibold text-white">Collaboration status</h2></div></div>{!appId ? <p className="mt-4 text-[10px] leading-4 text-slate-500">Select an app to inspect its email-bound collaboration invitations.</p> : <><p className="mt-3 text-[10px] leading-4 text-slate-400">Pending, accepted, and expired invitation states are calculated from durable invitation records.</p><div className="mt-4">{collaboration.data?.invitations.length ? collaboration.data.invitations.slice(0, 3).map(invitation => <InvitationState key={invitation.id} invitation={invitation} />) : <p className="text-[10px] text-slate-500">No collaboration invitations have been issued.</p>}</div></>}</section>
    <section className="glass-panel rounded-[2rem] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-emerald-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-emerald-100/70">16 / BILLING HANDOFF</p><h2 className="mt-1 text-base font-semibold text-white">Activate when ready</h2></div></div><button onClick={copyHandoff} className="liquid-hover rounded-xl border border-white/12 bg-white/[.045] p-2 text-slate-200" title="Copy activation handoff"><Copy className="h-3.5 w-3.5" /></button></div><p className="mt-3 text-[10px] leading-4 text-slate-400">The handoff explains the exact non-transactional configuration steps. No charge or checkout is opened by copying it.</p><ol className="mt-4 list-inside list-decimal space-y-1 text-[10px] leading-4 text-slate-300"><li>Create a recurring Stripe Price.</li><li>Provide its `price_…` identifier.</li><li>Review readiness, then open Checkout.</li></ol></section>
  </div>;
}
