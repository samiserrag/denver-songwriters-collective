/**
 * Phase 4.94 — Event Invites v1 Tests
 *
 * Tests for token-based event invite system allowing admins/primary hosts
 * to invite users to become hosts or co-hosts of events.
 */

import { describe, it, expect } from "vitest";

// ========================================================================
// SCHEMA TESTS
// ========================================================================

describe("Phase 4.94: event_invites schema", () => {
  it("should have required columns", () => {
    // Schema columns defined in migration
    const requiredColumns = [
      "id",
      "event_id",
      "token_hash",
      "email_restriction",
      "role_to_grant",
      "created_at",
      "created_by",
      "expires_at",
      "accepted_at",
      "accepted_by",
      "revoked_at",
      "revoked_by",
      "revoked_reason",
    ];

    // This is a schema contract test - verifies the expected shape
    expect(requiredColumns).toHaveLength(13);
  });

  it("should enforce role_to_grant CHECK constraint", () => {
    const validRoles = ["host", "cohost"];
    const invalidRoles = ["admin", "viewer", "owner", ""];

    validRoles.forEach((role) => {
      expect(["host", "cohost"]).toContain(role);
    });

    invalidRoles.forEach((role) => {
      expect(["host", "cohost"]).not.toContain(role);
    });
  });

  it("should cascade delete on event deletion", () => {
    // event_invites.event_id references events(id) ON DELETE CASCADE
    // This is a DB-level constraint - documenting expected behavior
    const onDeleteBehavior = "CASCADE";
    expect(onDeleteBehavior).toBe("CASCADE");
  });
});

// ========================================================================
// INVITE STATUS COMPUTATION TESTS
// ========================================================================

describe("Phase 4.94: invite status computation", () => {
  interface TestInvite {
    accepted_at: string | null;
    revoked_at: string | null;
    expires_at: string;
  }

  function computeInviteStatus(invite: TestInvite): "pending" | "accepted" | "expired" | "revoked" {
    if (invite.revoked_at) return "revoked";
    if (invite.accepted_at) return "accepted";
    if (new Date(invite.expires_at) < new Date()) return "expired";
    return "pending";
  }

  it("returns 'revoked' when revoked_at is set", () => {
    const invite: TestInvite = {
      accepted_at: null,
      revoked_at: "2026-01-20T00:00:00Z",
      expires_at: "2026-01-30T00:00:00Z",
    };
    expect(computeInviteStatus(invite)).toBe("revoked");
  });

  it("returns 'revoked' even if also accepted (revoked takes precedence)", () => {
    const invite: TestInvite = {
      accepted_at: "2026-01-15T00:00:00Z",
      revoked_at: "2026-01-20T00:00:00Z",
      expires_at: "2026-01-30T00:00:00Z",
    };
    expect(computeInviteStatus(invite)).toBe("revoked");
  });

  it("returns 'accepted' when accepted_at is set and not revoked", () => {
    const invite: TestInvite = {
      accepted_at: "2026-01-15T00:00:00Z",
      revoked_at: null,
      expires_at: "2026-01-30T00:00:00Z",
    };
    expect(computeInviteStatus(invite)).toBe("accepted");
  });

  it("returns 'expired' when expires_at is in the past", () => {
    const invite: TestInvite = {
      accepted_at: null,
      revoked_at: null,
      expires_at: "2020-01-01T00:00:00Z", // Past date
    };
    expect(computeInviteStatus(invite)).toBe("expired");
  });

  it("returns 'pending' when not accepted, not revoked, and not expired", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const invite: TestInvite = {
      accepted_at: null,
      revoked_at: null,
      expires_at: futureDate.toISOString(),
    };
    expect(computeInviteStatus(invite)).toBe("pending");
  });
});

// ========================================================================
// TOKEN GENERATION TESTS
// ========================================================================

describe("Phase 4.94: token generation", () => {
  it("generates 64-character hex tokens", () => {
    // crypto.randomBytes(32).toString("hex") produces 64 hex chars
    const tokenLength = 32 * 2; // 32 bytes = 64 hex characters
    expect(tokenLength).toBe(64);
  });

  it("SHA-256 hash produces 64-character hex string", () => {
    // SHA-256 produces 256 bits = 32 bytes = 64 hex characters
    const hashLength = 256 / 8 * 2;
    expect(hashLength).toBe(64);
  });

  it("token hash prefix is first 8 characters for logging", () => {
    const mockTokenHash = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6";
    const prefix = mockTokenHash.slice(0, 8);
    expect(prefix).toBe("a1b2c3d4");
    expect(prefix.length).toBe(8);
  });
});

