import { describe, expect, it } from "vitest";
import { emptyRecertificationChecklist, isRecertificationComplete } from "../client/src/lib/recertificationChecklist";

describe("recertification checklist", () => {
  it("requires manager, editor, viewer, and pending-invitation review steps", () => {
    expect(isRecertificationComplete(emptyRecertificationChecklist)).toBe(false);
    expect(isRecertificationComplete({ managersReviewed: true, editorsReviewed: true, viewersReviewed: true, pendingInvitationsReviewed: true })).toBe(true);
  });
});
