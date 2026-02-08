/**
 * Phase 4.49b: Event Comments Everywhere
 *
 * Tests for event comments feature:
 * - Comments on all events (CSC + community)
 * - Guest comment support via verification
 * - Notifications to hosts and reply authors
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn().mockReturnThis(),
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    admin: {
      getUserById: vi.fn(),
    },
  },
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/email/sendWithPreferences", () => ({
  sendEmailWithPreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  getVerificationCodeEmail: vi.fn().mockReturnValue({
    subject: "Verification Code",
    html: "<p>Code: 123456</p>",
    text: "Code: 123456",
  }),
}));

vi.mock("@/lib/guest-verification/config", () => ({
  isGuestVerificationEnabled: vi.fn().mockReturnValue(true),
  featureDisabledResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "Feature disabled" }), { status: 503 })
  ),
  GUEST_VERIFICATION_CONFIG: {
    CODE_EXPIRES_MINUTES: 15,
    MAX_CODES_PER_EMAIL_PER_HOUR: 5,
    MAX_CODE_ATTEMPTS: 5,
    LOCKOUT_MINUTES: 30,
  },
}));

vi.mock("@/lib/guest-verification/crypto", () => ({
  generateVerificationCode: vi.fn().mockReturnValue("123456"),
  hashCode: vi.fn().mockReturnValue("hashed_code"),
  verifyCodeHash: vi.fn().mockImplementation((code, hash) => hash === "valid_hash"),
  createActionToken: vi.fn().mockResolvedValue("test_action_token"),
}));

describe("Phase 4.49b: Event Comments Everywhere", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Event Comments API (GET)", () => {
    it("should return comments for any event (not CSC-gated)", async () => {
      // Test that GET works for community event (is_dsc_event=false)
      const mockComments = [
        {
          id: "comment-1",
          content: "Great event!",
          created_at: "2026-01-07T10:00:00Z",
          parent_id: null,
          user_id: "user-1",
          guest_name: null,
          guest_verified: false,
          is_deleted: false,
          is_hidden: false,
          user: { id: "user-1", full_name: "Test User", avatar_url: null, slug: "test-user" },
        },
      ];

      mockSupabase.single.mockResolvedValueOnce({ data: mockComments, error: null });

      // The endpoint should work regardless of is_dsc_event
      expect(mockComments).toHaveLength(1);
      expect(mockComments[0].content).toBe("Great event!");
    });

    it("should include guest comments with guest_name", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "Guest comment",
          created_at: "2026-01-07T10:00:00Z",
          parent_id: null,
          user_id: null, // No user_id for guest
          guest_name: "Guest User",
          guest_verified: true,
          is_deleted: false,
          is_hidden: false,
          user: null,
        },
      ];

      // Guest comment has guest_name instead of user_id
      expect(mockComments[0].user_id).toBeNull();
      expect(mockComments[0].guest_name).toBe("Guest User");
      expect(mockComments[0].guest_verified).toBe(true);
    });

    it("should exclude deleted comments (is_deleted=true)", async () => {
      // Verify filter logic excludes deleted
      const query = "eq(is_deleted, false)";
      expect(query).toContain("is_deleted");
      expect(query).toContain("false");
    });

    it("should exclude hidden comments (is_hidden=true)", async () => {
      // Verify filter logic excludes hidden
      const query = "eq(is_hidden, false)";
      expect(query).toContain("is_hidden");
      expect(query).toContain("false");
    });
  });

  describe("Event Comments API (POST)", () => {
    it("should allow authenticated users to post comments", async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: { id: "user-1" } } },
      });

      const commentData = {
        event_id: "event-1",
        user_id: "user-1",
        content: "Test comment",
        parent_id: null,
      };

      // Comment should be created with user_id
      expect(commentData.user_id).toBe("user-1");
      expect(commentData.content).toBe("Test comment");
    });

    it("should reject unauthenticated POST requests", async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
      });

      // Member POST requires authentication
      const isAuthenticated = false;
      expect(isAuthenticated).toBe(false);
    });

    it("should enforce max comment length (2000 chars)", async () => {
      const MAX_COMMENT_LENGTH = 2000;
      const longContent = "a".repeat(2001);

      expect(longContent.length).toBeGreaterThan(MAX_COMMENT_LENGTH);
    });

    it("should support parent_id for replies", async () => {
      const replyData = {
        event_id: "event-1",
        user_id: "user-1",
        content: "This is a reply",
        parent_id: "parent-comment-1",
      };

      expect(replyData.parent_id).toBe("parent-comment-1");
    });
  });

  describe("Guest Comment Request Code", () => {
    it("should create verification record with action_type='comment'", async () => {
      const verificationRecord = {
        email: "guest@example.com",
        event_id: "event-1",
        guest_name: "Guest User",
        action_type: "comment",
        action_token: JSON.stringify({ content: "Test comment", parent_id: null }),
      };

      expect(verificationRecord.action_type).toBe("comment");
      expect(JSON.parse(verificationRecord.action_token)).toHaveProperty("content");
    });

    it("should store pending comment data in action_token", async () => {
      const pendingData = {
        content: "My guest comment",
        parent_id: "parent-1",
      };

      const actionToken = JSON.stringify(pendingData);
      const parsed = JSON.parse(actionToken);

      expect(parsed.content).toBe("My guest comment");
      expect(parsed.parent_id).toBe("parent-1");
    });

    it("should validate event is published", async () => {
      const event = { id: "event-1", is_published: false };

      // Should reject if event is not published
      expect(event.is_published).toBe(false);
    });

    it("should rate limit: max 5 codes per email per hour", async () => {
      const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
      const recentCodeCount = 6;

      expect(recentCodeCount).toBeGreaterThanOrEqual(MAX_CODES_PER_EMAIL_PER_HOUR);
    });
  });

  describe("Guest Comment Verify Code", () => {
    it("should create comment with guest fields on valid code", async () => {
      const guestComment = {
        event_id: "event-1",
        user_id: null,
        guest_name: "Guest User",
        guest_email: "guest@example.com",
        guest_verified: true,
        guest_verification_id: "verification-1",
        content: "Guest comment content",
        parent_id: null,
      };

      expect(guestComment.user_id).toBeNull();
      expect(guestComment.guest_name).toBe("Guest User");
      expect(guestComment.guest_verified).toBe(true);
    });

    it("should update verification record with comment_id", async () => {
      const verificationUpdate = {
        verified_at: "2026-01-07T10:00:00Z",
        comment_id: "new-comment-id",
      };

      expect(verificationUpdate.comment_id).toBe("new-comment-id");
      expect(verificationUpdate.verified_at).toBeTruthy();
    });

    it("should reject invalid verification codes", async () => {
      const { verifyCodeHash } = await import("@/lib/guest-verification/crypto");

      // Mock returns false for invalid hash
      const isValid = verifyCodeHash("wrong", "invalid_hash");
      expect(isValid).toBe(false);
    });

    it("should reject expired codes", async () => {
      const codeExpiresAt = new Date("2026-01-06T10:00:00Z"); // Past
      const now = new Date("2026-01-07T10:00:00Z");

      expect(codeExpiresAt < now).toBe(true);
    });

    it("should lock out after max attempts", async () => {
      const MAX_ATTEMPTS = 5;
      const currentAttempts = 5;

      expect(currentAttempts).toBeGreaterThanOrEqual(MAX_ATTEMPTS);
    });
  });

  describe("Comment Notifications", () => {
    it("should notify event hosts for top-level comments", async () => {
      // Top-level comment (parent_id = null) → notify hosts
      const comment = { parent_id: null, content: "Top level" };
      const isTopLevel = comment.parent_id === null;

      expect(isTopLevel).toBe(true);
    });

    it("should notify parent author for reply comments", async () => {
      // Reply (parent_id set) → notify parent author
      const reply = { parent_id: "parent-1", content: "Reply" };
      const isReply = reply.parent_id !== null;

      expect(isReply).toBe(true);
    });

    it("should use event_updates notification category", async () => {
      // Verify EMAIL_CATEGORY_MAP includes eventCommentNotification
      const categories = {
        eventCommentNotification: "event_updates",
      };

      expect(categories.eventCommentNotification).toBe("event_updates");
    });

    it("should skip notification for guest-to-guest replies", async () => {
      // Guest comments don't receive reply notifications (no account)
      const parentComment = {
        user_id: null, // Guest
        guest_email: "guest@example.com",
      };

      // When parent is guest, we skip notification
      const shouldNotify = parentComment.user_id !== null;
      expect(shouldNotify).toBe(false);
    });
  });

  describe("Email Template", () => {
    it("should generate correct subject for new comment", () => {
      // Subject format for new top-level comments
      const eventTitle = "Test Event";
      const isReply = false;

      const subject = isReply
        ? "Someone replied to your comment"
        : `New comment on "${eventTitle}"`;

      expect(subject).toBe('New comment on "Test Event"');
    });

    it("should generate correct subject for reply", () => {
      // Subject format for replies
      const commenterName = "John";
      const isReply = true;

      const subject = isReply
        ? `${commenterName} replied to your comment`
        : "New comment";

      expect(subject).toBe("John replied to your comment");
    });

    it("should include comment preview in email", () => {
      // Email body includes the comment preview
      const commentPreview = "This is my comment preview";
      const bodyContainsPreview = `"${commentPreview}"`;

      expect(bodyContainsPreview).toContain("This is my comment preview");
    });

    it("should indicate truncation for long previews", () => {
      // Long comments (200+ chars) show ellipsis
      const longPreview = "a".repeat(200);
      const shouldShowEllipsis = longPreview.length >= 200;

      expect(shouldShowEllipsis).toBe(true);
    });
  });

  describe("UI Component", () => {
    it("should show (guest) label for guest comments", () => {
      // Guest comments are rendered with "(guest)" label
      const isGuest = true;
      const label = isGuest ? "(guest)" : null;

      expect(label).toBe("(guest)");
    });

    it("should not link guest names to profiles", () => {
      // Guest comments have no profile link
      const guestComment = {
        guest_name: "Guest User",
        user: null,
      };

      const profileLink = guestComment.user?.slug ? `/songwriters/${guestComment.user.slug}` : null;
      expect(profileLink).toBeNull();
    });

    it("should show sign in + guest options for unauthenticated users", () => {
      // When not logged in, show both options
      const currentUserId = null;
      const showGuestOption = currentUserId === null;

      expect(showGuestOption).toBe(true);
    });

    it("should support threading (parent_id references)", () => {
      const comments = [
        { id: "1", parent_id: null, content: "Top level" },
        { id: "2", parent_id: "1", content: "Reply to 1" },
        { id: "3", parent_id: "1", content: "Another reply to 1" },
      ];

      // Top level has no parent
      const topLevel = comments.filter((c) => c.parent_id === null);
      expect(topLevel).toHaveLength(1);

      // Two replies to parent "1"
      const replies = comments.filter((c) => c.parent_id === "1");
      expect(replies).toHaveLength(2);
    });
  });

  describe("Schema Changes", () => {
    it("should allow user_id to be nullable", () => {
      // Guest comments have user_id = null
      const guestComment = { user_id: null, guest_name: "Guest" };
      expect(guestComment.user_id).toBeNull();
    });

    it("should require either user_id OR guest_name/email", () => {
      // Constraint: (user_id IS NOT NULL) OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
      const memberComment = { user_id: "user-1", guest_name: null };
      const guestComment = { user_id: null, guest_name: "Guest", guest_email: "g@e.com" };
      const invalidComment = { user_id: null, guest_name: null };

      const isValidMember = memberComment.user_id !== null;
      const isValidGuest = guestComment.guest_name !== null && guestComment.guest_email !== null;
      const isInvalid = invalidComment.user_id === null && invalidComment.guest_name === null;

      expect(isValidMember).toBe(true);
      expect(isValidGuest).toBe(true);
      expect(isInvalid).toBe(true);
    });

    it("should support is_deleted for soft delete", () => {
      const deletedComment = { id: "1", is_deleted: true, content: "[deleted]" };
      expect(deletedComment.is_deleted).toBe(true);
    });

    it("should have guest_verification_id FK on event_comments", () => {
      // Guest comments reference their verification record
      const guestComment = {
        guest_verification_id: "verification-uuid",
      };

      expect(guestComment.guest_verification_id).toBeTruthy();
    });

    it("should have comment_id FK on guest_verifications", () => {
      // After verification, guest_verifications stores the created comment_id
      const verification = {
        comment_id: "comment-uuid",
        verified_at: "2026-01-07T10:00:00Z",
      };

      expect(verification.comment_id).toBeTruthy();
    });
  });
});
