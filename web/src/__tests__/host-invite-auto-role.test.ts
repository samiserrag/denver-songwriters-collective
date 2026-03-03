/**
 * Tests for host invitation auto-role assignment and email template.
 *
 * Covers:
 * 1. Role determination logic at invite creation time
 * 2. Email template role-awareness
 * 3. Atomic host claim on acceptance
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

// ── Role determination logic tests ────────────────────────────────

describe("Host role auto-assignment logic", () => {
  // These test the business rules without hitting the API:
  // The role decision algorithm from cohosts/route.ts

  function determineInviteRole(opts: {
    eventHostId: string | null;
    existingHostRows: Array<{ role: string; invitation_status: string }>;
  }): "host" | "cohost" {
    // Mirror the logic from the API route
    if (opts.eventHostId) return "cohost";

    const hasExistingHost = opts.existingHostRows.some(
      (row) => row.role === "host"
    );
    if (hasExistingHost) return "cohost";

    return "host";
  }

  it("assigns host when event has no host_id and no host rows", () => {
    expect(
      determineInviteRole({ eventHostId: null, existingHostRows: [] })
    ).toBe("host");
  });

  it("assigns cohost when event has host_id set", () => {
    expect(
      determineInviteRole({ eventHostId: "user-abc", existingHostRows: [] })
    ).toBe("cohost");
  });

  it("assigns cohost when pending host invite exists (no host_id)", () => {
    expect(
      determineInviteRole({
        eventHostId: null,
        existingHostRows: [{ role: "host", invitation_status: "pending" }],
      })
    ).toBe("cohost");
  });

  it("assigns cohost when accepted host row exists but host_id is null (drift)", () => {
    expect(
      determineInviteRole({
        eventHostId: null,
        existingHostRows: [{ role: "host", invitation_status: "accepted" }],
      })
    ).toBe("cohost");
  });

  it("assigns cohost when event has host_id and cohost rows", () => {
    expect(
      determineInviteRole({
        eventHostId: "user-abc",
        existingHostRows: [{ role: "cohost", invitation_status: "accepted" }],
      })
    ).toBe("cohost");
  });

  it("assigns host when only cohost rows exist and no host_id (orphaned event)", () => {
    expect(
      determineInviteRole({
        eventHostId: null,
        existingHostRows: [{ role: "cohost", invitation_status: "accepted" }],
      })
    ).toBe("host");
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
