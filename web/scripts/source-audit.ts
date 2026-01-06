#!/usr/bin/env npx tsx
/**
 * Phase 4.43: Source Contract Audit Script
 *
 * Audits the `source` field on events to detect contract violations:
 * - Events with source='community' but host_id IS NULL (should be 'import' or 'admin')
 * - Events with unexpected source values
 * - Events with source='import' that have last_verified_at set (shouldn't auto-confirm)
 *
 * Usage:
 *   npx tsx scripts/source-audit.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Allowed source values per SEEDING-CONTRACT.md
const ALLOWED_SOURCES = ["community", "import", "admin"];

interface EventRow {
  id: string;
  title: string;
  source: string | null;
  host_id: string | null;
  last_verified_at: string | null;
  is_published: boolean | null;
  created_at: string | null;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Phase 4.43: Source Contract Audit                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // Fetch all events
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, source, host_id, last_verified_at, is_published, created_at")
    .order("created_at", { ascending: false });

  if (eventsError) {
    console.error("❌ Error fetching events:", eventsError.message);
    process.exit(1);
  }

  const typedEvents = events as EventRow[];
  console.log(`📊 Total events: ${typedEvents.length}\n`);

  // Audit categories
  const violations: { id: string; title: string; issue: string }[] = [];
  const warnings: { id: string; title: string; issue: string }[] = [];

  // Group by source
  const sourceGroups: Record<string, number> = {};

  for (const event of typedEvents) {
    const source = event.source || "null";
    sourceGroups[source] = (sourceGroups[source] || 0) + 1;

    // Check 1: Unknown source value
    if (event.source && !ALLOWED_SOURCES.includes(event.source)) {
      violations.push({
        id: event.id,
        title: event.title,
        issue: `Unknown source value: "${event.source}"`,
      });
    }

    // Check 2: Community source but no host_id (should be import/admin)
    if (event.source === "community" && event.host_id === null) {
      violations.push({
        id: event.id,
        title: event.title,
        issue: `source="community" but host_id is NULL (should be "import" or "admin")`,
      });
    }

    // Check 3: Import source with last_verified_at set (shouldn't auto-confirm)
    if (event.source === "import" && event.last_verified_at !== null) {
      warnings.push({
        id: event.id,
        title: event.title,
        issue: `source="import" but last_verified_at is set (should require admin verification)`,
      });
    }

    // Check 4: Admin source with last_verified_at auto-set on publish
    if (event.source === "admin" && event.last_verified_at !== null && event.is_published) {
      warnings.push({
        id: event.id,
        title: event.title,
        issue: `source="admin" but verified on publish (should require manual verification)`,
      });
    }

    // Check 5: NULL source (shouldn't happen with default)
    if (event.source === null) {
      warnings.push({
        id: event.id,
        title: event.title,
        issue: `source is NULL (should have a default value)`,
      });
    }
  }

  // Print source distribution
  console.log("SOURCE DISTRIBUTION:");
  console.log("─".repeat(40));
  for (const [source, count] of Object.entries(sourceGroups).sort((a, b) => b[1] - a[1])) {
    const bar = "█".repeat(Math.min(count, 30));
    console.log(`  ${source.padEnd(12)} ${count.toString().padStart(4)} ${bar}`);
  }
  console.log("");

  // Print violations
  if (violations.length > 0) {
    console.log("❌ VIOLATIONS (must fix):");
    console.log("─".repeat(60));
    for (const v of violations) {
      console.log(`  ${v.title}`);
      console.log(`    ID: ${v.id}`);
      console.log(`    Issue: ${v.issue}`);
      console.log("");
    }
  } else {
    console.log("✅ No violations found\n");
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log("⚠️  WARNINGS (review recommended):");
    console.log("─".repeat(60));
    for (const w of warnings) {
      console.log(`  ${w.title}`);
      console.log(`    ID: ${w.id}`);
      console.log(`    Issue: ${w.issue}`);
      console.log("");
    }
  } else {
    console.log("✅ No warnings\n");
  }

  // Summary
  console.log("═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  console.log(`Total events:  ${typedEvents.length}`);
  console.log(`Violations:    ${violations.length}`);
  console.log(`Warnings:      ${warnings.length}`);
  console.log("");

  if (violations.length > 0) {
    console.log("⚠️  Action required: Fix violations before proceeding");
    process.exit(1);
  }

  console.log("✅ Audit complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
