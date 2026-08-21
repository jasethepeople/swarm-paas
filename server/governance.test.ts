import { describe, expect, it } from "vitest";
import { canManageOrganization, canModifyMember, invitationMatchesUser } from "./governance";

describe("organization governance rules", () => {
  it("limits manager privileges to owners and admins", () => {
    expect(canManageOrganization("owner")).toBe(true);
    expect(canManageOrganization("admin")).toBe(true);
    expect(canManageOrganization("member")).toBe(false);
    expect(canManageOrganization("viewer")).toBe(false);
  });

  it("prevents managers from modifying the organization owner", () => {
    expect(canModifyMember("admin", 2, 1)).toBe(true);
    expect(canModifyMember("admin", 1, 1)).toBe(false);
  });

  it("accepts invitations only for an exact normalized email", () => {
    expect(invitationMatchesUser("Member@Example.com", "member@example.com")).toBe(true);
    expect(invitationMatchesUser("member@example.com", "other@example.com")).toBe(false);
  });
});
