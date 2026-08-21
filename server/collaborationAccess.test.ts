import { describe, expect, it } from "vitest";
import { summarizeCollaboratorAccess } from "../client/src/lib/collaborationAccess";

describe("collaborator access review", () => {
  it("derives viewer, editor, and manager counts without including the app owner", () => {
    expect(summarizeCollaboratorAccess([{ access: "viewer" }, { access: "editor" }, { access: "editor" }, { access: "manager" }])).toEqual({ viewer: 1, editor: 2, manager: 1 });
    expect(summarizeCollaboratorAccess([])).toEqual({ viewer: 0, editor: 0, manager: 0 });
  });
});
