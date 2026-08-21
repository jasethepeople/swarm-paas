import { describe, expect, it } from "vitest";
import { getCollaborationInvitationStatus } from "../client/src/lib/collaborationStatus";

describe("collaboration invitation status", () => {
  const now = Date.UTC(2026, 7, 21, 15, 0, 0);

  it("surfaces durable pending, accepted, and expired invitation records correctly", () => {
    expect(getCollaborationInvitationStatus({ acceptedAt: null, expiresAt: new Date(now + 60_000) }, now)).toBe("pending");
    expect(getCollaborationInvitationStatus({ acceptedAt: new Date(now - 60_000), expiresAt: new Date(now - 1) }, now)).toBe("accepted");
    expect(getCollaborationInvitationStatus({ acceptedAt: null, expiresAt: new Date(now - 1) }, now)).toBe("expired");
  });
});
