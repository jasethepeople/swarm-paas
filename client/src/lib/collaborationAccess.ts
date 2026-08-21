export type CollaboratorAccess = "viewer" | "editor" | "manager";

export function summarizeCollaboratorAccess(collaborators: Array<{ access: CollaboratorAccess }>) {
  return collaborators.reduce((counts, collaborator) => ({ ...counts, [collaborator.access]: counts[collaborator.access] + 1 }), { viewer: 0, editor: 0, manager: 0 });
}
