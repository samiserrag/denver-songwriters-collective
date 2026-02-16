/**
 * Email Template Coverage Test
 *
 * Developer contract: every template registered in TEMPLATE_REGISTRY
 * must appear in either EMAIL_CATEGORY_MAP or ESSENTIAL_EMAILS.
 *
 * If this test fails after adding a new template, you need to:
 * 1. Add the template key to EMAIL_CATEGORY_MAP in preferences.ts
 *    (choose: "claim_updates" | "event_updates" | "admin_notifications")
 *    OR add it to ESSENTIAL_EMAILS if it's a security/auth email.
 * 2. Update docs/email-preferences.md with the new template.
 *
 * See docs/email-preferences.md for the full checklist.
 */

import { getAllTemplateKeys } from "../lib/email/registry";
import {
  EMAIL_CATEGORY_MAP,
  ESSENTIAL_EMAILS,
} from "../lib/notifications/preferences";

describe("Email template preference coverage", () => {
  const registryKeys = getAllTemplateKeys();

  it("registry is non-empty", () => {
    expect(registryKeys.length).toBeGreaterThan(0);
  });

  it.each(registryKeys)(
    "template '%s' is in EMAIL_CATEGORY_MAP or ESSENTIAL_EMAILS",
    (key) => {
      const inMap = key in EMAIL_CATEGORY_MAP;
      const inEssential = ESSENTIAL_EMAILS.has(key);
      expect(inMap || inEssential).toBe(true);
    }
  );

  it("ESSENTIAL_EMAILS contains only valid registry keys or known extras", () => {
    // Every essential email should either be a registry key or
    // a known non-registry template (none expected today).
    for (const key of ESSENTIAL_EMAILS) {
      expect(registryKeys).toContain(key);
    }
  });

  it("EMAIL_CATEGORY_MAP values are valid categories", () => {
    const validCategories = new Set([
      "claim_updates",
      "event_updates",
      "admin_notifications",
    ]);
    for (const [key, category] of Object.entries(EMAIL_CATEGORY_MAP)) {
      expect(validCategories.has(category)).toBe(true);
    }
  });

  it("no template appears in both ESSENTIAL_EMAILS and EMAIL_CATEGORY_MAP", () => {
    for (const key of ESSENTIAL_EMAILS) {
      expect(key in EMAIL_CATEGORY_MAP).toBe(false);
    }
  });
});
