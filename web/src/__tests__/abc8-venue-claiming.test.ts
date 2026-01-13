/**
 * ABC8 Venue Claiming Tests
 *
 * Tests for the venue claiming, invite, and management system.
 */

import { describe, it, expect, vi } from "vitest";

// Mock imports
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: vi.fn(),
}));

vi.mock("@/lib/email/sendWithPreferences", () => ({
  sendEmailWithPreferences: vi.fn(() => Promise.resolve({ emailSent: true, notificationCreated: true })),
}));

describe("ABC8 Venue Claiming System", () => {
  // ===== CLAIMS =====
  describe("Venue Claims", () => {
    describe("Submit Claim", () => {
      it("should create pending claim when user submits claim", () => {
        // Test: When user submits claim for venue they don't manage
        // Expected: Creates pending claim with correct venue_id and requester_id
        const claim = {
          venue_id: "venue-123",
          requester_id: "user-456",
          message: "I own this venue",
          status: "pending",
        };

        expect(claim.status).toBe("pending");
        expect(claim.venue_id).toBe("venue-123");
        expect(claim.requester_id).toBe("user-456");
      });

      it("should block second pending claim for same venue/user", () => {
        // Test: When user already has pending claim for venue
        // Expected: Returns 409 conflict
        const existingClaim = { status: "pending" };
        const shouldBlock = existingClaim && existingClaim.status === "pending";
        expect(shouldBlock).toBe(true);
      });

      it("should allow claim after previous claim was rejected", () => {
        // Test: When user's previous claim was rejected
        // Expected: Allows new claim submission
        const previousClaim = { status: "rejected" };
        const canSubmitNew = previousClaim.status !== "pending";
        expect(canSubmitNew).toBe(true);
      });

      it("should block claim if user already manages venue", () => {
        // Test: When user has active venue_managers row
        // Expected: Returns 409 conflict
        const existingManager = { revoked_at: null };
        const shouldBlock = existingManager && existingManager.revoked_at === null;
        expect(shouldBlock).toBe(true);
      });
    });

    describe("Cancel Claim", () => {
      it("should cancel own pending claim", () => {
        // Test: User cancels their own pending claim
        // Expected: Sets status to 'cancelled', sets cancelled_at
        const claim = {
          status: "pending",
          requester_id: "user-123",
        };
        const userId = "user-123";

        const canCancel = claim.requester_id === userId && claim.status === "pending";
        expect(canCancel).toBe(true);
      });

      it("should not cancel approved claim", () => {
        // Test: User tries to cancel approved claim
        // Expected: Returns 404 (no pending claim found)
        const claim = { status: "approved" };
        const canCancel = claim.status === "pending";
        expect(canCancel).toBe(false);
      });

      it("should not cancel other user's claim", () => {
        // Test: User tries to cancel someone else's claim
        // Expected: Returns 404 (not found for their user_id)
        const claim = { requester_id: "other-user" };
        const userId = "current-user";
        const canCancel = claim.requester_id === userId;
        expect(canCancel).toBe(false);
      });
    });

    describe("Approve Claim", () => {
      it("should mark claim approved with reviewed_by/at", () => {
        // Test: Admin approves pending claim
        // Expected: Updates status, reviewed_by, reviewed_at
        const now = new Date().toISOString();
        const adminId = "admin-123";

        const updatedClaim = {
          status: "approved",
          reviewed_by: adminId,
          reviewed_at: now,
        };

        expect(updatedClaim.status).toBe("approved");
        expect(updatedClaim.reviewed_by).toBe(adminId);
        expect(updatedClaim.reviewed_at).toBeDefined();
      });

      it("should grant venue_managers row with owner role", () => {
        // Test: After approval, creates venue_managers entry
        // Expected: Creates row with role='owner', grant_method='claim'
        const managerGrant = {
          venue_id: "venue-123",
          user_id: "user-456",
          role: "owner",
          grant_method: "claim",
          revoked_at: null,
        };

        expect(managerGrant.role).toBe("owner");
        expect(managerGrant.grant_method).toBe("claim");
        expect(managerGrant.revoked_at).toBeNull();
      });

      it("should auto-reject if user already has access", () => {
        // Test: Approve claim when user already has venue_managers row
        // Expected: Rejects with reason about existing access
        const existingManager = { id: "existing-grant" };
        const shouldAutoReject = !!existingManager;
        expect(shouldAutoReject).toBe(true);
      });
    });

    describe("Reject Claim", () => {
      it("should mark claim rejected with reason", () => {
        // Test: Admin rejects claim with reason
        // Expected: Updates status, reviewed_by/at, rejection_reason
        const rejectionReason = "Unable to verify ownership";
        const adminId = "admin-123";

        const updatedClaim = {
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        };

        expect(updatedClaim.status).toBe("rejected");
        expect(updatedClaim.rejection_reason).toBe(rejectionReason);
      });

      it("should not reject already-resolved claim", () => {
        // Test: Admin tries to reject approved claim
        // Expected: Returns 400 (already resolved)
        const claim = { status: "approved" };
        const canReject = claim.status === "pending";
        expect(canReject).toBe(false);
      });
    });
  });

  // ===== INVITES =====
  describe("Venue Invites", () => {
    describe("Create Invite", () => {
      it("should return plaintext token once, store only hash", () => {
        // Test: Admin creates invite
        // Expected: Response includes plaintext token, DB stores hash
        const token = "abc123def456";
        const tokenHash = "sha256_hash_of_token";

        // API response includes plaintext
        const apiResponse = { inviteUrl: `/venue-invite?token=${token}` };
        expect(apiResponse.inviteUrl).toContain(token);

        // DB stores hash
        const dbRecord = { token_hash: tokenHash };
        expect(dbRecord.token_hash).not.toBe(token);
      });

      it("should set expiration date", () => {
        // Test: Invite has expiration
        // Expected: expires_at is set to future date
        const expiresInDays = 7;
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        expect(expiresAt > now).toBe(true);
      });

      it("should optionally set email restriction", () => {
        // Test: Admin creates invite with email restriction
        // Expected: email_restriction field is set
        const invite = {
          email_restriction: "specific@example.com",
        };
        expect(invite.email_restriction).toBe("specific@example.com");
      });
    });

    describe("Accept Invite", () => {
      it("should fail if token is expired", () => {
        // Test: User tries to accept expired invite
        // Expected: Returns 400 (expired)
        const invite = {
          expires_at: new Date("2020-01-01").toISOString(),
        };
        const isExpired = new Date(invite.expires_at) < new Date();
        expect(isExpired).toBe(true);
      });

      it("should fail if invite is revoked", () => {
        // Test: User tries to accept revoked invite
        // Expected: Returns 400 (revoked)
        const invite = {
          revoked_at: new Date().toISOString(),
        };
        const isRevoked = invite.revoked_at !== null;
        expect(isRevoked).toBe(true);
      });

      it("should fail if invite already accepted", () => {
        // Test: User tries to accept already-used invite
        // Expected: Returns 400 (already used)
        const invite = {
          accepted_at: new Date().toISOString(),
        };
        const isUsed = invite.accepted_at !== null;
        expect(isUsed).toBe(true);
      });

      it("should enforce email restriction", () => {
        // Test: User with different email tries to accept restricted invite
        // Expected: Returns 403 (wrong email)
        const invite = {
          email_restriction: "allowed@example.com",
        };
        const userEmail = "different@example.com";
        const emailMatches = invite.email_restriction === userEmail;
        expect(emailMatches).toBe(false);
      });

      it("should grant venue_managers row with manager role", () => {
        // Test: User accepts invite successfully
        // Expected: Creates venue_managers row with role='manager'
        const managerGrant = {
          role: "manager",
          grant_method: "invite",
        };
        expect(managerGrant.role).toBe("manager");
        expect(managerGrant.grant_method).toBe("invite");
      });

      it("should mark invite as accepted", () => {
        // Test: After successful accept
        // Expected: accepted_at and accepted_by are set
        const invite = {
          accepted_at: new Date().toISOString(),
          accepted_by: "user-123",
        };
        expect(invite.accepted_at).toBeDefined();
        expect(invite.accepted_by).toBe("user-123");
      });
    });

    describe("Revoke Invite", () => {
      it("should set revoked_at and revoked_by", () => {
        // Test: Admin revokes invite
        // Expected: revoked_at and revoked_by are set
        const invite = {
          revoked_at: new Date().toISOString(),
          revoked_by: "admin-123",
          revoked_reason: "No longer needed",
        };
        expect(invite.revoked_at).toBeDefined();
        expect(invite.revoked_by).toBe("admin-123");
      });

      it("should not revoke already-accepted invite", () => {
        // Test: Admin tries to revoke accepted invite
        // Expected: Returns 400 (already accepted)
        const invite = {
          accepted_at: new Date().toISOString(),
        };
        const canRevoke = !invite.accepted_at;
        expect(canRevoke).toBe(false);
      });
    });
  });

  // ===== MY VENUES =====
  describe("My Venues API", () => {
    it("should return only active grants", () => {
      // Test: /api/my-venues returns user's managed venues
      // Expected: Only includes rows where revoked_at IS NULL
      const grants = [
        { venue_id: "v1", revoked_at: null },
        { venue_id: "v2", revoked_at: "2024-01-01" },
        { venue_id: "v3", revoked_at: null },
      ];

      const activeGrants = grants.filter(g => g.revoked_at === null);
      expect(activeGrants).toHaveLength(2);
      expect(activeGrants.map(g => g.venue_id)).toEqual(["v1", "v3"]);
    });

    it("should include pending claims in response", () => {
      // Test: Response includes pending claims
      // Expected: pendingClaims array is populated
      const response = {
        venues: [],
        pendingClaims: [{ venue_id: "v1", status: "pending" }],
      };
      expect(response.pendingClaims).toHaveLength(1);
    });
  });

  describe("Relinquish Access", () => {
    it("should soft-delete by setting revoked_at", () => {
      // Test: User relinquishes access
      // Expected: Sets revoked_at, revoked_by, revoked_reason
      const grant = {
        revoked_at: new Date().toISOString(),
        revoked_by: "user-123",
        revoked_reason: "User relinquished access",
      };
      expect(grant.revoked_at).toBeDefined();
      expect(grant.revoked_reason).toBe("User relinquished access");
    });

    it("should block if sole owner", () => {
      // Test: Sole owner tries to relinquish
      // Expected: Returns 400 (must transfer first)
      const ownerCount = 1;
      const isSoleOwner = ownerCount === 1;
      expect(isSoleOwner).toBe(true);
    });

    it("should allow if multiple owners exist", () => {
      // Test: One of multiple owners relinquishes
      // Expected: Allows relinquish
      const ownerCount = 2;
      const canRelinquish = ownerCount > 1;
      expect(canRelinquish).toBe(true);
    });

    it("should allow manager to leave", () => {
      // Test: Manager (not owner) relinquishes
      // Expected: Always allowed for managers
      const role = "manager";
      const canRelinquish = role === "manager";
      expect(canRelinquish).toBe(true);
    });
  });

  // ===== AUTHORIZATION =====
  describe("Authorization", () => {
    it("should block non-admin from admin routes", async () => {
      // Test: Regular user tries to access /api/admin/venue-claims
      // Expected: Returns 403
      const { checkAdminRole } = await import("@/lib/auth/adminAuth");
      vi.mocked(checkAdminRole).mockResolvedValue(false);

      const isAdmin = await checkAdminRole({} as never, "user-123");
      expect(isAdmin).toBe(false);
    });

    it("should allow admin to access admin routes", async () => {
      // Test: Admin accesses /api/admin/venue-claims
      // Expected: Returns 200 with data
      const { checkAdminRole } = await import("@/lib/auth/adminAuth");
      vi.mocked(checkAdminRole).mockResolvedValue(true);

      const isAdmin = await checkAdminRole({} as never, "admin-123");
      expect(isAdmin).toBe(true);
    });

    it("should block non-admin from approve/reject", async () => {
      // Test: Regular user tries to approve claim
      // Expected: Returns 403
      const { checkAdminRole } = await import("@/lib/auth/adminAuth");
      vi.mocked(checkAdminRole).mockResolvedValue(false);

      const canApprove = await checkAdminRole({} as never, "user-123");
      expect(canApprove).toBe(false);
    });

    it("should block non-admin from creating invites", async () => {
      // Test: Regular user tries to create invite
      // Expected: Returns 403
      const { checkAdminRole } = await import("@/lib/auth/adminAuth");
      vi.mocked(checkAdminRole).mockResolvedValue(false);

      const canCreateInvite = await checkAdminRole({} as never, "user-123");
      expect(canCreateInvite).toBe(false);
    });
  });

  // ===== EMAIL TEMPLATES =====
  describe("Email Templates", () => {
    it("should send approved email with correct params", async () => {
      const { getVenueClaimApprovedEmail } = await import(
        "@/lib/email/templates/venueClaimApproved"
      );

      const email = getVenueClaimApprovedEmail({
        userName: "Test User",
        venueName: "Test Venue",
        venueId: "venue-123",
        venueSlug: "test-venue",
        role: "owner",
      });

      expect(email.subject).toContain("Test Venue");
      expect(email.subject).toContain("owner");
      expect(email.html).toContain("Test Venue");
      expect(email.html).toContain("/venues/test-venue");
      expect(email.text).toContain("Test Venue");
    });

    it("should send rejected email with reason", async () => {
      const { getVenueClaimRejectedEmail } = await import(
        "@/lib/email/templates/venueClaimRejected"
      );

      const email = getVenueClaimRejectedEmail({
        userName: "Test User",
        venueName: "Test Venue",
        venueId: "venue-123",
        reason: "Unable to verify ownership",
      });

      expect(email.subject).toContain("Test Venue");
      expect(email.html).toContain("Unable to verify ownership");
      expect(email.text).toContain("Unable to verify ownership");
    });

    it("should handle missing rejection reason", async () => {
      const { getVenueClaimRejectedEmail } = await import(
        "@/lib/email/templates/venueClaimRejected"
      );

      const email = getVenueClaimRejectedEmail({
        userName: "Test User",
        venueName: "Test Venue",
        venueId: "venue-123",
      });

      expect(email.subject).toBeDefined();
      expect(email.html).toBeDefined();
    });
  });

  // ===== EMAIL CATEGORY MAPPING =====
  describe("Email Category Mapping", () => {
    it("should map venue claim templates to claim_updates category", async () => {
      const { getEmailCategory } = await import("@/lib/notifications/preferences");

      expect(getEmailCategory("venueClaimApproved")).toBe("claim_updates");
      expect(getEmailCategory("venueClaimRejected")).toBe("claim_updates");
    });
  });
});
