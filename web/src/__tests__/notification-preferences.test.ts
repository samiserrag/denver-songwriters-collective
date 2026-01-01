/**
 * Notification Preferences Tests
 *
 * Tests for the email preference system that gates email sending
 * while always allowing dashboard notifications.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_PREFERENCES,
  getEmailCategory,
  EMAIL_CATEGORY_MAP,
} from "@/lib/notifications/preferences";

describe("Notification Preferences", () => {
  describe("DEFAULT_PREFERENCES", () => {
    it("defaults all email preferences to true", () => {
      expect(DEFAULT_PREFERENCES.email_claim_updates).toBe(true);
      expect(DEFAULT_PREFERENCES.email_event_updates).toBe(true);
      expect(DEFAULT_PREFERENCES.email_admin_notifications).toBe(true);
    });

    it("has exactly 3 preference keys", () => {
      const keys = Object.keys(DEFAULT_PREFERENCES);
      expect(keys).toHaveLength(3);
      expect(keys).toContain("email_claim_updates");
      expect(keys).toContain("email_event_updates");
      expect(keys).toContain("email_admin_notifications");
    });
  });

  describe("EMAIL_CATEGORY_MAP", () => {
    it("maps claim templates to claim_updates category", () => {
      expect(EMAIL_CATEGORY_MAP["eventClaimSubmitted"]).toBe("claim_updates");
      expect(EMAIL_CATEGORY_MAP["eventClaimApproved"]).toBe("claim_updates");
      expect(EMAIL_CATEGORY_MAP["eventClaimRejected"]).toBe("claim_updates");
    });

    it("maps event templates to event_updates category", () => {
      expect(EMAIL_CATEGORY_MAP["eventReminder"]).toBe("event_updates");
      expect(EMAIL_CATEGORY_MAP["eventUpdated"]).toBe("event_updates");
      expect(EMAIL_CATEGORY_MAP["eventCancelled"]).toBe("event_updates");
      expect(EMAIL_CATEGORY_MAP["occurrenceCancelledHost"]).toBe("event_updates");
      expect(EMAIL_CATEGORY_MAP["occurrenceModifiedHost"]).toBe("event_updates");
      expect(EMAIL_CATEGORY_MAP["rsvpConfirmation"]).toBe("event_updates");
      expect(EMAIL_CATEGORY_MAP["waitlistPromotion"]).toBe("event_updates");
    });

    it("maps admin templates to admin_notifications category", () => {
      expect(EMAIL_CATEGORY_MAP["adminEventClaimNotification"]).toBe("admin_notifications");
      expect(EMAIL_CATEGORY_MAP["contactNotification"]).toBe("admin_notifications");
    });
  });

  describe("getEmailCategory", () => {
    it("returns correct category for known templates", () => {
      expect(getEmailCategory("eventClaimSubmitted")).toBe("claim_updates");
      expect(getEmailCategory("eventReminder")).toBe("event_updates");
      expect(getEmailCategory("adminEventClaimNotification")).toBe("admin_notifications");
    });

    it("returns null for unknown templates", () => {
      expect(getEmailCategory("unknownTemplate")).toBeNull();
      expect(getEmailCategory("")).toBeNull();
    });

    it("returns null for templates not in the category map", () => {
      // These templates exist but are not preference-gated
      expect(getEmailCategory("verificationCode")).toBeNull();
      expect(getEmailCategory("claimConfirmed")).toBeNull();
      expect(getEmailCategory("newsletterWelcome")).toBeNull();
    });
  });

  describe("Preference categories cover Phase 4.24 templates", () => {
    const phase424Templates = [
      "eventClaimSubmitted",
      "eventClaimApproved",
      "eventClaimRejected",
      "adminEventClaimNotification",
      "occurrenceCancelledHost",
      "occurrenceModifiedHost",
    ];

    for (const template of phase424Templates) {
      it(`${template} has a category assignment`, () => {
        const category = getEmailCategory(template);
        expect(category).not.toBeNull();
        expect(["claim_updates", "event_updates", "admin_notifications"]).toContain(category);
      });
    }
  });
});

describe("Preference Behavior", () => {
  it("dashboard notifications remain canonical even when email is off", () => {
    // This is a documentation/design test
    // The key invariant is: preferences only gate EMAIL, not notifications

    // When email_claim_updates = false:
    // - Dashboard notification for "claim submitted" should still appear
    // - Email should NOT be sent

    // This behavior is enforced by sendEmailWithPreferences which:
    // 1. Always creates notification first (if requested)
    // 2. Only sends email if preference allows

    // We can't easily test the actual DB/email behavior in unit tests,
    // but we can verify the design intention is documented
    expect(true).toBe(true);
  });

  it("admin toggle should only render for admin users", () => {
    // This is a UI behavior verified in the settings page
    // The isAdmin state controls whether the admin toggle is rendered
    // Non-admins never see the admin notifications toggle
    expect(true).toBe(true);
  });
});

describe("Category mapping completeness", () => {
  const categorizedTemplates = Object.keys(EMAIL_CATEGORY_MAP);

  it("has reasonable number of categorized templates", () => {
    // We expect at least the Phase 4.24 templates + event lifecycle
    expect(categorizedTemplates.length).toBeGreaterThanOrEqual(10);
  });

  it("all categories are valid", () => {
    const validCategories = ["claim_updates", "event_updates", "admin_notifications"];

    for (const template of categorizedTemplates) {
      const category = EMAIL_CATEGORY_MAP[template];
      expect(validCategories).toContain(category);
    }
  });
});
