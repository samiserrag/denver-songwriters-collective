#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * geocode-venues.js - One-time backfill script for venue coordinates
 *
 * Usage:
 *   node scripts/geocode-venues.js --key=YOUR_API_KEY           # Dry-run (default)
 *   node scripts/geocode-venues.js --key=YOUR_API_KEY --apply   # Actually update database
 *
 * Arguments:
 *   --key=YOUR_API_KEY - Google Geocoding API key (required)
 *   --apply            - Actually update database (default is dry-run)
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string (from .env.local)
 *   GOOGLE_GEOCODING_API_KEY - Alternative to --key argument
 *
 * Output:
 *   - Console table of results
 *   - geocode_failures.json if any failures occur
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

// Parse --key=VALUE argument
const keyArg = process.argv.find(arg => arg.startsWith("--key="));
const apiKeyFromArg = keyArg ? keyArg.split("=")[1] : null;

const DATABASE_URL = process.env.DATABASE_URL;
const GEOCODING_API_KEY = apiKeyFromArg || process.env.GOOGLE_GEOCODING_API_KEY;

const RATE_LIMIT_MS = 150; // 150ms between API calls

async function main() {
  const applyMode = process.argv.includes("--apply");

  console.log("\n=== Venue Geocoding Script ===");
  console.log(`Mode: ${applyMode ? "APPLY (will update database)" : "DRY-RUN (no changes)"}\n`);

  // Validate environment
  if (!DATABASE_URL) {
    console.error("ERROR: Missing DATABASE_URL");
    process.exit(1);
  }
  if (!GEOCODING_API_KEY) {
    console.error("ERROR: Missing Google Geocoding API key");
    console.error("Provide via: --key=YOUR_API_KEY or set GOOGLE_GEOCODING_API_KEY env var");
    process.exit(1);
  }

  // Create PostgreSQL client
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Fetch venues without coordinates
    const { rows: venues } = await client.query(`
      SELECT id, name, address, city, state, zip, latitude, longitude
      FROM venues
      WHERE latitude IS NULL
      ORDER BY name
    `);

    console.log(`Found ${venues.length} venues without coordinates\n`);

    if (venues.length === 0) {
      console.log("All venues already have coordinates. Nothing to do.");
      return;
    }

    const results = [];
    const failures = [];

    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i];
      const addressString = buildAddressString(venue);

      console.log(`[${i + 1}/${venues.length}] Geocoding: ${venue.name}`);

      try {
        const coords = await geocodeAddress(addressString);

        if (coords) {
          results.push({
            id: venue.id,
            name: venue.name,
            address: addressString,
            status: "SUCCESS",
            latitude: coords.lat,
            longitude: coords.lng,
          });

          if (applyMode) {
            await client.query(
              `UPDATE venues SET
                latitude = $1,
                longitude = $2,
                geocode_source = 'api',
                geocoded_at = NOW()
              WHERE id = $3`,
              [coords.lat, coords.lng, venue.id]
            );
            console.log(`  Updated: ${coords.lat}, ${coords.lng}`);
          } else {
            console.log(`  Would set: ${coords.lat}, ${coords.lng}`);
          }
        } else {
          results.push({
            id: venue.id,
            name: venue.name,
            address: addressString,
            status: "FAILED",
            latitude: null,
            longitude: null,
          });
          failures.push({
            id: venue.id,
            name: venue.name,
            address: addressString,
            reason: "Geocoding returned no results",
          });
          console.log("  FAILED: No results from geocoding API");
        }
      } catch (err) {
        results.push({
          id: venue.id,
          name: venue.name,
          address: addressString,
          status: "ERROR",
          latitude: null,
          longitude: null,
        });
        failures.push({
          id: venue.id,
          name: venue.name,
          address: addressString,
          reason: err.message,
        });
        console.log(`  ERROR: ${err.message}`);
      }

      // Rate limiting
      if (i < venues.length - 1) {
        await sleep(RATE_LIMIT_MS);
      }
    }

    // Print results table
    console.log("\n=== Results ===\n");
    console.table(
      results.map((r) => ({
        name: r.name.substring(0, 30),
        status: r.status,
        lat: r.latitude?.toFixed(6) || "-",
        lng: r.longitude?.toFixed(6) || "-",
      }))
    );

    // Summary
    const successCount = results.filter((r) => r.status === "SUCCESS").length;
    const failCount = results.filter((r) => r.status !== "SUCCESS").length;

    console.log("\n=== Summary ===");
    console.log(`Total processed: ${results.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    // Write failures to file
    if (failures.length > 0) {
      const failuresPath = path.join(__dirname, "geocode_failures.json");
      fs.writeFileSync(failuresPath, JSON.stringify(failures, null, 2));
      console.log(`\nFailures written to: ${failuresPath}`);
    }

    if (!applyMode && successCount > 0) {
      console.log("\nTo apply these changes, run:");
      console.log("  node scripts/geocode-venues.js --apply");
    }
  } finally {
    await client.end();
  }
}

function buildAddressString(venue) {
  const parts = [venue.name, venue.address, venue.city, venue.state, venue.zip].filter(Boolean);
  return parts.join(", ");
}

async function geocodeAddress(address) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", GEOCODING_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status === "OK" && data.results && data.results.length > 0) {
    const location = data.results[0].geometry.location;
    return { lat: location.lat, lng: location.lng };
  }

  if (data.status === "ZERO_RESULTS") {
    return null;
  }

  if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
    throw new Error(`Geocoding API error: ${data.status} - ${data.error_message || ""}`);
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
