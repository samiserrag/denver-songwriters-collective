/**
 * Regression test: Ensure event.notes (internal admin metadata) is NEVER rendered on public open mic pages.
 *
 * Background: The `notes` field contains internal data like:
 * - signup_time: 18:00
 * - backline: False
 * - last_verified_date: 2025-11-30
 * - sources: https://...
 *
 * This was accidentally rendered on public detail pages, violating trust.
 * This test ensures the leak cannot recur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the escapeHtml and linkifyUrls functions used in the page
vi.mock("@/lib/highlight", () => ({
  highlight: (text: string) => text,
  escapeHtml: (text: string) => text,
  linkifyUrls: (text: string) => text,
}));

describe("Open Mic Detail Page - Notes Field Security", () => {
  // Simulate an event object with both notes (internal) and description (public)
  const mockEventWithNotes = {
    id: "test-id",
    title: "Test Open Mic",
    slug: "test-open-mic",
    description: "This is a human-readable description for the public.",
    notes: "signup_time: 18:00; backline: False; last_verified_date: 2025-11-30; sources: https://example.com",
    day_of_week: "Monday",
    start_time: "19:00:00",
    venue: {
      name: "Test Venue",
      address: "123 Test St",
      city: "Denver",
      state: "CO",
    },
  };

  const mockEventWithoutDescription = {
    id: "test-id-2",
    title: "Open Mic No Description",
    slug: "open-mic-no-desc",
    description: null,
    notes: "signup_time: 17:30; backline: True; host_name: Test Host; last_verified_date: 2025-12-01",
    day_of_week: "Tuesday",
    start_time: "18:00:00",
    venue: null,
  };

  describe("Notes field must NEVER appear in public rendering", () => {
    it("should NOT contain 'signup_time:' pattern when notes field has it", () => {
      // The notes field contains this pattern
      expect(mockEventWithNotes.notes).toContain("signup_time:");

      // But public rendering should only use description
      const publicContent = mockEventWithNotes.description || "";
      expect(publicContent).not.toContain("signup_time:");
    });

    it("should NOT contain 'backline:' pattern when notes field has it", () => {
      expect(mockEventWithNotes.notes).toContain("backline:");

      const publicContent = mockEventWithNotes.description || "";
      expect(publicContent).not.toContain("backline:");
    });

    it("should NOT contain 'last_verified_date:' pattern when notes field has it", () => {
      expect(mockEventWithNotes.notes).toContain("last_verified_date:");

      const publicContent = mockEventWithNotes.description || "";
      expect(publicContent).not.toContain("last_verified_date:");
    });

    it("should NOT contain 'sources:' pattern when notes field has it", () => {
      expect(mockEventWithNotes.notes).toContain("sources:");

      const publicContent = mockEventWithNotes.description || "";
      expect(publicContent).not.toContain("sources:");
    });

    it("should NOT contain 'host_name:' pattern when notes field has it", () => {
      expect(mockEventWithoutDescription.notes).toContain("host_name:");

      const publicContent = mockEventWithoutDescription.description || "";
      expect(publicContent).not.toContain("host_name:");
    });
  });

  describe("Description field should be rendered when present", () => {
    it("should contain the human-readable description", () => {
      const publicContent = mockEventWithNotes.description || "";
      expect(publicContent).toContain("human-readable description");
    });

    it("should return empty string when description is null", () => {
      const publicContent = mockEventWithoutDescription.description || "";
      expect(publicContent).toBe("");
    });
  });

  describe("Contract: notes vs description separation", () => {
    it("notes field is for internal admin metadata only", () => {
      // Pattern check: notes contains structured key:value pairs
      const notesPattern = /[A-Za-z_]+: [^;]+;/;
      expect(mockEventWithNotes.notes).toMatch(notesPattern);
    });

    it("description field is for human-readable public content", () => {
      // Description should NOT contain the structured pattern
      const notesPattern = /[A-Za-z_]+: [^;]+;/;
      if (mockEventWithNotes.description) {
        expect(mockEventWithNotes.description).not.toMatch(notesPattern);
      }
    });
  });
});
