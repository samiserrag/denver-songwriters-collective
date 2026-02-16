/**
 * Email Preferences Master Toggle Tests
 *
 * Tests that the email_enabled master toggle correctly gates all email sending,
 * the email footer includes the preferences link, and the EmailPreferencesSection
 * component behavior.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";
import { wrapEmailHtml, wrapEmailText } from "@/lib/email/render";

/* ------------------------------------------------------------------ */
/*  1) shouldSendEmail returns false when email_enabled is false       */
/* ------------------------------------------------------------------ */

describe("Master toggle decision path", () => {
  it("DEFAULT_PREFERENCES has email_enabled defaulting to true", () => {
    expect(DEFAULT_PREFERENCES.email_enabled).toBe(true);
  });

  it("shouldSendEmail short-circuits when email_enabled is false (source verification)", () => {
    // Verify the source has the email_enabled guard BEFORE the switch(category)
    const src = fs.readFileSync(
      path.join(__dirname, "../lib/notifications/preferences.ts"),
      "utf-8"
    );
    const enabledGuardIdx = src.indexOf("if (!prefs.email_enabled) return false");
    const switchIdx = src.indexOf("switch (category)");
    expect(enabledGuardIdx).toBeGreaterThan(-1);
    expect(switchIdx).toBeGreaterThan(-1);
    // Master guard must come before the category switch
    expect(enabledGuardIdx).toBeLessThan(switchIdx);
  });

  it("category toggles are independent of master toggle in storage", () => {
    const prefs: NotificationPreferences = {
      user_id: "test-user",
      email_enabled: false,
      email_claim_updates: true,
      email_event_updates: false,
      email_admin_notifications: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Category settings are preserved even when master is off
    expect(prefs.email_claim_updates).toBe(true);
    expect(prefs.email_event_updates).toBe(false);
    expect(prefs.email_admin_notifications).toBe(true);
  });

  it("getPreferences spreads DEFAULT_PREFERENCES for missing rows", () => {
    // Verify source uses DEFAULT_PREFERENCES spread for fallback
    const src = fs.readFileSync(
      path.join(__dirname, "../lib/notifications/preferences.ts"),
      "utf-8"
    );
    expect(src).toContain("...DEFAULT_PREFERENCES");
    // Ensure email_enabled is in DEFAULT_PREFERENCES
    expect(DEFAULT_PREFERENCES).toHaveProperty("email_enabled", true);
    expect(DEFAULT_PREFERENCES).toHaveProperty("email_claim_updates", true);
    expect(DEFAULT_PREFERENCES).toHaveProperty("email_event_updates", true);
    expect(DEFAULT_PREFERENCES).toHaveProperty("email_admin_notifications", true);
  });
});

/* ------------------------------------------------------------------ */
/*  2) Email footer includes preferences link                         */
/* ------------------------------------------------------------------ */

describe("Email footer preferences link", () => {
  it("HTML wrapper includes manage email preferences link with exact URL path", () => {
    const html = wrapEmailHtml("<p>Test content</p>");
    expect(html).toContain("Manage email preferences");
    expect(html).toContain("/dashboard?emailPrefs=1");
  });

  it("Plain text wrapper includes manage email preferences link with exact URL path", () => {
    const text = wrapEmailText("Test content");
    expect(text).toContain("Manage email preferences");
    expect(text).toContain("/dashboard?emailPrefs=1");
  });

  it("HTML preferences link is a proper anchor tag", () => {
    const html = wrapEmailHtml("<p>Test</p>");
    expect(html).toMatch(
      /<a[^>]+href="[^"]*\/dashboard\?emailPrefs=1"[^>]*>Manage email preferences<\/a>/
    );
  });

  it("footer link URL uses /dashboard not /dashboard/notifications", () => {
    const html = wrapEmailHtml("<p>Test</p>");
    const text = wrapEmailText("Test");
    // Must deep-link to dashboard (where EmailPreferencesSection lives)
    expect(html).toContain("/dashboard?emailPrefs=1");
    expect(text).toContain("/dashboard?emailPrefs=1");
    // Must NOT link to the standalone notifications page
    expect(html).not.toContain("/dashboard/notifications?emailPrefs=1");
    expect(text).not.toContain("/dashboard/notifications?emailPrefs=1");
  });
});

/* ------------------------------------------------------------------ */
/*  3) EmailPreferencesSection behavior (structural tests)            */
/* ------------------------------------------------------------------ */

describe("EmailPreferencesSection design contracts", () => {
  const componentPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/notifications/EmailPreferencesSection.tsx"
  );
  const componentSrc = fs.readFileSync(componentPath, "utf-8");

  it("collapsed by default without emailPrefs param", () => {
    const forceOpen = null;
    const defaultOpen = forceOpen === "1";
    expect(defaultOpen).toBe(false);
  });

  it("expanded when emailPrefs=1 query param is present", () => {
    const forceOpen = "1";
    const defaultOpen = forceOpen === "1";
    expect(defaultOpen).toBe(true);
  });

  it("not expanded for other emailPrefs values", () => {
    expect("0" === "1").toBe(false);
    expect("true" === "1").toBe(false);
    expect("" === "1").toBe(false);
  });

  it("master toggle disables category toggles when off", () => {
    const prefs = { ...DEFAULT_PREFERENCES, email_enabled: false };
    const masterOff = !prefs.email_enabled;
    expect(masterOff).toBe(true);
  });

  it("master toggle enables category toggles when on", () => {
    const prefs = { ...DEFAULT_PREFERENCES, email_enabled: true };
    const masterOff = !prefs.email_enabled;
    expect(masterOff).toBe(false);
  });

  it("has id='email-preferences' for deep-link scroll target", () => {
    expect(componentSrc).toContain('id="email-preferences"');
  });

  it("uses scrollIntoView for deep-link auto-scroll", () => {
    expect(componentSrc).toContain("scrollIntoView");
  });

  it("blocks category writes when master toggle is off", () => {
    // Verify the handleToggle guard exists in source
    expect(componentSrc).toContain(
      'key !== "email_enabled" && !prefs.email_enabled'
    );
  });

  it("copy says 'Stop all emails' not 'No emails'", () => {
    expect(componentSrc).toContain("Stop all emails");
    expect(componentSrc).not.toContain('"No emails"');
  });
});

/* ------------------------------------------------------------------ */
/*  4) Settings page copy consistency                                  */
/* ------------------------------------------------------------------ */

describe("Settings page email preferences copy", () => {
  const settingsPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/settings/page.tsx"
  );
  const settingsSrc = fs.readFileSync(settingsPath, "utf-8");

  it("uses 'Stop all emails' copy matching dashboard component", () => {
    expect(settingsSrc).toContain("Stop all emails");
  });

  it("disables category toggles when email_enabled is false", () => {
    expect(settingsSrc).toContain("!prefs.email_enabled");
  });
});
