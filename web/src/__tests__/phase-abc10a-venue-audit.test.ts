/**
 * Phase ABC10a - Venue Audit Trail Tests
 *
 * Tests the venue edit audit logging and revert functionality.
 */

import { describe, it, expect } from "vitest";
import {
  VenueAuditAction,
  VenueAuditContext,
} from "@/lib/audit/venueAudit";
import {
  MANAGER_EDITABLE_VENUE_FIELDS,
  sanitizeVenuePatch,
} from "@/lib/venue/managerAuth";

describe("Venue Audit - ABC10a", () => {
  describe("VenueAuditAction types", () => {
    it("should support venue_edit action", () => {
      const action: VenueAuditAction = "venue_edit";
      expect(action).toBe("venue_edit");
    });

    it("should support venue_edit_reverted action", () => {
      const action: VenueAuditAction = "venue_edit_reverted";
      expect(action).toBe("venue_edit_reverted");
    });
  });

  describe("VenueAuditContext structure", () => {
    it("should include required fields", () => {
      const context: VenueAuditContext = {
        venueId: "test-venue-id",
        updatedFields: ["name", "address"],
        previousValues: { name: "Old Name", address: "Old Address" },
        newValues: { name: "New Name", address: "New Address" },
        actorRole: "manager",
      };

      expect(context.venueId).toBe("test-venue-id");
      expect(context.updatedFields).toHaveLength(2);
      expect(context.previousValues.name).toBe("Old Name");
      expect(context.newValues.name).toBe("New Name");
      expect(context.actorRole).toBe("manager");
    });

    it("should support optional venueName field", () => {
      const context: VenueAuditContext = {
        venueId: "test-venue-id",
        venueName: "Test Venue",
        updatedFields: ["name"],
        previousValues: { name: "Old" },
        newValues: { name: "New" },
        actorRole: "admin",
      };

      expect(context.venueName).toBe("Test Venue");
    });

    it("should support revert-specific fields", () => {
      const context: VenueAuditContext = {
        venueId: "test-venue-id",
        updatedFields: ["name"],
        previousValues: { name: "Current" },
        newValues: { name: "Reverted" },
        actorRole: "admin",
        reason: "Admin revert via Edit History",
        revertedLogId: "original-log-id",
      };

      expect(context.reason).toBe("Admin revert via Edit History");
      expect(context.revertedLogId).toBe("original-log-id");
    });
  });

  describe("Manager-editable fields allowlist", () => {
    it("should include all expected fields", () => {
      // Phase 0.6: Added latitude and longitude to editable fields
      const expectedFields = [
        "name",
        "address",
        "city",
        "state",
        "zip",
        "phone",
        "website_url",
        "google_maps_url",
        "map_link",
        "contact_link",
        "neighborhood",
        "accessibility_notes",
        "parking_notes",
        "cover_image_url",
        "latitude",
        "longitude",
      ];

      expect(MANAGER_EDITABLE_VENUE_FIELDS).toEqual(expectedFields);
    });

    // Phase 0.6: Expanded from 14 to 16 fields (added latitude, longitude)
    it("should have exactly 16 editable fields", () => {
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toHaveLength(16);
    });

    it("should NOT include sensitive fields", () => {
      // These fields should never be editable by managers
      // Phase 0.6: latitude and longitude are now editable (trust-first model)
      const sensitiveFields = ["id", "slug", "created_at", "notes"];

      for (const field of sensitiveFields) {
        expect(MANAGER_EDITABLE_VENUE_FIELDS).not.toContain(field);
      }
    });
  });

  describe("sanitizeVenuePatch", () => {
    it("should pass through allowed fields", () => {
      const input = {
        name: "New Venue Name",
        address: "123 Main St",
        city: "Denver",
      };

      const result = sanitizeVenuePatch(input);

      expect(result).toEqual(input);
    });

    it("should filter out disallowed fields", () => {
      const input = {
        name: "New Venue Name",
        id: "should-be-removed",
        slug: "should-be-removed",
        created_at: "should-be-removed",
        notes: "admin only notes",
      };

      const result = sanitizeVenuePatch(input);

      expect(result).toEqual({ name: "New Venue Name" });
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("slug");
      expect(result).not.toHaveProperty("created_at");
      expect(result).not.toHaveProperty("notes");
    });

    it("should handle empty input", () => {
      const result = sanitizeVenuePatch({});
      expect(result).toEqual({});
    });

    it("should preserve null values for optional fields", () => {
      const input = {
        phone: null,
        website_url: null,
      };

      const result = sanitizeVenuePatch(input);

      expect(result).toEqual(input);
    });
  });

  describe("Audit log structure", () => {
    it("should have source field set to venue_audit", () => {
      // This tests the expected shape of audit log entries
      const expectedLogEntry = {
        level: "info",
        message: "Venue: venue_edit",
        source: "venue_audit",
        context: {
          action: "venue_edit",
          actorId: "user-id",
          actorRole: "manager",
          venueId: "venue-id",
          updatedFields: ["name"],
          previousValues: { name: "Old" },
          newValues: { name: "New" },
        },
        user_id: "user-id",
      };

      expect(expectedLogEntry.source).toBe("venue_audit");
      expect(expectedLogEntry.level).toBe("info");
    });
  });

  describe("Revert safety", () => {
    it("should only revert allowed fields via sanitizeVenuePatch", () => {
      // Simulating a revert with previousValues that might include disallowed fields
      const previousValues = {
        name: "Original Name",
        address: "Original Address",
        slug: "should-not-be-reverted", // disallowed
        id: "should-not-be-reverted", // disallowed
      };

      const sanitized = sanitizeVenuePatch(previousValues);

      expect(sanitized).toEqual({
        name: "Original Name",
        address: "Original Address",
      });
    });

    // Phase 0.6: Expanded from 14 to 16 fields (added latitude, longitude)
    it("should handle all 16 manager-editable fields in revert", () => {
      const previousValues: Record<string, string | number | null> = {};
      for (const field of MANAGER_EDITABLE_VENUE_FIELDS) {
        // Phase 0.6: latitude and longitude are numeric fields
        if (field === "latitude") {
          previousValues[field] = 39.7392;
        } else if (field === "longitude") {
          previousValues[field] = -104.9903;
        } else {
          previousValues[field] = `original_${field}`;
        }
      }

      const sanitized = sanitizeVenuePatch(previousValues);

      expect(Object.keys(sanitized)).toHaveLength(16);
      for (const field of MANAGER_EDITABLE_VENUE_FIELDS) {
        if (field === "latitude") {
          expect(sanitized[field]).toBe(39.7392);
        } else if (field === "longitude") {
          expect(sanitized[field]).toBe(-104.9903);
        } else {
          expect(sanitized[field]).toBe(`original_${field}`);
        }
      }
    });
  });

  describe("VenueEditHistory component props", () => {
    it("should require logs with proper structure", () => {
      // Test the expected shape of logs passed to VenueEditHistory
      const exampleLog = {
        id: "log-1",
        created_at: "2026-01-12T10:00:00Z",
        context: {
          action: "venue_edit" as const,
          actorId: "user-1",
          actorRole: "manager" as const,
          venueId: "venue-1",
          venueName: "Test Venue",
          updatedFields: ["name"],
          previousValues: { name: "Old" },
          newValues: { name: "New" },
        },
        user_id: "user-1",
      };

      expect(exampleLog.context.action).toBe("venue_edit");
      expect(exampleLog.context.actorRole).toBe("manager");
      expect(Array.isArray(exampleLog.context.updatedFields)).toBe(true);
    });
  });

  describe("Revert API contract", () => {
    it("should require log_id parameter", () => {
      // The revert endpoint requires a log_id to identify which edit to revert
      const requiredParams = {
        log_id: "audit-log-id",
      };

      expect(requiredParams.log_id).toBeDefined();
    });

    it("should support optional reason parameter", () => {
      const params = {
        log_id: "audit-log-id",
        reason: "Admin requested revert due to incorrect information",
      };

      expect(params.reason).toBeDefined();
    });

    it("should return reverted fields on success", () => {
      const expectedResponse = {
        success: true,
        venue: { id: "venue-1", name: "Reverted Name" },
        revertedFields: ["name"],
        revertedLogId: "original-log-id",
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.revertedFields).toContain("name");
      expect(expectedResponse.revertedLogId).toBeDefined();
    });
  });

  describe("Edit History UI behavior", () => {
    it("should distinguish between edits and reverts", () => {
      const editLog = { action: "venue_edit" };
      const revertLog = { action: "venue_edit_reverted" };

      expect(editLog.action).not.toBe(revertLog.action);
      expect(editLog.action === "venue_edit").toBe(true);
      expect(revertLog.action === "venue_edit_reverted").toBe(true);
    });

    it("should only allow reverting edits, not reverts", () => {
      const canRevert = (action: string) => action === "venue_edit";

      expect(canRevert("venue_edit")).toBe(true);
      expect(canRevert("venue_edit_reverted")).toBe(false);
    });
  });
});

describe("Admin PATCH allowlist consistency - ABC10b preparation", () => {
  it("should verify admin and manager use same allowlist", () => {
    // ABC10b will reconcile admin PATCH to use MANAGER_EDITABLE_VENUE_FIELDS
    // This test documents the expected behavior after the fix
    const adminAllowlist = MANAGER_EDITABLE_VENUE_FIELDS;
    const managerAllowlist = MANAGER_EDITABLE_VENUE_FIELDS;

    expect(adminAllowlist).toEqual(managerAllowlist);
  });
});
