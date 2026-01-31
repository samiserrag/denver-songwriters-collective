// Test canonical recurrence functions with our candidate events

import { interpretRecurrence, labelFromRecurrence } from './src/lib/events/recurrenceContract';
import { expandOccurrencesForEvent, getTodayDenver, addDaysDenver } from './src/lib/events/nextOccurrence';

const today = getTodayDenver();
const endKey = addDaysDenver(today, 90);

console.log("=== TODAY:", today, "===\n");

// Bug #1 candidate: Lone Tree Open Mic
// recurrence_rule = '4th', day_of_week = NULL, event_date = '2026-01-24'
const loneTree = {
  event_date: '2026-01-24',
  day_of_week: null,
  recurrence_rule: '4th',
};

console.log("--- LONE TREE OPEN MIC (Bug #1 candidate) ---");
console.log("DB Fields:", JSON.stringify(loneTree, null, 2));
const loneTreeRec = interpretRecurrence(loneTree);
console.log("\nInterpretation:", JSON.stringify(loneTreeRec, null, 2));
console.log("Label:", labelFromRecurrence(loneTreeRec));
const loneTreeOccurrences = expandOccurrencesForEvent(loneTree, { startKey: today, endKey });
console.log("Occurrences (next 10):", loneTreeOccurrences.slice(0, 10).map(o => o.dateKey));
console.log("");

// What day is Jan 24, 2026?
const jan24 = new Date('2026-01-24T12:00:00Z');
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
console.log("Jan 24, 2026 is a:", dayNames[jan24.getUTCDay()]);
console.log("");

// Test with day_of_week set correctly (Saturday)
const loneTreeCorrect = {
  event_date: '2026-01-24',
  day_of_week: 'Saturday',
  recurrence_rule: '4th',
};

console.log("--- LONE TREE (if day_of_week was 'Saturday') ---");
const loneTreeCorrectRec = interpretRecurrence(loneTreeCorrect);
console.log("Label:", labelFromRecurrence(loneTreeCorrectRec));
const loneTreeCorrectOcc = expandOccurrencesForEvent(loneTreeCorrect, { startKey: today, endKey });
console.log("Occurrences (next 10):", loneTreeCorrectOcc.slice(0, 10).map(o => o.dateKey));
console.log("");

// Bug #3 candidate: Royal Kumete Kava (weekly Saturday)
// Should appear today (Jan 24 is a Saturday)
const royalKumete = {
  event_date: null,
  day_of_week: 'Saturday',
  recurrence_rule: 'weekly',
};

console.log("--- ROYAL KUMETE KAVA (weekly Saturday) ---");
console.log("DB Fields:", JSON.stringify(royalKumete, null, 2));
const royalRec = interpretRecurrence(royalKumete);
console.log("\nInterpretation:", JSON.stringify(royalRec, null, 2));
console.log("Label:", labelFromRecurrence(royalRec));
const royalOccurrences = expandOccurrencesForEvent(royalKumete, { startKey: today, endKey });
console.log("Occurrences (next 10):", royalOccurrences.slice(0, 10).map(o => o.dateKey));
console.log("TODAY (", today, ") in occurrences?", royalOccurrences.some(o => o.dateKey === today));

