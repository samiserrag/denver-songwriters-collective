/**
 * Phase ABC6 Backfill Script: Populate date_key for per-occurrence support
 *
 * USAGE:
 *   cd web && npx tsx scripts/abc6-backfill-date-keys.ts          # Dry-run (no writes)
 *   cd web && npx tsx scripts/abc6-backfill-date-keys.ts --apply  # Write mode
 *
 * PURPOSE:
 * Backfills date_key for all existing rows where it is NULL in:
 * - event_rsvps
 * - event_comments
 * - event_timeslots
 * - guest_verifications
 * - event_lineup_state (asserts 0 NULLs)
 *
 * DATE_KEY COMPUTATION:
 * - One-time event: use event_date
 * - Recurring event: compute next occurrence from NOW
 * - No computable date: use today and log
 *
 * SAFETY:
 * - Idempotent (safe to run multiple times)
 * - Only updates rows where date_key IS NULL
 * - Dry-run by default
 */

import * as dotenv from "dotenv";
import * as path from "path";
import pg from "pg";
import {
  computeNextOccurrence,
  getTodayDenver,
  addDaysDenver,
} from "../src/lib/events/nextOccurrence";
import { interpretRecurrence } from "../src/lib/events/recurrenceContract";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ============================================================================
// Configuration
// ============================================================================

const HARD_CEILING_DAYS = 730; // 2 years max for occurrence search

// ============================================================================
// Database Setup
// ============================================================================

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

// ============================================================================
// Types
// ============================================================================

interface EventRecord {
  id: string;
  event_date: string | null;
  day_of_week: string | null;
  recurrence_rule: string | null;
  is_recurring: boolean | null;
}

interface BackfillRow {
  id: string;
  event_id: string;
  date_key: string | null;
}

interface Anomaly {
  table: string;
  rowId: string;
  eventId: string;
  reason: string;
  eventSnapshot: {
    event_date: string | null;
    day_of_week: string | null;
    recurrence_rule: string | null;
    is_recurring: boolean | null;
  };
}

interface TableStats {
  totalRows: number;
  nullRows: number;
  updatedRows: number;
  sampleMappings: Array<{ rowId: string; eventId: string; dateKey: string }>;
  anomalies: Anomaly[];
}

// ============================================================================
// Event Cache
// ============================================================================

const eventCache = new Map<string, EventRecord | null>();

async function fetchEvent(eventId: string): Promise<EventRecord | null> {
  if (eventCache.has(eventId)) {
    return eventCache.get(eventId)!;
  }

  const result = await pool.query(
    `SELECT id, event_date::text, day_of_week, recurrence_rule, is_recurring
     FROM events WHERE id = $1`,
    [eventId]
  );

  if (result.rows.length === 0) {
    eventCache.set(eventId, null);
    return null;
  }

  const row = result.rows[0];
  // Ensure event_date is a string in YYYY-MM-DD format
  const event: EventRecord = {
    id: row.id,
    event_date: row.event_date ? row.event_date.substring(0, 10) : null,
    day_of_week: row.day_of_week,
    recurrence_rule: row.recurrence_rule,
    is_recurring: row.is_recurring,
  };
  eventCache.set(eventId, event);
  return event;
}

// ============================================================================
// Date Key Computation
// ============================================================================

/**
 * Compute date_key for a given event.
 * Uses the project's canonical occurrence logic with extended ceiling for backfill.
 */
function computeDateKeyForEvent(
  event: EventRecord,
  todayKey: string
): { dateKey: string; isConfident: boolean; reason?: string } {
  const recurrence = interpretRecurrence({
    event_date: event.event_date,
    day_of_week: event.day_of_week,
    recurrence_rule: event.recurrence_rule,
  });

  // Case 1: One-time event with event_date
  if (!recurrence.isRecurring && event.event_date) {
    return { dateKey: event.event_date, isConfident: true };
  }

  // Case 2: Recurring event - compute next occurrence
  if (recurrence.isRecurring && recurrence.isConfident) {
    const result = computeNextOccurrence(
      {
        event_date: event.event_date,
        day_of_week: event.day_of_week,
        recurrence_rule: event.recurrence_rule,
      },
      { todayKey }
    );

    if (result.isConfident) {
      return { dateKey: result.date, isConfident: true };
    }
  }

  // Case 3: Try expanding with extended window (up to HARD_CEILING_DAYS)
  // This handles events that might not have an occurrence in the default 90-day window
  if (event.day_of_week || event.recurrence_rule) {
    const endKey = addDaysDenver(todayKey, HARD_CEILING_DAYS);
    const result = computeNextOccurrence(
      {
        event_date: event.event_date,
        day_of_week: event.day_of_week,
        recurrence_rule: event.recurrence_rule,
      },
      { todayKey }
    );

    // Check if the computed date is within our ceiling
    if (result.date <= endKey) {
      return {
        dateKey: result.date,
        isConfident: result.isConfident,
        reason: result.isConfident ? undefined : "low-confidence-computed",
      };
    }

    // Hit ceiling - use today with warning
    return {
      dateKey: todayKey,
      isConfident: false,
      reason: `hit-${HARD_CEILING_DAYS}-day-ceiling`,
    };
  }

  // Case 4: Fallback - use today
  return {
    dateKey: todayKey,
    isConfident: false,
    reason: "no-computable-date",
  };
}

