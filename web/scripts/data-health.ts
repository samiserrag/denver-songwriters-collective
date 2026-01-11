/**
 * Data Health Report
 *
 * Ops Console v1: Read-only CLI health report for venues and events.
 *
 * Reports:
 * 1. Venue health checks (detailed)
 * 2. Event summary checks (counts only)
 *
 * Usage:
 *   cd web && npx tsx scripts/data-health.ts
 *
 * Exit codes:
 *   0 = Healthy (no critical issues)
 *   1 = Critical issues found or script error
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VenueHealthResult {
  totalVenues: number;
  nullOrEmptyName: number;
  nullCityOrState: number;
  missingGoogleMapsUrl: number;
  invalidGoogleMapsUrl: number;
  hasNotesButNoMapsUrl: number;
}

interface EventHealthResult {
  totalEvents: number;
  unconfirmedEvents: number;
  cancelledEvents: number;
  missingLocation: number;
}

interface HealthReport {
  venue: VenueHealthResult;
  event: EventHealthResult;
  hasCriticalIssues: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Venue Health Checks
// ─────────────────────────────────────────────────────────────────────────────

async function checkVenueHealth(): Promise<VenueHealthResult> {
  console.log("Checking venue health...");

  // Fetch all venues
  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, name, city, state, google_maps_url, notes");

  if (error) {
    console.error("Error fetching venues:", error);
    throw error;
  }

  const allVenues = venues || [];
  const totalVenues = allVenues.length;

  // NULL or empty name
  const nullOrEmptyName = allVenues.filter(
    (v) => !v.name || v.name.trim() === ""
  ).length;

  // NULL city or state
  const nullCityOrState = allVenues.filter(
    (v) => !v.city || !v.state
  ).length;

  // Missing google_maps_url
  const missingGoogleMapsUrl = allVenues.filter(
    (v) => !v.google_maps_url
  ).length;

  // Invalid google_maps_url (not http/https)
  const invalidGoogleMapsUrl = allVenues.filter((v) => {
    if (!v.google_maps_url) return false;
    const url = v.google_maps_url.trim().toLowerCase();
    return !url.startsWith("http://") && !url.startsWith("https://");
  }).length;

  // Has notes but no google_maps_url
  const hasNotesButNoMapsUrl = allVenues.filter(
    (v) => v.notes && v.notes.trim() !== "" && !v.google_maps_url
  ).length;

  return {
    totalVenues,
    nullOrEmptyName,
    nullCityOrState,
    missingGoogleMapsUrl,
    invalidGoogleMapsUrl,
    hasNotesButNoMapsUrl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Health Checks (Summary Only)
// ─────────────────────────────────────────────────────────────────────────────

async function checkEventHealth(): Promise<EventHealthResult> {
  console.log("Checking event health...");

  // Total events
  const { count: totalEvents, error: totalError } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true });

  if (totalError) {
    console.error("Error counting events:", totalError);
    throw totalError;
  }

  // Unconfirmed events (last_verified_at IS NULL AND status != 'cancelled')
  const { count: unconfirmedEvents, error: unconfirmedError } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .is("last_verified_at", null)
    .neq("status", "cancelled");

  if (unconfirmedError) {
    console.error("Error counting unconfirmed events:", unconfirmedError);
    throw unconfirmedError;
  }

  // Cancelled events
  const { count: cancelledEvents, error: cancelledError } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("status", "cancelled");

  if (cancelledError) {
    console.error("Error counting cancelled events:", cancelledError);
    throw cancelledError;
  }

  // Events without venue_id or custom_location_name
  const { data: locationlessEvents, error: locationError } = await supabase
    .from("events")
    .select("id")
    .is("venue_id", null)
    .or("custom_location_name.is.null,custom_location_name.eq.");

  if (locationError) {
    console.error("Error checking location-less events:", locationError);
    throw locationError;
  }

  // Filter to those that truly have neither
  const missingLocation = (locationlessEvents || []).length;

  return {
    totalEvents: totalEvents || 0,
    unconfirmedEvents: unconfirmedEvents || 0,
    cancelledEvents: cancelledEvents || 0,
    missingLocation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Printing
// ─────────────────────────────────────────────────────────────────────────────

function printReport(report: HealthReport): void {
  const { venue, event } = report;

  console.log("\n========================================");
  console.log("         DATA HEALTH REPORT");
  console.log("========================================\n");

  // Venue Section
  console.log("─── VENUE HEALTH ───\n");
  console.log(`  Total venues:                  ${venue.totalVenues}`);
  console.log(
    `  NULL/empty name:               ${venue.nullOrEmptyName}${venue.nullOrEmptyName > 0 ? " ⚠️  CRITICAL" : " ✓"}`
  );
  console.log(
    `  NULL city or state:            ${venue.nullCityOrState}${venue.nullCityOrState > 0 ? " ⚠️" : " ✓"}`
  );
  console.log(`  Missing google_maps_url:       ${venue.missingGoogleMapsUrl}`);
  console.log(
    `  Invalid google_maps_url:       ${venue.invalidGoogleMapsUrl}${venue.invalidGoogleMapsUrl > 0 ? " ⚠️" : " ✓"}`
  );
  console.log(`  Has notes but no maps URL:     ${venue.hasNotesButNoMapsUrl}`);

  // Coverage percentage
  const mapsUrlCoverage =
    venue.totalVenues > 0
      ? (
          ((venue.totalVenues - venue.missingGoogleMapsUrl) / venue.totalVenues) *
          100
        ).toFixed(1)
      : "N/A";
  console.log(`\n  Google Maps URL coverage:      ${mapsUrlCoverage}%`);

  console.log();

  // Event Section
  console.log("─── EVENT HEALTH (Summary) ───\n");
  console.log(`  Total events:                  ${event.totalEvents}`);
  console.log(`  Unconfirmed:                   ${event.unconfirmedEvents}`);
  console.log(`  Cancelled:                     ${event.cancelledEvents}`);
  console.log(
    `  Missing location:              ${event.missingLocation}${event.missingLocation > 0 ? " ⚠️" : " ✓"}`
  );

  console.log();

  // Summary
  console.log("========================================");
  console.log("               SUMMARY");
  console.log("========================================\n");

  if (report.hasCriticalIssues) {
    console.log("  ❌ CRITICAL ISSUES FOUND\n");
    if (venue.nullOrEmptyName > 0) {
      console.log(`     - ${venue.nullOrEmptyName} venue(s) with NULL/empty name`);
    }
    console.log();
    console.log("  Run with --fix to see remediation options.");
  } else {
    console.log("  ✓ No critical issues found.\n");
    if (venue.missingGoogleMapsUrl > 0) {
      console.log(
        `  📋 Recommendation: Backfill ${venue.missingGoogleMapsUrl} missing google_maps_url values`
      );
      console.log("     via Ops Console CSV export/import.\n");
    }
  }

  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Starting data health check...\n");

  try {
    const venue = await checkVenueHealth();
    const event = await checkEventHealth();

    // Critical issues: NULL/empty venue names
    const hasCriticalIssues = venue.nullOrEmptyName > 0;

    const report: HealthReport = {
      venue,
      event,
      hasCriticalIssues,
    };

    printReport(report);

    if (hasCriticalIssues) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\nData health check failed:", error);
    process.exit(1);
  }
}

main();
