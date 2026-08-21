import { describe, expect, it } from "vitest";
import { getCollaborationInvitationStatus } from "./collaborationStatus";

describe("collaboration invitation status", () => {
  const now = Date.UTC(2026, 7, 21, 15, 0, 0);

  it("surfaces pending records that remain within their acceptance window", () => {
    expect(getCollaborationInvitationStatus({ acceptedAt: null, expiresAt: new Date(now + 60_000) }, now)).toBe("pending");
  });

  it("surfaces accepted records regardless of their expiry timestamp", () => {
    expect(getCollaborationInvitationStatus({ acceptedAt: new Date(now - 60_000), expiresAt: new Date(now - 1) }, now)).toBe("accepted");
  });

  it("surfaces unaccepted records that have passed their expiry window", () => {
    expect(getCollaborationInvitationStatus({ acceptedAt: null, expiresAt: new Date(now - 1) }, now)).toBe("expired");
  });
});