// ============================================================================
// Table Processing
// ============================================================================

async function processTable(
  tableName: string,
  applyMode: boolean,
  todayKey: string
): Promise<TableStats> {
  const stats: TableStats = {
    totalRows: 0,
    nullRows: 0,
    updatedRows: 0,
    sampleMappings: [],
    anomalies: [],
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${tableName}`);
  console.log("=".repeat(60));

  // Count total rows
  const totalResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
  stats.totalRows = parseInt(totalResult.rows[0].count, 10);

  // Get rows with NULL date_key
  const nullResult = await pool.query(
    `SELECT id, event_id, date_key FROM ${tableName} WHERE date_key IS NULL`
  );
  const nullRows = nullResult.rows as BackfillRow[];

  stats.nullRows = nullRows.length;
  console.log(`  Total rows: ${stats.totalRows}`);
  console.log(`  Rows with NULL date_key: ${stats.nullRows}`);

  if (nullRows.length === 0) {
    console.log(`  ✓ No rows need backfill`);
    return stats;
  }

  // Process each row
  const updates: Array<{ id: string; date_key: string }> = [];

  for (const row of nullRows) {
    const event = await fetchEvent(row.event_id);

    if (!event) {
      // Event not found - use today
      const dateKey = todayKey;
      updates.push({ id: row.id, date_key: dateKey });
      stats.anomalies.push({
        table: tableName,
        rowId: row.id,
        eventId: row.event_id,
        reason: "event-not-found",
        eventSnapshot: {
          event_date: null,
          day_of_week: null,
          recurrence_rule: null,
          is_recurring: null,
        },
      });
      continue;
    }

    const computed = computeDateKeyForEvent(event, todayKey);
    updates.push({ id: row.id, date_key: computed.dateKey });

    // Track samples (first 5)
    if (stats.sampleMappings.length < 5) {
      stats.sampleMappings.push({
        rowId: row.id,
        eventId: row.event_id,
        dateKey: computed.dateKey,
      });
    }

    // Track anomalies
    if (!computed.isConfident || computed.reason) {
      stats.anomalies.push({
        table: tableName,
        rowId: row.id,
        eventId: row.event_id,
        reason: computed.reason ?? "low-confidence",
        eventSnapshot: {
          event_date: event.event_date,
          day_of_week: event.day_of_week,
          recurrence_rule: event.recurrence_rule,
          is_recurring: event.is_recurring,
        },
      });
    }
  }

  // Print sample mappings
  console.log(`\n  Sample mappings (up to 5):`);
  for (const sample of stats.sampleMappings) {
    console.log(`    ${sample.rowId.slice(0, 8)}... -> ${sample.dateKey} (event: ${sample.eventId.slice(0, 8)}...)`);
  }

  // Print anomaly count
  if (stats.anomalies.length > 0) {
    console.log(`\n  ⚠ Anomalies: ${stats.anomalies.length}`);
    for (const anomaly of stats.anomalies.slice(0, 3)) {
      console.log(`    - ${anomaly.rowId.slice(0, 8)}...: ${anomaly.reason}`);
    }
    if (stats.anomalies.length > 3) {
      console.log(`    ... and ${stats.anomalies.length - 3} more`);
    }
  }

  // Apply updates if in write mode
  if (applyMode && updates.length > 0) {
    console.log(`\n  Applying ${updates.length} updates...`);

    let successCount = 0;
    for (const update of updates) {
      try {
        await pool.query(
          `UPDATE ${tableName} SET date_key = $1 WHERE id = $2`,
          [update.date_key, update.id]
        );
        successCount++;
      } catch (err) {
        console.error(`    Error updating ${update.id}:`, err);
      }
    }
    stats.updatedRows = successCount;
    console.log(`  ✓ Updated ${successCount} rows`);

    // Verify remaining NULLs
    const remainingResult = await pool.query(
      `SELECT COUNT(*) FROM ${tableName} WHERE date_key IS NULL`
    );
    const remainingNulls = parseInt(remainingResult.rows[0].count, 10);

    console.log(`  Remaining NULL count: ${remainingNulls}`);
    if (remainingNulls > 0) {
      console.error(`  ✗ STOP-GATE VIOLATION: ${remainingNulls} rows still have NULL date_key!`);
    }
  } else if (!applyMode) {
    console.log(`\n  [DRY-RUN] Would update ${updates.length} rows`);
  }

  return stats;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes("--apply");

  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  Phase ABC6: Backfill date_key for Per-Occurrence Support     ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`Mode: ${applyMode ? "APPLY (writing to database)" : "DRY-RUN (no writes)"}`);
  if (!applyMode) {
    console.log("       Run with --apply to perform updates");
  }

  const todayKey = getTodayDenver();
  console.log(`Today (Denver): ${todayKey}`);

  const tables = [
    "event_rsvps",
    "event_comments",
    "event_timeslots",
    "guest_verifications",
  ];

  const allStats: Map<string, TableStats> = new Map();
  const allAnomalies: Anomaly[] = [];

  // Process each table
  for (const table of tables) {
    const stats = await processTable(table, applyMode, todayKey);
    allStats.set(table, stats);
    allAnomalies.push(...stats.anomalies);
  }

  // Special handling for event_lineup_state (assert 0 NULLs)
  console.log(`\n${"=".repeat(60)}`);
  console.log("Checking: event_lineup_state");
  console.log("=".repeat(60));

  const lineupResult = await pool.query(
    `SELECT COUNT(*) FROM event_lineup_state WHERE date_key IS NULL`
  );
  const lineupNullCount = parseInt(lineupResult.rows[0].count, 10);

  console.log(`  Rows with NULL date_key: ${lineupNullCount}`);
  if (lineupNullCount > 0) {
    console.error(`  ✗ UNEXPECTED: event_lineup_state has ${lineupNullCount} rows with NULL date_key`);
    console.error(`    (Expected 0 based on investigation - table had 0 rows)`);
  } else {
    console.log(`  ✓ event_lineup_state has no NULL date_key rows (as expected)`);
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));

  console.log("\nPer-table stats:");
  let totalNull = 0;
  let totalUpdated = 0;
  for (const [table, stats] of allStats) {
    console.log(`  ${table}:`);
    console.log(`    Total: ${stats.totalRows}, NULL: ${stats.nullRows}, Updated: ${stats.updatedRows}`);
    totalNull += stats.nullRows;
    totalUpdated += stats.updatedRows;
  }

  console.log(`\nTotals:`);
  console.log(`  Rows needing backfill: ${totalNull}`);
  if (applyMode) {
    console.log(`  Rows updated: ${totalUpdated}`);
  }
  console.log(`  Anomalies: ${allAnomalies.length}`);

  // Print all anomalies if any
  if (allAnomalies.length > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("ANOMALY LOG");
    console.log("=".repeat(60));
    for (const anomaly of allAnomalies) {
      console.log(`\n  Table: ${anomaly.table}`);
      console.log(`  Row ID: ${anomaly.rowId}`);
      console.log(`  Event ID: ${anomaly.eventId}`);
      console.log(`  Reason: ${anomaly.reason}`);
      console.log(`  Event snapshot:`);
      console.log(`    event_date: ${anomaly.eventSnapshot.event_date}`);
      console.log(`    day_of_week: ${anomaly.eventSnapshot.day_of_week}`);
      console.log(`    recurrence_rule: ${anomaly.eventSnapshot.recurrence_rule}`);
      console.log(`    is_recurring: ${anomaly.eventSnapshot.is_recurring}`);
    }
  }

  // Final verification if in apply mode
  if (applyMode) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("VERIFICATION QUERIES");
    console.log("=".repeat(60));

    const verifyTables = [
      "event_rsvps",
      "event_comments",
      "event_timeslots",
      "guest_verifications",
      "event_lineup_state",
    ];

    let hasViolations = false;
    for (const table of verifyTables) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM ${table} WHERE date_key IS NULL`
      );
      const count = parseInt(result.rows[0].count, 10);

      const status = count === 0 ? "✓" : "✗";
      console.log(`  ${status} ${table}: ${count} NULL date_key rows`);
      if (count > 0) {
        hasViolations = true;
      }
    }

    if (hasViolations) {
      console.log(`\n✗ STOP-GATE C VIOLATION: Some tables still have NULL date_key!`);
      console.log(`  Do NOT proceed to Migration 3.`);
      process.exit(1);
    } else {
      console.log(`\n✓ STOP-GATE C PASSED: All tables have 0 NULL date_key rows.`);
      console.log(`  Safe to proceed to Migration 3.`);
    }
  }

  console.log("\nDone.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await pool.end();
  process.exit(1);
});
