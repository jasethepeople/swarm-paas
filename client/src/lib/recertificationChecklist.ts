export type RecertificationChecklist = { managersReviewed: boolean; editorsReviewed: boolean; viewersReviewed: boolean; pendingInvitationsReviewed: boolean };

export const emptyRecertificationChecklist: RecertificationChecklist = { managersReviewed: false, editorsReviewed: false, viewersReviewed: false, pendingInvitationsReviewed: false };

export function isRecertificationComplete(checklist: RecertificationChecklist) {
  return Object.values(checklist).every(Boolean);
}
