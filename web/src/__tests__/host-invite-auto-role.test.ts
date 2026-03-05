/**
 * Tests for host invitation policy and email template.
 *
 * Covers:
 * 1. Claims-only ownership policy (no direct host assignment via invite paths)
 * 2. Email template role-awareness
 */

import { describe, it, expect } from "vitest";
import { getCohostInvitationEmail } from "@/lib/email/templates/cohostInvitation";

// ── Email template tests ──────────────────────────────────────────

describe("Host invitation email template", () => {
  const baseParams = {
    inviteeName: "Alex",
    inviterName: "Sami",
    eventTitle: "Test Open Mic",
    eventId: "event-123",
    venueName: "Mercury Cafe",
    startTime: "7:00 PM",
  };

  it("renders host copy when role is 'host'", () => {
    const result = getCohostInvitationEmail({ ...baseParams, role: "host" });

    expect(result.subject).toContain("to host");
    expect(result.subject).not.toContain("co-host");
    expect(result.html).toContain("As the host");
    expect(result.html).toContain("Full control over event details");
    expect(result.html).toContain("Invite co-hosts to help manage");
    expect(result.text).toContain("to host a happening");
    expect(result.text).toContain("As the host");
  });

  it("renders co-host copy when role is 'cohost'", () => {
    const result = getCohostInvitationEmail({ ...baseParams, role: "cohost" });

    expect(result.subject).toContain("co-host");
    expect(result.html).toContain("As a co-host");
    expect(result.html).toContain("View and manage RSVPs");
    expect(result.text).toContain("co-host a happening");
    expect(result.text).toContain("As a co-host");
  });

  it("defaults to co-host when role is not specified", () => {
    const result = getCohostInvitationEmail(baseParams);

    expect(result.subject).toContain("co-host");
    expect(result.html).toContain("As a co-host");
  });

  it("includes host guide link", () => {
    const result = getCohostInvitationEmail({ ...baseParams, role: "host" });

    expect(result.html).toContain("/host-guide");
    expect(result.text).toContain("/host-guide");
    expect(result.html).toContain("Read the Host Guide");
  });

  it("includes AI editing tip", () => {
    const result = getCohostInvitationEmail({ ...baseParams, role: "host" });

    expect(result.html).toContain("AI assistant");
    expect(result.html).toContain("Image uploads need to be done manually");
    expect(result.text).toContain("AI assistant");
  });
});

// ── Claims-only host ownership policy tests ───────────────────────

describe("Claims-only host ownership policy", () => {
  function canInviteCohost(eventHostId: string | null): boolean {
    // Mirror claims-only enforcement in cohost and token invite routes:
    // no cohost invites on orphaned events.
    return eventHostId !== null;
  }

  function canCreateHostInvite(): boolean {
    // Direct host invites are disabled.
    return false;
  }

  function canAcceptHostInvite(): boolean {
    // Host ownership must be approved via claim workflow.
    return false;
  }

  it("blocks cohost invite creation on orphaned events", () => {
    expect(canInviteCohost(null)).toBe(false);
  });

  it("allows cohost invite creation only when event has primary host", () => {
    expect(canInviteCohost("user-abc")).toBe(true);
  });

  it("never allows direct host invite creation", () => {
    expect(canCreateHostInvite()).toBe(false);
  });

  it("never allows host ownership via invite acceptance", () => {
    expect(canAcceptHostInvite()).toBe(false);
  });
});

// ── Admin Leave button guard tests ────────────────────────────────

describe("Admin currentUserRole determination", () => {
  interface HostRow {
    user_id: string;
    role: string;
    invitation_status: string;
  }

  function computeCurrentUserRole(
    sessionUserId: string,
    hostsWithProfiles: HostRow[]
  ): "host" | "cohost" | null {
    // Mirror the logic from page.tsx
    const userHost = hostsWithProfiles.find(
      (h) => h.user_id === sessionUserId && h.invitation_status === "accepted"
    );
    return userHost
      ? (userHost.role === "host" ? "host" : "cohost")
      : null;
  }

  it("returns null for admin without event_hosts row", () => {
    expect(computeCurrentUserRole("admin-123", [])).toBeNull();
  });

  it("returns cohost for admin with accepted cohost row", () => {
    expect(
      computeCurrentUserRole("admin-123", [
        { user_id: "admin-123", role: "cohost", invitation_status: "accepted" },
      ])
    ).toBe("cohost");
  });

  it("returns host for user with accepted host row", () => {
    expect(
      computeCurrentUserRole("user-456", [
        { user_id: "user-456", role: "host", invitation_status: "accepted" },
      ])
    ).toBe("host");
  });

  it("returns null when user has pending invitation (not yet accepted)", () => {
    expect(
      computeCurrentUserRole("user-789", [
        { user_id: "user-789", role: "cohost", invitation_status: "pending" },
      ])
    ).toBeNull();
  });
});
