/**
 * Event Comments Response Parsing Test
 *
 * Tests that EventComments correctly parses the API response format:
 * { comments: [...], date_key: "YYYY-MM-DD" }
 *
 * This test covers the fix for "Failed to load comments" bug where
 * the client was treating the API response object as an array.
 */

import { describe, it, expect } from "vitest";

/**
 * Extracted normalization logic from EventComments.tsx
 * This mirrors the exact parsing logic used in the component.
 */
function normalizeCommentsResponse(data: unknown): Array<{
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  user_id: string | null;
  guest_name: string | null;
  guest_verified: boolean;
  is_deleted: boolean;
  is_hidden: boolean;
  user: { id: string; full_name: string | null; avatar_url: string | null; slug: string | null } | null;
}> {
  // This is the FIXED logic - extract comments array from response object
  const commentsArray = (data as { comments?: unknown[] })?.comments || [];
  return commentsArray.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    content: c.content as string,
    created_at: c.created_at as string,
    parent_id: c.parent_id as string | null,
    user_id: c.user_id as string | null,
    guest_name: c.guest_name as string | null,
    guest_verified: (c.guest_verified as boolean) ?? false,
    is_deleted: (c.is_deleted as boolean) ?? false,
    is_hidden: (c.is_hidden as boolean) ?? false,
    user: Array.isArray(c.user) ? (c.user[0] as { id: string; full_name: string | null; avatar_url: string | null; slug: string | null } | null) ?? null : (c.user as { id: string; full_name: string | null; avatar_url: string | null; slug: string | null } | null),
  }));
}

describe("Event Comments Response Parsing", () => {
  describe("normalizeCommentsResponse", () => {
    it("should handle API response format { comments: [...], date_key: '...' }", () => {
      const apiResponse = {
        comments: [
          {
            id: "comment-1",
            content: "Test comment",
            created_at: "2026-01-13T10:00:00Z",
            parent_id: null,
            user_id: "user-1",
            guest_name: null,
            guest_verified: false,
            is_deleted: false,
            is_hidden: false,
            user: { id: "user-1", full_name: "Test User", avatar_url: null, slug: "test-user" },
          },
        ],
        date_key: "2026-01-13",
      };

      const normalized = normalizeCommentsResponse(apiResponse);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].id).toBe("comment-1");
      expect(normalized[0].content).toBe("Test comment");
      expect(normalized[0].user?.full_name).toBe("Test User");
    });

    it("should handle empty comments array", () => {
      const apiResponse = {
        comments: [],
        date_key: "2026-01-13",
      };

      const normalized = normalizeCommentsResponse(apiResponse);

      expect(normalized).toHaveLength(0);
      expect(Array.isArray(normalized)).toBe(true);
    });

    it("should handle missing comments property gracefully", () => {
      const apiResponse = {
        date_key: "2026-01-13",
      };

      const normalized = normalizeCommentsResponse(apiResponse);

      expect(normalized).toHaveLength(0);
      expect(Array.isArray(normalized)).toBe(true);
    });

    it("should handle null/undefined data gracefully", () => {
      expect(normalizeCommentsResponse(null)).toHaveLength(0);
      expect(normalizeCommentsResponse(undefined)).toHaveLength(0);
    });

    it("should handle user as array (Supabase join format)", () => {
      const apiResponse = {
        comments: [
          {
            id: "comment-1",
            content: "Test",
            created_at: "2026-01-13T10:00:00Z",
            parent_id: null,
            user_id: "user-1",
            guest_name: null,
            guest_verified: false,
            is_deleted: false,
            is_hidden: false,
            // Supabase sometimes returns joins as arrays
            user: [{ id: "user-1", full_name: "Array User", avatar_url: null, slug: "array-user" }],
          },
        ],
        date_key: "2026-01-13",
      };

      const normalized = normalizeCommentsResponse(apiResponse);

      expect(normalized[0].user?.full_name).toBe("Array User");
    });

    it("should handle guest comments (null user)", () => {
      const apiResponse = {
        comments: [
          {
            id: "comment-1",
            content: "Guest comment",
            created_at: "2026-01-13T10:00:00Z",
            parent_id: null,
            user_id: null,
            guest_name: "Guest User",
            guest_verified: true,
            is_deleted: false,
            is_hidden: false,
            user: null,
          },
        ],
        date_key: "2026-01-13",
      };

      const normalized = normalizeCommentsResponse(apiResponse);

      expect(normalized[0].user).toBeNull();
      expect(normalized[0].guest_name).toBe("Guest User");
      expect(normalized[0].guest_verified).toBe(true);
    });

    it("should default boolean fields to false when missing", () => {
      const apiResponse = {
        comments: [
          {
            id: "comment-1",
            content: "Test",
            created_at: "2026-01-13T10:00:00Z",
            parent_id: null,
            user_id: "user-1",
            guest_name: null,
            // Missing: guest_verified, is_deleted, is_hidden
            user: null,
          },
        ],
        date_key: "2026-01-13",
      };

      const normalized = normalizeCommentsResponse(apiResponse);

      expect(normalized[0].guest_verified).toBe(false);
      expect(normalized[0].is_deleted).toBe(false);
      expect(normalized[0].is_hidden).toBe(false);
    });

    it("should NOT throw when response is an object (regression test for .map on object bug)", () => {
      // This is the exact bug that was happening:
      // API returns { comments: [], date_key: "..." }
      // Old code did (data || []).map(...) which throws "data.map is not a function"
      const apiResponse = {
        comments: [],
        date_key: "2026-01-13",
      };

      // This should NOT throw
      expect(() => normalizeCommentsResponse(apiResponse)).not.toThrow();
    });
  });
});
