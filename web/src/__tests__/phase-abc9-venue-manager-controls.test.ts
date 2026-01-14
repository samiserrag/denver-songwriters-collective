/**
 * Phase ABC9 - Venue Manager Controls Tests
 *
 * Tests for venue manager authorization, field allowlists, and API behavior.
 */

import { describe, it, expect } from "vitest";
import {
  MANAGER_EDITABLE_VENUE_FIELDS,
  sanitizeVenuePatch,
  getDisallowedFields,
} from "@/lib/venue/managerAuth";

describe("ABC9: Venue Manager Controls", () => {
  describe("MANAGER_EDITABLE_VENUE_FIELDS", () => {
    it("should contain expected editable fields", () => {
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("name");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("address");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("city");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("state");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("zip");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("phone");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("website_url");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("google_maps_url");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("map_link");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("contact_link");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("neighborhood");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("accessibility_notes");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("parking_notes");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("cover_image_url");
    });

    it("should NOT contain system-managed fields", () => {
      const fields = MANAGER_EDITABLE_VENUE_FIELDS as readonly string[];
      expect(fields).not.toContain("id");
      expect(fields).not.toContain("slug");
      expect(fields).not.toContain("created_at");
      expect(fields).not.toContain("updated_at");
    });

    it("should NOT contain admin-only fields", () => {
      const fields = MANAGER_EDITABLE_VENUE_FIELDS as readonly string[];
      expect(fields).not.toContain("notes"); // Admin-only internal notes
    });

    it("should have exactly 14 editable fields", () => {
      expect(MANAGER_EDITABLE_VENUE_FIELDS.length).toBe(14);
    });
  });

  describe("sanitizeVenuePatch", () => {
    it("should pass through allowed fields", () => {
      const patch = {
        name: "New Name",
        address: "123 Main St",
        city: "Denver",
      };

      const result = sanitizeVenuePatch(patch);

      expect(result).toEqual({
        name: "New Name",
        address: "123 Main St",
        city: "Denver",
      });
    });

    it("should strip disallowed system fields", () => {
      const patch = {
        name: "New Name",
        id: "malicious-uuid",
        slug: "malicious-slug",
        created_at: "2020-01-01",
        updated_at: "2020-01-01",
      };

      const result = sanitizeVenuePatch(patch);

      expect(result).toEqual({ name: "New Name" });
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("slug");
      expect(result).not.toHaveProperty("created_at");
      expect(result).not.toHaveProperty("updated_at");
    });

    it("should strip admin-only notes field", () => {
      const patch = {
        name: "New Name",
        notes: "Admin internal notes - should not be editable by managers",
      };

      const result = sanitizeVenuePatch(patch);

      expect(result).toEqual({ name: "New Name" });
      expect(result).not.toHaveProperty("notes");
    });

    it("should handle null values", () => {
      const patch = {
        phone: null,
        website_url: null,
      };

      const result = sanitizeVenuePatch(patch);

      expect(result).toEqual({
        phone: null,
        website_url: null,
      });
    });

    it("should return empty object when no fields are allowed", () => {
      const patch = {
        id: "malicious",
        notes: "malicious",
        unknown_field: "malicious",
      };

      const result = sanitizeVenuePatch(patch);

      expect(result).toEqual({});
    });

    it("should handle empty patch", () => {
      const patch = {};

      const result = sanitizeVenuePatch(patch);

      expect(result).toEqual({});
    });
  });

  describe("getDisallowedFields", () => {
    it("should return empty array when all fields are allowed", () => {
      const patch = {
        name: "New Name",
        address: "123 Main St",
      };

      const result = getDisallowedFields(patch);

      expect(result).toEqual([]);
    });

    it("should return list of disallowed fields", () => {
      const patch = {
        name: "New Name",
        id: "malicious",
        slug: "malicious",
        notes: "malicious",
      };

      const result = getDisallowedFields(patch);

      expect(result).toContain("id");
      expect(result).toContain("slug");
      expect(result).toContain("notes");
      expect(result).not.toContain("name"); // name is allowed
    });

    it("should detect unknown fields", () => {
      const patch = {
        name: "New Name",
        unknown_field: "value",
        another_unknown: "value",
      };

      const result = getDisallowedFields(patch);

      expect(result).toContain("unknown_field");
      expect(result).toContain("another_unknown");
    });
  });

  describe("Security invariants", () => {
    it("should never allow id mutation through sanitize", () => {
      const attempts = [
        { id: "new-uuid" },
        { ID: "new-uuid" },
        { Id: "new-uuid" },
        { name: "test", id: "injected" },
      ];

      for (const patch of attempts) {
        const result = sanitizeVenuePatch(patch);
        expect(result).not.toHaveProperty("id");
        expect(result).not.toHaveProperty("ID");
        expect(result).not.toHaveProperty("Id");
      }
    });

    it("should never allow slug mutation through sanitize", () => {
      const attempts = [
        { slug: "new-slug" },
        { name: "test", slug: "injected" },
      ];

      for (const patch of attempts) {
        const result = sanitizeVenuePatch(patch);
        expect(result).not.toHaveProperty("slug");
      }
    });

    it("should never allow notes mutation (admin-only)", () => {
      const attempts = [
        { notes: "malicious internal notes" },
        { name: "test", notes: "injected" },
      ];

      for (const patch of attempts) {
        const result = sanitizeVenuePatch(patch);
        expect(result).not.toHaveProperty("notes");
      }
    });
  });
});
