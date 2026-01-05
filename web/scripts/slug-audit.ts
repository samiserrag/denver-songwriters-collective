/**
 * Slug Audit Utility
 *
 * Phase 4.39: Admin tool to identify slug issues in the database.
 *
 * Reports:
 * 1. Events with NULL slugs
 * 2. Profiles with NULL slugs
 * 3. Duplicate event slugs
 * 4. Duplicate profile slugs
 *
 * Usage:
 *   cd web && npx tsx scripts/slug-audit.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AuditResult {
  eventsWithNullSlug: { id: string; title: string; created_at: string | null }[];
  profilesWithNullSlug: { id: string; full_name: string | null; created_at: string | null }[];
  duplicateEventSlugs: { slug: string; count: number; ids: string[] }[];
  duplicateProfileSlugs: { slug: string; count: number; ids: string[] }[];
}

async function auditSlugs(): Promise<AuditResult> {
  console.log("Starting slug audit...\n");

  // 1. Find events with NULL slugs
  console.log("Checking for events with NULL slugs...");
  const { data: eventsNullSlug, error: eventsNullError } = await supabase
    .from("events")
    .select("id, title, created_at")
    .is("slug", null)
    .order("created_at", { ascending: false });

  if (eventsNullError) {
    console.error("Error fetching events with NULL slugs:", eventsNullError);
  }

  // 2. Find profiles with NULL slugs
  console.log("Checking for profiles with NULL slugs...");
  const { data: profilesNullSlug, error: profilesNullError } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .is("slug", null)
    .order("created_at", { ascending: false });

  if (profilesNullError) {
    console.error("Error fetching profiles with NULL slugs:", profilesNullError);
  }

  // 3. Find duplicate event slugs
  console.log("Checking for duplicate event slugs...");
  const { data: allEvents, error: allEventsError } = await supabase
    .from("events")
    .select("id, slug")
    .not("slug", "is", null);

  if (allEventsError) {
    console.error("Error fetching events for duplicate check:", allEventsError);
  }

  const eventSlugCounts: Record<string, string[]> = {};
  for (const event of allEvents || []) {
    if (event.slug) {
      if (!eventSlugCounts[event.slug]) {
        eventSlugCounts[event.slug] = [];
      }
      eventSlugCounts[event.slug].push(event.id);
    }
  }

  const duplicateEventSlugs = Object.entries(eventSlugCounts)
    .filter(([, ids]) => ids.length > 1)
    .map(([slug, ids]) => ({ slug, count: ids.length, ids }));

  // 4. Find duplicate profile slugs
  console.log("Checking for duplicate profile slugs...");
  const { data: allProfiles, error: allProfilesError } = await supabase
    .from("profiles")
    .select("id, slug")
    .not("slug", "is", null);

  if (allProfilesError) {
    console.error("Error fetching profiles for duplicate check:", allProfilesError);
  }

  const profileSlugCounts: Record<string, string[]> = {};
  for (const profile of allProfiles || []) {
    if (profile.slug) {
      if (!profileSlugCounts[profile.slug]) {
        profileSlugCounts[profile.slug] = [];
      }
      profileSlugCounts[profile.slug].push(profile.id);
    }
  }

  const duplicateProfileSlugs = Object.entries(profileSlugCounts)
    .filter(([, ids]) => ids.length > 1)
    .map(([slug, ids]) => ({ slug, count: ids.length, ids }));

  return {
    eventsWithNullSlug: eventsNullSlug || [],
    profilesWithNullSlug: profilesNullSlug || [],
    duplicateEventSlugs,
    duplicateProfileSlugs,
  };
}

function printReport(result: AuditResult) {
  console.log("\n========================================");
  console.log("            SLUG AUDIT REPORT");
  console.log("========================================\n");

  // Events with NULL slugs
  console.log("--- EVENTS WITH NULL SLUGS ---");
  if (result.eventsWithNullSlug.length === 0) {
    console.log("  None found. All events have slugs.\n");
  } else {
    console.log(`  Found ${result.eventsWithNullSlug.length} events without slugs:\n`);
    for (const event of result.eventsWithNullSlug) {
      console.log(`    - ${event.id}`);
      console.log(`      Title: ${event.title || "(no title)"}`);
      console.log(`      Created: ${event.created_at || "unknown"}`);
      console.log();
    }
  }

  // Profiles with NULL slugs
  console.log("--- PROFILES WITH NULL SLUGS ---");
  if (result.profilesWithNullSlug.length === 0) {
    console.log("  None found. All profiles have slugs.\n");
  } else {
    console.log(`  Found ${result.profilesWithNullSlug.length} profiles without slugs:\n`);
    for (const profile of result.profilesWithNullSlug) {
      console.log(`    - ${profile.id}`);
      console.log(`      Name: ${profile.full_name || "(no name)"}`);
      console.log(`      Created: ${profile.created_at || "unknown"}`);
      console.log();
    }
  }

  // Duplicate event slugs
  console.log("--- DUPLICATE EVENT SLUGS ---");
  if (result.duplicateEventSlugs.length === 0) {
    console.log("  None found. All event slugs are unique.\n");
  } else {
    console.log(`  Found ${result.duplicateEventSlugs.length} duplicate slugs:\n`);
    for (const dup of result.duplicateEventSlugs) {
      console.log(`    - "${dup.slug}" (${dup.count} occurrences)`);
      console.log(`      IDs: ${dup.ids.join(", ")}`);
      console.log();
    }
  }

  // Duplicate profile slugs
  console.log("--- DUPLICATE PROFILE SLUGS ---");
  if (result.duplicateProfileSlugs.length === 0) {
    console.log("  None found. All profile slugs are unique.\n");
  } else {
    console.log(`  Found ${result.duplicateProfileSlugs.length} duplicate slugs:\n`);
    for (const dup of result.duplicateProfileSlugs) {
      console.log(`    - "${dup.slug}" (${dup.count} occurrences)`);
      console.log(`      IDs: ${dup.ids.join(", ")}`);
      console.log();
    }
  }

  // Summary
  console.log("========================================");
  console.log("               SUMMARY");
  console.log("========================================");
  console.log(`  Events with NULL slugs:     ${result.eventsWithNullSlug.length}`);
  console.log(`  Profiles with NULL slugs:   ${result.profilesWithNullSlug.length}`);
  console.log(`  Duplicate event slugs:      ${result.duplicateEventSlugs.length}`);
  console.log(`  Duplicate profile slugs:    ${result.duplicateProfileSlugs.length}`);
  console.log();

  const totalIssues =
    result.eventsWithNullSlug.length +
    result.profilesWithNullSlug.length +
    result.duplicateEventSlugs.length +
    result.duplicateProfileSlugs.length;

  if (totalIssues === 0) {
    console.log("  All slugs are healthy.");
  } else {
    console.log(`  Total issues found: ${totalIssues}`);
  }
  console.log();
}

async function main() {
  try {
    const result = await auditSlugs();
    printReport(result);
  } catch (error) {
    console.error("Audit failed:", error);
    process.exit(1);
  }
}

main();
