export type CollaborationInvitationStatus = "pending" | "accepted" | "expired";

export function getCollaborationInvitationStatus(invitation: { acceptedAt: Date | null; expiresAt: Date }, now = Date.now()): CollaborationInvitationStatus {
  if (invitation.acceptedAt) return "accepted";
  return invitation.expiresAt.getTime() <= now ? "expired" : "pending";
}
