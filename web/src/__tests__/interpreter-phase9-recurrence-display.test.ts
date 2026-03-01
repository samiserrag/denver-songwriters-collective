/**
 * Phase 9D — Interpreter recurrence humanization display tests.
 *
 * Source-code assertion tests verifying:
 * 1. ConversationalCreateUI imports humanizeRecurrence.
 * 2. CreatedEventSummary has dayOfWeek field.
 * 3. Post-create and draft summary call humanizeRecurrence.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LAB_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const labSource = fs.readFileSync(LAB_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) Import and interface
// ---------------------------------------------------------------------------
describe("Phase 9D — recurrence humanization setup", () => {
  it("imports humanizeRecurrence from recurrenceHumanizer", () => {
    expect(labSource).toContain('import { humanizeRecurrence } from "@/lib/recurrenceHumanizer"');
  });

  it("CreatedEventSummary has dayOfWeek field", () => {
    const interfaceStart = labSource.indexOf("interface CreatedEventSummary");
    const interfaceEnd = labSource.indexOf("}", interfaceStart);
    const interfaceSection = labSource.slice(interfaceStart, interfaceEnd);
    expect(interfaceSection).toContain("dayOfWeek: string | null");
  });

  it("buildCreatedEventSummary extracts day_of_week", () => {
    const fnStart = labSource.indexOf("function buildCreatedEventSummary");
    const fnEnd = labSource.indexOf("}", fnStart + 200);
    const fnSection = labSource.slice(fnStart, fnEnd);
    expect(fnSection).toContain("day_of_week");
  });
});

// ---------------------------------------------------------------------------
// B) Display sites
// ---------------------------------------------------------------------------
describe("Phase 9D — recurrence display humanization", () => {
  it("post-create summary calls humanizeRecurrence with recurrenceRule and dayOfWeek", () => {
    expect(labSource).toContain(
      "humanizeRecurrence(createdSummary.recurrenceRule, createdSummary.dayOfWeek)"
    );
  });

  it("draft summary calls humanizeRecurrence for recurrence display", () => {
    expect(labSource).toContain("humanizeRecurrence(typeof d.recurrence_rule");
  });

  it("draft summary uses typeof guard to avoid String(undefined) artifact", () => {
    // Should check typeof before passing to humanizeRecurrence
    expect(labSource).toContain('typeof d.recurrence_rule === "string"');
    expect(labSource).toContain('typeof d.day_of_week === "string"');
  });
});
