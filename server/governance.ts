export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export function canManageOrganization(role: OrganizationRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canModifyMember(actorRole: OrganizationRole | null | undefined, targetUserId: number, ownerUserId: number) {
  return canManageOrganization(actorRole) && targetUserId !== ownerUserId;
}

export function invitationMatchesUser(invitationEmail: string, userEmail: string | null | undefined) {
  return Boolean(userEmail && invitationEmail.trim().toLowerCase() === userEmail.trim().toLowerCase());
}
