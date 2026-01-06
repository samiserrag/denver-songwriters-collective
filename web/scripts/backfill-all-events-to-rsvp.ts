#!/usr/bin/env npx tsx
/**
 * Phase 4.43: Backfill All Events to RSVP Mode
 *
 * This script converts seeded/imported events to RSVP mode by:
 * 1. Setting has_timeslots = false
 * 2. Setting total_slots = null
 * 3. Setting slot_duration_minutes = null
 * 4. Setting allow_guest_slots = false
 * 5. Deleting event_timeslots rows (only if no claims exist)
 *
 * SAFETY GATES:
 * - Events with timeslot_claims are SKIPPED (never modified)
 * - Dry-run mode by default (no actual changes)
 * - Requires explicit --apply flag to make changes
 *
 * Usage:
 *   npx tsx scripts/backfill-all-events-to-rsvp.ts          # Dry run
 *   npx tsx scripts/backfill-all-events-to-rsvp.ts --apply  # Apply changes
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

interface EventRow {
  id: string;
  title: string;
  has_timeslots: boolean | null;
  total_slots: number | null;
  slot_duration_minutes: number | null;
  allow_guest_slots: boolean | null;
  source: string | null;
}

interface TimeslotRow {
  id: string;
  event_id: string;
}

interface ClaimRow {
  id: string;
  timeslot_id: string;
}

async function main() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes("--apply");

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Phase 4.43: Backfill All Events to RSVP Mode              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  if (applyChanges) {
    console.log("⚠️  MODE: APPLY CHANGES (this will modify the database)");
  } else {
    console.log("ℹ️  MODE: DRY RUN (no changes will be made)");
    console.log("   Run with --apply to make actual changes");
  }
  console.log("");

  // Fetch all events with timeslot configuration
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, has_timeslots, total_slots, slot_duration_minutes, allow_guest_slots, source")
    .eq("has_timeslots", true)
    .order("created_at", { ascending: true });

  if (eventsError) {
    console.error("❌ Error fetching events:", eventsError.message);
    process.exit(1);
  }

  const typedEvents = events as EventRow[];
  console.log(`📊 Found ${typedEvents.length} events with has_timeslots=true\n`);

  let scannedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const skippedReasons: { id: string; title: string; reason: string }[] = [];

  for (const event of typedEvents) {
    scannedCount++;

    // Fetch timeslots for this event
    const { data: timeslots, error: timeslotsError } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", event.id);

    if (timeslotsError) {
      console.error(`❌ Error fetching timeslots for event ${event.id}:`, timeslotsError.message);
      skippedCount++;
      skippedReasons.push({ id: event.id, title: event.title, reason: "Error fetching timeslots" });
      continue;
    }

    const typedTimeslots = (timeslots || []) as TimeslotRow[];

    // Check for claims on any timeslot
    let hasClaimsFlag = false;
    if (typedTimeslots.length > 0) {
      const slotIds = typedTimeslots.map((s) => s.id);
      const { data: claims, error: claimsError } = await supabase
        .from("timeslot_claims")
        .select("id")
        .in("timeslot_id", slotIds)
        .limit(1);

      if (claimsError) {
        console.error(`❌ Error fetching claims for event ${event.id}:`, claimsError.message);
        skippedCount++;
        skippedReasons.push({ id: event.id, title: event.title, reason: "Error fetching claims" });
        continue;
      }

      const typedClaims = (claims || []) as ClaimRow[];
      hasClaimsFlag = typedClaims.length > 0;
    }

    // SAFETY GATE: Skip events with claims
    if (hasClaimsFlag) {
      console.log(`⏭️  SKIP: "${event.title}" (${event.id})`);
      console.log(`   Reason: Event has timeslot claims - cannot modify\n`);
      skippedCount++;
      skippedReasons.push({ id: event.id, title: event.title, reason: "Has timeslot claims" });
      continue;
    }

    // Event is safe to update
    console.log(`✅ WILL UPDATE: "${event.title}" (${event.id})`);
    console.log(`   Source: ${event.source || "null"}`);
    console.log(`   Current: has_timeslots=${event.has_timeslots}, total_slots=${event.total_slots}`);
    console.log(`   Timeslots to delete: ${typedTimeslots.length}`);

    if (applyChanges) {
      // Update the event
      const { error: updateError } = await supabase
        .from("events")
        .update({
          has_timeslots: false,
          total_slots: null,
          slot_duration_minutes: null,
          allow_guest_slots: false,
        })
        .eq("id", event.id);

      if (updateError) {
        console.error(`   ❌ Error updating event: ${updateError.message}\n`);
        skippedCount++;
        skippedReasons.push({ id: event.id, title: event.title, reason: `Update error: ${updateError.message}` });
        continue;
      }

      // Delete timeslots (safe because no claims)
      if (typedTimeslots.length > 0) {
        const { error: deleteError } = await supabase
          .from("event_timeslots")
          .delete()
          .eq("event_id", event.id);

        if (deleteError) {
          console.error(`   ⚠️  Warning: Could not delete timeslots: ${deleteError.message}`);
        } else {
          console.log(`   🗑️  Deleted ${typedTimeslots.length} timeslots`);
        }
      }

      console.log(`   ✅ Updated successfully\n`);
    } else {
      console.log(`   [DRY RUN - no changes made]\n`);
    }

    updatedCount++;
  }

  // Summary
  console.log("═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  console.log(`Events scanned:  ${scannedCount}`);
  console.log(`Events updated:  ${updatedCount}${applyChanges ? "" : " (dry run)"}`);
  console.log(`Events skipped:  ${skippedCount}`);
  console.log("");

  if (skippedReasons.length > 0) {
    console.log("SKIPPED EVENTS:");
    for (const skip of skippedReasons) {
      console.log(`  - ${skip.title} (${skip.id}): ${skip.reason}`);
    }
    console.log("");
  }

  if (!applyChanges && updatedCount > 0) {
    console.log("ℹ️  To apply these changes, run:");
    console.log("   npx tsx scripts/backfill-all-events-to-rsvp.ts --apply");
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
