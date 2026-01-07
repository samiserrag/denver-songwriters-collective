/**
 * Test script to verify recurrence expansion for a specific event
 * Usage: cd web && npx tsx scripts/test-recurrence-expansion.ts
 */

import {
  getTodayDenver,
  addDaysDenver,
  expandOccurrencesForEvent,
  computeNextOccurrence,
} from "../src/lib/events/nextOccurrence";
import { humanizeRecurrence, getRecurrenceSummary } from "../src/lib/recurrenceHumanizer";

// The problematic event data from DB
const testEvent = {
  id: "42d7e4c6-49e9-4169-830e-040d6a911c62",
  title: "TEST TIME SLOT EVENT",
  event_date: "2026-01-06", // Tuesday
  day_of_week: "Monday", // Conflict!
  start_time: "19:00:00",
  end_time: "22:00:00",
  recurrence_rule: "weekly",
  timezone: "America/Denver",
};

console.log("=== Test Event Data ===");
console.log("event_date:", testEvent.event_date);
console.log("day_of_week:", testEvent.day_of_week);
console.log("recurrence_rule:", testEvent.recurrence_rule);
console.log("");

// Test 1: Check what day 2026-01-06 actually is
const eventDate = new Date(`${testEvent.event_date}T12:00:00`);
const actualDayName = eventDate.toLocaleDateString("en-US", {
  weekday: "long",
  timeZone: "America/Denver",
});
console.log("=== Weekday Verification ===");
console.log(`event_date ${testEvent.event_date} is actually a: ${actualDayName}`);
console.log(`day_of_week field says: ${testEvent.day_of_week}`);
console.log(`MISMATCH: ${actualDayName !== testEvent.day_of_week}`);
console.log("");

// Test 2: Label path (recurrenceHumanizer)
console.log("=== Label Path (recurrenceHumanizer) ===");
const label = humanizeRecurrence(testEvent.recurrence_rule, testEvent.day_of_week);
const summary = getRecurrenceSummary(testEvent.recurrence_rule, testEvent.day_of_week, testEvent.event_date);
console.log("humanizeRecurrence() →", label);
console.log("getRecurrenceSummary() →", summary);
console.log("");

// Test 3: Generator path (computeNextOccurrence)
console.log("=== Generator Path (computeNextOccurrence) ===");
const todayKey = getTodayDenver();
console.log("Today (Denver):", todayKey);
const nextOccurrence = computeNextOccurrence(
  {
    event_date: testEvent.event_date,
    day_of_week: testEvent.day_of_week,
    recurrence_rule: testEvent.recurrence_rule,
    start_time: testEvent.start_time,
  },
  todayKey
);
console.log("computeNextOccurrence() →", nextOccurrence);
console.log("");

// Test 4: Expansion path (expandOccurrencesForEvent)
console.log("=== Expansion Path (expandOccurrencesForEvent) ===");
const endKey = addDaysDenver(todayKey, 90);
console.log(`Window: ${todayKey} to ${endKey}`);
const occurrences = expandOccurrencesForEvent(
  {
    event_date: testEvent.event_date,
    day_of_week: testEvent.day_of_week,
    recurrence_rule: testEvent.recurrence_rule,
    start_time: testEvent.start_time,
  },
  { startKey: todayKey, endKey, maxOccurrences: 40 }
);
console.log(`Found ${occurrences.length} occurrences:`);
occurrences.forEach((occ, i) => {
  console.log(`  ${i + 1}. ${occ.dateKey} (confident: ${occ.isConfident})`);
});
console.log("");

// Test 5: What SHOULD happen (abstract pattern without event_date)
console.log("=== What SHOULD happen (weekly Monday) ===");
const correctOccurrences = expandOccurrencesForEvent(
  {
    event_date: null, // No concrete date - use abstract pattern
    day_of_week: "Monday",
    recurrence_rule: "weekly",
    start_time: testEvent.start_time,
  },
  { startKey: todayKey, endKey, maxOccurrences: 40 }
);
console.log(`Found ${correctOccurrences.length} Monday occurrences:`);
correctOccurrences.slice(0, 10).forEach((occ, i) => {
  console.log(`  ${i + 1}. ${occ.dateKey} (confident: ${occ.isConfident})`);
});
if (correctOccurrences.length > 10) {
  console.log(`  ... and ${correctOccurrences.length - 10} more`);
}
console.log("");

console.log("=== DIAGNOSIS ===");
console.log("Root Cause: When event_date is set, the generator short-circuits to");
console.log("return ONLY that date, ignoring day_of_week for expansion.");
console.log("");
console.log("The label uses day_of_week ('Monday') → 'Every Monday'");
console.log("The generator uses event_date ('2026-01-06') → single Tuesday");
console.log("");
console.log("FIX OPTIONS:");
console.log("1. Write-time validation (Phase 4.42): Reject if event_date weekday != day_of_week");
console.log("2. Clear event_date for abstract patterns (if day_of_week is authoritative)");
console.log("3. Fix this specific event by clearing event_date or fixing day_of_week");
