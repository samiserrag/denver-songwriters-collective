/**
 * Reset Event Verification Script
 *
 * Phase 4.40: One-time admin utility to clear all verification fields.
 *
 * This script sets last_verified_at and verified_by to NULL for all events,
 * making them all show as "Unconfirmed" until an admin explicitly verifies each one.
 *
 * IMPORTANT: This is a destructive operation. Run only once on prod after
 * deploying Phase 4.40 verification logic changes.
 *
 * Usage:
 *   cd web && npx tsx scripts/reset-event-verification.ts
 *
 * After running:
 * - All events will show as "Unconfirmed"
 * - Admin can verify events one-by-one using the existing admin verification action
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function confirmAction(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\n⚠️  WARNING: This will clear last_verified_at and verified_by for ALL events.\n" +
      "All events will show as 'Unconfirmed' until manually verified.\n\n" +
      "Type 'RESET' to confirm: ",
      (answer) => {
        rl.close();
        resolve(answer === "RESET");
      }
    );
  });
}

async function resetVerification() {
  console.log("Phase 4.40: Reset Event Verification\n");
  console.log("========================================\n");

  // First, count how many events have verification set
  const { data: verifiedEvents, error: countError } = await supabase
    .from("events")
    .select("id, title, last_verified_at")
    .not("last_verified_at", "is", null);

  if (countError) {
    console.error("Error counting verified events:", countError);
    process.exit(1);
  }

  const verifiedCount = verifiedEvents?.length || 0;
  console.log(`Found ${verifiedCount} events with last_verified_at set.\n`);

  if (verifiedCount === 0) {
    console.log("No events have verification set. Nothing to reset.");
    return;
  }

  // Show which events will be affected
  console.log("Events that will be reset to Unconfirmed:\n");
  for (const event of verifiedEvents || []) {
    console.log(`  - ${event.title}`);
    console.log(`    ID: ${event.id}`);
    console.log(`    Last verified: ${event.last_verified_at}\n`);
  }

  // Confirm action
  const confirmed = await confirmAction();

  if (!confirmed) {
    console.log("\nOperation cancelled.");
    process.exit(0);
  }

  console.log("\nResetting verification fields...\n");

  // Perform the reset
  const { data, error } = await supabase
    .from("events")
    .update({
      last_verified_at: null,
      verified_by: null,
    })
    .not("last_verified_at", "is", null)
    .select("id");

  if (error) {
    console.error("Error resetting verification:", error);
    process.exit(1);
  }

  const resetCount = data?.length || 0;
  console.log(`✅ Successfully reset ${resetCount} events to Unconfirmed.\n`);
  console.log("All events now require admin verification to show as Confirmed.");
}

resetVerification().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
