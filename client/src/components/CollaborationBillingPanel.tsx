import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, CreditCard, Send, UsersRound, Webhook } from "lucide-react";

type Access = "viewer" | "editor" | "manager";

function OnboardingChecklist() {
  return <div className="mt-3 rounded-xl border border-white/10 bg-white/[.025] p-3 text-[10px] leading-4 text-slate-400">
    <p className="font-mono-ui text-[9px] tracking-[.14em] text-cyan-100/70">COLLABORATION CHECKLIST</p>
    <ol className="mt-2 list-inside list-decimal space-y-1">
      <li>Invite a teammate with the smallest practical access level.</li>
      <li>Have them accept from the email-bound link.</li>
      <li>Confirm viewer, editor, or manager capabilities on a real app.</li>
    </ol>
  </div>;
}

export function CollaborationBillingPanel({ appId, canManageApp }: { appId: string | null; canManageApp: boolean }) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<Access>("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const collaboration = trpc.apps.collaboration.useQuery({ appId: appId || "unselected" }, { enabled: Boolean(appId) });
  const webhooks = trpc.webhooks.context.useQuery();
  const billing = trpc.billing.overview.useQuery();
  const invite = trpc.apps.inviteCollaborator.useMutation({ onSuccess: result => { const url = `${window.location.origin}${result.path}`; setInviteUrl(url); navigator.clipboard?.writeText(url); setEmail(""); utils.apps.collaboration.invalidate(); toast.success("Expiring collaborator invitation copied"); }, onError: error => toast.error(error.message) });
  const updateCollaborator = trpc.apps.updateCollaborator.useMutation({ onSuccess: () => { utils.apps.collaboration.invalidate(); toast.success("Collaborator access updated"); }, onError: error => toast.error(error.message) });
  const removeCollaborator = trpc.apps.removeCollaborator.useMutation({ onSuccess: () => { utils.apps.collaboration.invalidate(); toast.success("Collaborator removed"); }, onError: error => toast.error(error.message) });
  const createWebhook = trpc.webhooks.create.useMutation({ onSuccess: result => { setWebhookSecret(result.secret); navigator.clipboard?.writeText(result.secret); setWebhookUrl(""); utils.webhooks.context.invalidate(); toast.success("Webhook secret copied once"); }, onError: error => toast.error(error.message) });
  const removeWebhook = trpc.webhooks.remove.useMutation({ onSuccess: () => { utils.webhooks.context.invalidate(); toast.success("Webhook endpoint removed"); }, onError: error => toast.error(error.message) });
  const testDelivery = trpc.webhooks.testDelivery.useMutation({ onSuccess: result => { utils.webhooks.context.invalidate(); toast[result.status === "delivered" ? "success" : "error"](`Webhook test ${result.status} after ${result.attempts} attempt${result.attempts === 1 ? "" : "s"}`); }, onError: error => toast.error(error.message) });
  const checkout = trpc.billing.checkout.useMutation({ onSuccess: result => { window.open(result.url, "_blank", "noopener,noreferrer"); toast.success("Opening secure checkout in a new tab"); }, onError: error => toast.error(error.message) });
  const portal = trpc.billing.portal.useMutation({ onSuccess: result => { window.open(result.url, "_blank", "noopener,noreferrer"); toast.success("Opening the billing portal in a new tab"); }, onError: error => toast.error(error.message) });

  return <div className="mt-4 grid gap-4 xl:grid-cols-3">
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-cyan-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-cyan-100/70">09 / COLLABORATION</p><h2 className="mt-1 text-base font-semibold text-white">Shared app access</h2></div></div>
      {!appId ? <p className="mt-4 text-xs leading-5 text-slate-500">Select an application to share a workspace-scoped invitation.</p> : <>
        <p className="mt-3 text-[10px] leading-4 text-slate-400">Viewer inspects. Editor revises. Manager shares, restores, and exports.</p>
        {canManageApp ? <div className="mt-3 flex gap-2"><input value={email} onChange={event => setEmail(event.target.value)} placeholder="collaborator@example.com" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/25 px-3 py-2 text-[11px] text-slate-100 outline-none" /><select value={access} onChange={event => setAccess(event.target.value as Access)} className="rounded-xl border border-white/10 bg-slate-950/25 px-2 text-[10px] text-cyan-50"><option value="viewer">viewer</option><option value="editor">editor</option><option value="manager">manager</option></select><button disabled={!email.includes("@")} onClick={() => appId && invite.mutate({ appId, email, access, expiresInHours: 168 })} className="liquid-hover rounded-xl border border-cyan-100/20 bg-cyan-100/10 px-3 text-xs text-cyan-50 disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button></div> : <p className="mt-3 text-[10px] text-amber-100/75">View-only collaborators cannot change access.</p>}
        {inviteUrl ? <p className="mt-2 break-all font-mono-ui text-[9px] text-cyan-50">{inviteUrl}</p> : null}
        <div className="mt-4 border-t border-white/10 pt-3"><p className="font-mono-ui text-[9px] tracking-[.16em] text-slate-500">CURRENT COLLABORATORS</p>{collaboration.data?.collaborators.length ? collaboration.data.collaborators.map(collaborator => <div key={collaborator.id} className="mt-2 flex items-center justify-between rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><span className="text-slate-300">User #{collaborator.userId}</span>{canManageApp ? <div className="flex items-center gap-2"><select value={collaborator.access} onChange={event => appId && updateCollaborator.mutate({ appId, userId: collaborator.userId, access: event.target.value as Access })} className="bg-transparent font-mono-ui text-[10px] text-cyan-100/75 outline-none"><option value="viewer">viewer</option><option value="editor">editor</option><option value="manager">manager</option></select><button onClick={() => appId && removeCollaborator.mutate({ appId, userId: collaborator.userId })} className="text-rose-100">remove</button></div> : <span className="font-mono-ui text-[9px] text-slate-500">{collaborator.access} · view only</span>}</div>) : <p className="mt-2 text-[10px] text-slate-500">No additional collaborators yet.</p>}</div>
        <OnboardingChecklist />
      </>}
    </section>
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><Webhook className="h-4 w-4 text-fuchsia-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-fuchsia-100/70">10 / WEBHOOKS</p><h2 className="mt-1 text-base font-semibold text-white">Signed operations</h2></div></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">Delivers generation completion and invitation events over HTTPS with HMAC-SHA256 signatures and up to three bounded attempts.</p>
      {webhooks.data?.canManage ? <div className="mt-3 flex gap-2"><input value={webhookUrl} onChange={event => setWebhookUrl(event.target.value)} placeholder="https://events.example.com/vellum" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/25 px-3 py-2 text-[11px] text-slate-100 outline-none" /><button disabled={!webhookUrl.startsWith("https://")} onClick={() => createWebhook.mutate({ url: webhookUrl, events: ["generation.completed", "organization.invitation.created", "collaboration.invitation.created"] })} className="liquid-hover rounded-xl border border-fuchsia-100/20 bg-fuchsia-100/10 px-3 text-xs text-fuchsia-50 disabled:opacity-40">Add</button></div> : <p className="mt-3 text-[10px] text-amber-100/75">Owner/admin access is required to manage delivery endpoints.</p>}
      {webhookSecret ? <p className="mt-2 break-all font-mono-ui text-[9px] text-cyan-50">Secret (copied once): {webhookSecret}</p> : null}
      <div className="mt-4 border-t border-white/10 pt-3"><p className="font-mono-ui text-[9px] tracking-[.16em] text-slate-500">ENDPOINTS</p>{webhooks.data?.endpoints.length ? webhooks.data.endpoints.slice(0, 2).map(endpoint => <div key={endpoint.id} className="mt-2 rounded-lg bg-white/[.035] px-2.5 py-2 text-[10px]"><div className="flex items-center justify-between gap-2"><span className="truncate text-slate-300">{endpoint.url}</span>{webhooks.data.canManage ? <div className="flex shrink-0 gap-2"><button onClick={() => testDelivery.mutate({ endpointId: endpoint.id })} className="text-cyan-100">test</button><button onClick={() => removeWebhook.mutate({ endpointId: endpoint.id })} className="text-rose-100">remove</button></div> : null}</div></div>) : <p className="mt-2 text-[10px] text-slate-500">No delivery endpoints configured.</p>}<p className="mt-3 text-[9px] text-slate-500">{webhooks.data?.deliveries[0] ? `Latest delivery: ${webhooks.data.deliveries[0].status}` : "Add a public HTTPS receiver, copy its one-time secret, then use test to validate the signed payload."}</p></div>
    </section>
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-100" /><div><p className="font-mono-ui text-[10px] tracking-[.18em] text-emerald-100/70">11 / METERED BILLING</p><h2 className="mt-1 text-base font-semibold text-white">Usage & billing</h2></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="font-mono-ui text-[9px] text-slate-500">THIS PERIOD</p><p className="mt-1 text-lg font-semibold text-cyan-50">{billing.data?.usage.usage.generations || 0}</p><p className="text-[9px] text-slate-500">generations</p></div><div className="rounded-xl border border-white/10 bg-white/[.035] p-3"><p className="font-mono-ui text-[9px] text-slate-500">EST. COST</p><p className="mt-1 text-lg font-semibold text-cyan-50">${((billing.data?.usage.usage.estimatedCostMicros || 0) / 1_000_000).toFixed(2)}</p><p className="text-[9px] text-slate-500">model spend</p></div></div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">{billing.data?.account?.stripeSubscriptionId ? "A Stripe subscription is linked to this workspace." : billing.data?.checkoutConfigured ? "A checkout plan is ready for this workspace." : "Checkout remains staged: create a recurring Stripe price and set VELLUM_STRIPE_PRICE_ID when you are ready."}</p>
      {billing.data?.canManage ? <div className="mt-3 flex gap-2"><button disabled={!billing.data.activation.canInitiateCheckout} onClick={() => checkout.mutate()} className="liquid-hover rounded-xl border border-emerald-100/20 bg-emerald-100/10 px-3 py-2 text-xs text-emerald-50 disabled:opacity-40">Start checkout</button><button disabled={!billing.data.account?.stripeCustomerId} onClick={() => portal.mutate()} className="liquid-hover rounded-xl border border-white/12 bg-white/[.05] px-3 py-2 text-xs text-slate-200 disabled:opacity-40">Billing portal</button></div> : <p className="mt-3 text-[10px] text-amber-100/75">Owner/admin access is required for billing actions.</p>}
    </section>
  </div>;
}

export function CollaborationInvitationAcceptance({ token }: { token: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<"ready" | "accepted" | "error">("ready");
  const accept = trpc.apps.acceptCollaborationInvitation.useMutation({ onSuccess: () => { setState("accepted"); window.history.replaceState({}, "", "/"); toast.success("Collaboration invitation accepted"); }, onError: error => { setState("error"); toast.error(error.message); } });
  if (!user) return <main className="min-h-screen orbital-grid grid place-items-center p-5"><section className="glass-panel max-w-md rounded-[2rem] p-8 text-center"><BellRing className="mx-auto h-7 w-7 text-cyan-100" /><h1 className="mt-4 text-xl font-semibold text-white">Sign in to join this app</h1><p className="mt-2 text-sm text-slate-400">Collaboration invitations are securely matched to the invited email address.</p><button onClick={() => startLogin()} className="liquid-hover mt-6 rounded-xl bg-cyan-100 px-4 py-2 text-sm font-semibold text-slate-950">Continue securely</button></section></main>;
  return <main className="min-h-screen orbital-grid grid place-items-center p-5"><section className="glass-panel max-w-md rounded-[2rem] p-8 text-center"><UsersRound className="mx-auto h-7 w-7 text-cyan-100" /><h1 className="mt-4 text-xl font-semibold text-white">Join shared application</h1><p className="mt-2 text-sm text-slate-400">Your assigned viewer, editor, or manager access is applied after secure email verification.</p><button disabled={accept.isPending || state === "error"} onClick={() => accept.mutate({ token })} className="liquid-hover mt-6 rounded-xl bg-cyan-100 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{accept.isPending ? "Verifying…" : state === "accepted" ? "Opening workspace…" : state === "error" ? "Invitation unavailable" : "Accept invitation"}</button></section></main>;
}
