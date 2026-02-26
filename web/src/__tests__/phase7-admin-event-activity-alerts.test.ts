/**
 * Phase 7A — Admin event activity alerts hardening contract tests.
 *
 * Source-code assertions only:
 * - non-admin create/edit paths include explicit action context
 * - occurrence override path now emits non-admin admin-lifecycle alerts
 * - lifecycle template is preference-mapped to admin_notifications
 * - alert sender uses preference-aware admin delivery path
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf-8");

const createRoute = read("app/api/my-events/route.ts");
const editRoute = read("app/api/my-events/[id]/route.ts");
const overridesRoute = read("app/api/my-events/[id]/overrides/route.ts");
const adminAlerts = read("lib/email/adminEventAlerts.ts");
const preferences = read("lib/notifications/preferences.ts");

describe("Phase 7A — route coverage", () => {
  it("non-admin create alerts include actionContext=create", () => {
    expect(createRoute).toContain("sendAdminEventAlert({");
    expect(createRoute).toContain('actionContext: "create"');
  });

  it("non-admin series edit alerts include actionContext=edit_series", () => {
    expect(editRoute).toContain("sendAdminEventAlert({");
    expect(editRoute).toContain('actionContext: "edit_series"');
  });

  it("override route imports and emits non-admin occurrence alerts", () => {
    expect(overridesRoute).toContain('from "@/lib/email/adminEventAlerts"');
    expect(overridesRoute).toContain("sendAdminEventAlert({");
    expect(overridesRoute).toContain('actionContext: "edit_occurrence"');
    expect(overridesRoute).toContain("occurrenceDateKey: date_key");
    expect(overridesRoute).toContain("if (!isAdmin && baseEvent && overrideChangedFields.length > 0)");
  });
});

describe("Phase 7A — delivery and preference wiring", () => {
  it("adminEventAlerts uses preference-aware send path", () => {
    expect(adminAlerts).toContain("sendAdminEmailWithPreferences(");
    expect(adminAlerts).toContain("getServiceRoleClient()");
    expect(adminAlerts).toContain("resolveAdminRecipients");
  });

  it("adminEventAlerts retains ADMIN_EMAIL fallback", () => {
    expect(adminAlerts).toContain("to: ADMIN_EMAIL");
    expect(adminAlerts).toContain("Preference-aware send failed, using fallback");
  });

  it("lifecycle alert template is mapped to admin_notifications", () => {
    expect(preferences).toContain('adminEventLifecycleAlert: "admin_notifications"');
  });
});
