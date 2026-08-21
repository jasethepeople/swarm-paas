import { trpc } from "@/lib/trpc";
import { emptyRecertificationChecklist, isRecertificationComplete } from "@/lib/recertificationChecklist";
import { summarizeWebhookDeliveryTrend } from "@/lib/webhookTrend";
import { BadgeCheck, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function ReadyStep({ ready, label }: { ready: boolean; label: string }) {
  return <div className="flex items-center justify-between rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><span className="text-slate-300">{label}</span><span className={ready ? "font-mono-ui text-emerald-200" : "font-mono-ui text-amber-100"}>{ready ? "ready" : "pending"}</span></div>;
}

export function OperationalMaturityPanel({ appId, canManageApp }: { appId: string | null; canManageApp: boolean }) {
  const utils = trpc.useUtils();
  const webhooks = trpc.webhooks.context.useQuery();
  const billing = trpc.billing.overview.useQuery();
  const [checklist, setChecklist] = useState(emptyRecertificationChecklist);
  const checklistComplete = isRecertificationComplete(checklist);
  const recertify = trpc.apps.recertifyCollaborators.useMutation({
    onSuccess: result => {
      utils.apps.collaboration.invalidate();
      setChecklist(emptyRecertificationChecklist);
      toast.success(`Permissions recertified for ${result.collaboratorCount} collaborator${result.collaboratorCount === 1 ? "" : "s"}`);
    },
    onError: error => toast.error(error.message),
  });
  const activation = billing.data?.activation;
  const reviewItems = [
    ["managersReviewed", "Review manager-level access"] as const,
    ["editorsReviewed", "Review editor-level access"] as const,
    ["viewersReviewed", "Review viewer-level access"] as const,
    ["pendingInvitationsReviewed", "Review pending invitations"] as const,
  ];

  return <div className="mt-4 grid gap-4 xl:grid-cols-3">
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><ChartNoAxesCombined className="h-4 w-4 text-fuchsia-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-fuchsia-100/70">20 / DELIVERY TREND</p><h2 className="mt-1 text-base font-semibold text-white">Endpoint history</h2></div></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">A compact success trend over the most recent eight persisted deliveries per endpoint.</p>
      <div className="mt-4 space-y-2">{webhooks.data?.endpoints.length ? webhooks.data.endpoints.slice(0, 3).map(endpoint => { const trend = summarizeWebhookDeliveryTrend(webhooks.data?.deliveries || [], endpoint.id); return <div key={endpoint.id} className="rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><div className="flex justify-between gap-2"><span className="truncate text-slate-300">{endpoint.url}</span><span className={trend.successRate === null ? "text-amber-100" : trend.successRate === 100 ? "text-emerald-200" : "text-rose-100"}>{trend.successRate === null ? "no samples" : `${trend.successRate}% success`}</span></div><p className="mt-1 font-mono-ui text-[9px] text-slate-500">{trend.total} samples · {trend.delivered} delivered · {trend.failed} failed</p></div>; }) : <p className="text-[10px] text-slate-500">Add a public endpoint to establish a delivery trend.</p>}</div>
    </section>
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-cyan-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-cyan-100/70">21 / PERMISSION RECERTIFICATION</p><h2 className="mt-1 text-base font-semibold text-white">Review & acknowledge</h2></div></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">Managers must complete every review step before a durable acknowledgment is added to the organization audit trail.</p>
      {!appId ? <p className="mt-4 text-[10px] text-slate-500">Select an app to review and acknowledge its collaborator permissions.</p> : canManageApp ? <><div className="mt-4 space-y-2">{reviewItems.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px] text-slate-300"><input type="checkbox" checked={checklist[key]} onChange={event => setChecklist(current => ({ ...current, [key]: event.target.checked }))} className="accent-cyan-200" />{label}</label>)}</div><button onClick={() => appId && recertify.mutate({ appId, checklist: { managersReviewed: true, editorsReviewed: true, viewersReviewed: true, pendingInvitationsReviewed: true } })} disabled={recertify.isPending || !checklistComplete} className="liquid-hover mt-3 rounded-xl border border-cyan-100/20 bg-cyan-100/10 px-3 py-2 text-xs text-cyan-50 disabled:opacity-40">{recertify.isPending ? "Recording…" : "Acknowledge completed review"}</button></> : <p className="mt-4 text-[10px] text-amber-100/75">View-only collaborators cannot acknowledge permissions.</p>}
    </section>
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-emerald-100/70">22 / GO-LIVE SEQUENCE</p><h2 className="mt-1 text-base font-semibold text-white">Billing readiness</h2></div></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">Complete these non-transactional checks before a manager chooses to start Checkout.</p>
      <div className="mt-4 space-y-2"><ReadyStep ready={Boolean(activation?.secretKeyConfigured)} label="Server credentials" /><ReadyStep ready={Boolean(activation?.webhookSecretConfigured)} label="Webhook signing" /><ReadyStep ready={Boolean(activation?.recurringPriceConfigured)} label="Recurring Price ID" /></div>
      <p className={activation?.canInitiateCheckout ? "mt-3 text-[10px] text-emerald-200" : "mt-3 text-[10px] text-amber-100"}>{activation?.canInitiateCheckout ? "The checkout gate is ready for manager review." : "Checkout remains disabled until every required step is ready."}</p>
    </section>
  </div>;
}