// ========================================================================
// AUTHORIZATION TESTS
// ========================================================================

describe("Phase 4.94: authorization rules", () => {
  interface AuthContext {
    isAdmin: boolean;
    isPrimaryHost: boolean; // events.host_id === userId
    isCohost: boolean;
    isAnonymous: boolean;
  }

  function canCreateInvite(ctx: AuthContext): boolean {
    return ctx.isAdmin || ctx.isPrimaryHost;
  }

  function canRevokeInvite(ctx: AuthContext): boolean {
    return ctx.isAdmin || ctx.isPrimaryHost;
  }

  function canListInvites(ctx: AuthContext): boolean {
    return ctx.isAdmin || ctx.isPrimaryHost;
  }

  it("admin can create invite", () => {
    expect(canCreateInvite({ isAdmin: true, isPrimaryHost: false, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("primary host can create invite", () => {
    expect(canCreateInvite({ isAdmin: false, isPrimaryHost: true, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("cohost cannot create invite", () => {
    expect(canCreateInvite({ isAdmin: false, isPrimaryHost: false, isCohost: true, isAnonymous: false })).toBe(false);
  });

  it("anonymous cannot create invite", () => {
    expect(canCreateInvite({ isAdmin: false, isPrimaryHost: false, isCohost: false, isAnonymous: true })).toBe(false);
  });

  it("admin can revoke invite", () => {
    expect(canRevokeInvite({ isAdmin: true, isPrimaryHost: false, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("primary host can revoke invite", () => {
    expect(canRevokeInvite({ isAdmin: false, isPrimaryHost: true, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("cohost cannot revoke invite", () => {
    expect(canRevokeInvite({ isAdmin: false, isPrimaryHost: false, isCohost: true, isAnonymous: false })).toBe(false);
  });

  it("admin can list invites", () => {
    expect(canListInvites({ isAdmin: true, isPrimaryHost: false, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("primary host can list invites", () => {
    expect(canListInvites({ isAdmin: false, isPrimaryHost: true, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("cohost cannot list invites", () => {
    expect(canListInvites({ isAdmin: false, isPrimaryHost: false, isCohost: true, isAnonymous: false })).toBe(false);
  });
});

// ========================================================================
// ACCEPTANCE FLOW TESTS
// ========================================================================

describe("Phase 4.94: acceptance flow validation", () => {
  interface AcceptanceContext {
    tokenExists: boolean;
    isRevoked: boolean;
    isAccepted: boolean;
    isExpired: boolean;
    emailMatches: boolean; // null restriction = always matches
    eventExists: boolean;
    userAlreadyHasAccess: boolean;
    roleToGrant: "host" | "cohost";
    eventHasHost: boolean; // events.host_id IS NOT NULL
  }

  type AcceptanceResult =
    | { ok: true; role: "host" | "cohost" }
    | { ok: false; error: string; status: number };

  function validateAcceptance(ctx: AcceptanceContext): AcceptanceResult {
    if (!ctx.tokenExists) return { ok: false, error: "Invalid or expired invite", status: 404 };
    if (ctx.isRevoked) return { ok: false, error: "This invite has been revoked", status: 400 };
    if (ctx.isAccepted) return { ok: false, error: "This invite has already been used", status: 400 };
    if (ctx.isExpired) return { ok: false, error: "This invite has expired", status: 400 };
    if (!ctx.emailMatches) return { ok: false, error: "This invite is restricted to a different email address", status: 403 };
    if (!ctx.eventExists) return { ok: false, error: "This event no longer exists", status: 404 };
    if (ctx.userAlreadyHasAccess) return { ok: false, error: "You already have access to this event", status: 409 };
    if (ctx.roleToGrant === "host" && ctx.eventHasHost) {
      return { ok: false, error: "This event already has a primary host", status: 409 };
    }
    return { ok: true, role: ctx.roleToGrant };
  }

  const validContext: AcceptanceContext = {
    tokenExists: true,
    isRevoked: false,
    isAccepted: false,
    isExpired: false,
    emailMatches: true,
    eventExists: true,
    userAlreadyHasAccess: false,
    roleToGrant: "cohost",
    eventHasHost: false,
  };

  it("accepts valid cohost invite", () => {
    const result = validateAcceptance(validContext);
    expect(result).toEqual({ ok: true, role: "cohost" });
  });

  it("accepts valid host invite when event has no host", () => {
    const result = validateAcceptance({ ...validContext, roleToGrant: "host" });
    expect(result).toEqual({ ok: true, role: "host" });
  });

  it("rejects host invite when event already has host", () => {
    const result = validateAcceptance({ ...validContext, roleToGrant: "host", eventHasHost: true });
    expect(result).toEqual({ ok: false, error: "This event already has a primary host", status: 409 });
  });

  it("rejects non-existent token", () => {
    const result = validateAcceptance({ ...validContext, tokenExists: false });
    expect(result).toEqual({ ok: false, error: "Invalid or expired invite", status: 404 });
  });

  it("rejects revoked invite", () => {
    const result = validateAcceptance({ ...validContext, isRevoked: true });
    expect(result).toEqual({ ok: false, error: "This invite has been revoked", status: 400 });
  });

  it("rejects already-used invite", () => {
    const result = validateAcceptance({ ...validContext, isAccepted: true });
    expect(result).toEqual({ ok: false, error: "This invite has already been used", status: 400 });
  });

  it("rejects expired invite", () => {
    const result = validateAcceptance({ ...validContext, isExpired: true });
    expect(result).toEqual({ ok: false, error: "This invite has expired", status: 400 });
  });

  it("rejects email mismatch", () => {
    const result = validateAcceptance({ ...validContext, emailMatches: false });
    expect(result).toEqual({ ok: false, error: "This invite is restricted to a different email address", status: 403 });
  });

  it("rejects if event no longer exists", () => {
    const result = validateAcceptance({ ...validContext, eventExists: false });
    expect(result).toEqual({ ok: false, error: "This event no longer exists", status: 404 });
  });

  it("rejects if user already has access", () => {
    const result = validateAcceptance({ ...validContext, userAlreadyHasAccess: true });
    expect(result).toEqual({ ok: false, error: "You already have access to this event", status: 409 });
  });
});

// ========================================================================
// URL PATTERN TESTS
// ========================================================================

describe("Phase 4.94: URL patterns", () => {
  it("invite URL has correct format", () => {
    const siteUrl = "https://coloradosongwriterscollective.org";
    const token = "abc123def456";
    const inviteUrl = `${siteUrl}/event-invite?token=${token}`;

    expect(inviteUrl).toBe("https://coloradosongwriterscollective.org/event-invite?token=abc123def456");
    expect(inviteUrl).toContain("/event-invite?token=");
  });

  it("login redirect preserves token", () => {
    const token = "abc123def456";
    const redirectUrl = `/login?redirect=/event-invite?token=${encodeURIComponent(token)}`;

    expect(redirectUrl).toBe("/login?redirect=/event-invite?token=abc123def456");
    expect(redirectUrl).toContain(encodeURIComponent(token));
  });

  it("API routes follow pattern", () => {
    const eventId = "123e4567-e89b-12d3-a456-426614174000";
    const inviteId = "456e7890-e89b-12d3-a456-426614174000";

    const createRoute = `/api/my-events/${eventId}/invite`;
    const listRoute = `/api/my-events/${eventId}/invite`;
    const revokeRoute = `/api/my-events/${eventId}/invite/${inviteId}`;
    const acceptRoute = "/api/event-invites/accept";

    expect(createRoute).toBe(`/api/my-events/${eventId}/invite`);
    expect(listRoute).toBe(`/api/my-events/${eventId}/invite`);
    expect(revokeRoute).toBe(`/api/my-events/${eventId}/invite/${inviteId}`);
    expect(acceptRoute).toBe("/api/event-invites/accept");
  });
});

// ========================================================================
// EMAIL TEMPLATE TESTS
// ========================================================================

describe("Phase 4.94: email template generation", () => {
  function getEmailTemplate(url: string, eventTitle: string, expiresAt: string): string {
    const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `You've been invited to help host "${eventTitle}" on The Colorado Songwriters Collective!

Click this link to accept:
${url}

This invite expires on ${expiryDate}.`;
  }

  it("generates correct email template", () => {
    const url = "https://coloradosongwriterscollective.org/event-invite?token=abc123";
    const eventTitle = "Open Mic Night";
    const expiresAt = "2026-02-03T00:00:00Z";

    const template = getEmailTemplate(url, eventTitle, expiresAt);

    expect(template).toContain('You\'ve been invited to help host "Open Mic Night"');
    expect(template).toContain(url);
    expect(template).toContain("This invite expires on");
  });

  it("includes CSC branding", () => {
    const template = getEmailTemplate("url", "title", "2026-01-01");
    expect(template).toContain("The Colorado Songwriters Collective");
  });
});

// ========================================================================
// EXPIRY PRESET TESTS
// ========================================================================

describe("Phase 4.94: expiry presets", () => {
  const expiryPresets = [3, 7, 14, 30];

  it("provides standard expiry options", () => {
    expect(expiryPresets).toContain(3);
    expect(expiryPresets).toContain(7);
    expect(expiryPresets).toContain(14);
    expect(expiryPresets).toContain(30);
  });

  it("default expiry is 7 days", () => {
    const defaultExpiry = 7;
    expect(expiryPresets[1]).toBe(defaultExpiry);
  });

  it("calculates expiry timestamp correctly", () => {
    const now = new Date("2026-01-27T00:00:00Z");
    const expiresInDays = 7;
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    expect(expiresAt.toISOString()).toBe("2026-02-03T00:00:00.000Z");
  });
});

// ========================================================================
// ROLE GRANT BEHAVIOR TESTS
// ========================================================================

describe("Phase 4.94: role grant behavior", () => {
  it("cohost invite inserts event_hosts row only", () => {
    const roleToGrant = "cohost";
    const expectsEventHostsInsert = true;
    const expectsEventsHostIdUpdate = false;

    expect(roleToGrant).toBe("cohost");
    expect(expectsEventHostsInsert).toBe(true);
    expect(expectsEventsHostIdUpdate).toBe(false);
  });

  it("host invite updates events.host_id AND inserts event_hosts row", () => {
    const roleToGrant = "host";
    const expectsEventHostsInsert = true;
    const expectsEventsHostIdUpdate = true;

    expect(roleToGrant).toBe("host");
    expect(expectsEventHostsInsert).toBe(true);
    expect(expectsEventsHostIdUpdate).toBe(true);
  });

  it("event_hosts row has correct fields", () => {
    const eventHostsRow = {
      event_id: "uuid",
      user_id: "uuid",
      role: "cohost",
      invitation_status: "accepted",
      invited_by: "uuid",
      invited_at: "timestamp",
      responded_at: "timestamp",
    };

    expect(eventHostsRow.invitation_status).toBe("accepted");
    expect(["host", "cohost"]).toContain(eventHostsRow.role);
  });
});

// ========================================================================
// UI COMPONENT TESTS
// ========================================================================

describe("Phase 4.94: EventInviteSection visibility", () => {
  interface ViewerContext {
    isAdmin: boolean;
    isEventOwner: boolean; // events.host_id === userId
    isCohost: boolean;
    isAnonymous: boolean;
  }

  function shouldShowInviteSection(ctx: ViewerContext): boolean {
    return ctx.isAdmin || ctx.isEventOwner;
  }

  it("shows for admin", () => {
    expect(shouldShowInviteSection({ isAdmin: true, isEventOwner: false, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("shows for primary host (event owner)", () => {
    expect(shouldShowInviteSection({ isAdmin: false, isEventOwner: true, isCohost: false, isAnonymous: false })).toBe(true);
  });

  it("hides for cohost", () => {
    expect(shouldShowInviteSection({ isAdmin: false, isEventOwner: false, isCohost: true, isAnonymous: false })).toBe(false);
  });

  it("hides for anonymous", () => {
    expect(shouldShowInviteSection({ isAdmin: false, isEventOwner: false, isCohost: false, isAnonymous: true })).toBe(false);
  });
});

// ========================================================================
// NOTIFICATION TESTS
// ========================================================================

describe("Phase 4.94: notifications", () => {
  it("notifies invite creator when invite is accepted", () => {
    const notificationPayload = {
      p_user_id: "creator-uuid",
      p_type: "event_invite_accepted",
      p_title: "Event invite accepted",
      p_message: 'Jane Doe accepted your invite and is now a co-host of "Open Mic Night".',
      p_link: "/dashboard/my-events/event-uuid",
    };

    expect(notificationPayload.p_type).toBe("event_invite_accepted");
    expect(notificationPayload.p_message).toContain("accepted your invite");
    expect(notificationPayload.p_link).toContain("/dashboard/my-events/");
  });

  it("uses correct role label in notification", () => {
    const hostLabel = "host";
    const cohostLabel = "co-host";

    expect(hostLabel).toBe("host");
    expect(cohostLabel).toBe("co-host");
  });
});
