/**
 * Phase 10.2 — Geocoding alert-noise controls.
 *
 * Source assertions:
 * 1) Missing API key status suppresses admin geocoding failure emails.
 * 2) Venue selector UI no longer claims "Admin was notified" unconditionally.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MONITORING_PATH = path.resolve(
  __dirname,
  "../lib/venue/geocodingMonitoring.ts"
);
const UI_SELECTOR_PATH = path.resolve(
  __dirname,
  "../components/ui/VenueSelector.tsx"
);
const ADMIN_SELECTOR_PATH = path.resolve(
  __dirname,
  "../components/admin/VenueSelector.tsx"
);

const monitoringSource = fs.readFileSync(MONITORING_PATH, "utf-8");
const uiSelectorSource = fs.readFileSync(UI_SELECTOR_PATH, "utf-8");
const adminSelectorSource = fs.readFileSync(ADMIN_SELECTOR_PATH, "utf-8");

describe("Phase 10.2 — geocoding failure alert handling", () => {
  it("suppresses admin alert emails when geocoding reason is missing_api_key", () => {
    expect(monitoringSource).toContain("shouldSendAdminVenueGeocodingAlert");
    expect(monitoringSource).toContain('status.reason === "missing_api_key"');
    expect(monitoringSource).toContain("venue_geocoding_alert_suppressed");
  });

  it("still logs venue geocoding failures for observability", () => {
    expect(monitoringSource).toContain('"venue_geocoding_failed"');
    expect(monitoringSource).toContain("appLogger.error");
  });

  it("venue selectors do not claim admin notification unconditionally", () => {
    expect(uiSelectorSource).not.toContain("Admin was notified.");
    expect(adminSelectorSource).not.toContain("Admin was notified.");
  });
});

