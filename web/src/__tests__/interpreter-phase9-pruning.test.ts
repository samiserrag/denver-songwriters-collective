/**
 * Phase 9C — Interpreter clarification turn reduction tests.
 *
 * Source-code assertion tests verifying:
 * 1. isBlockingFieldSatisfied handles all new explicit cases.
 * 2. Default case remains conservative (return false).
 * 3. Pipeline ordering preserved.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const POSTPROCESS_PATH = path.resolve(
  __dirname,
  "../lib/events/interpreterPostprocess.ts"
);
const postprocessSource = fs.readFileSync(POSTPROCESS_PATH, "utf-8");

const INTERPRET_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/interpret/route.ts"
);
const interpretRouteSource = fs.readFileSync(INTERPRET_ROUTE_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) isBlockingFieldSatisfied — new explicit cases
// ---------------------------------------------------------------------------
describe("Phase 9C — isBlockingFieldSatisfied explicit cases", () => {
  const fnStart = postprocessSource.indexOf("isBlockingFieldSatisfied");
  const fnSection = postprocessSource.slice(fnStart, postprocessSource.indexOf("}", fnStart + 500) + 100);

  it("handles description", () => {
    expect(fnSection).toContain('case "description"');
  });

  it("handles signup_mode", () => {
    expect(fnSection).toContain('case "signup_mode"');
  });

  it("handles cost_label", () => {
    expect(fnSection).toContain('case "cost_label"');
  });

  it("handles is_free with boolean check", () => {
    expect(fnSection).toContain('case "is_free"');
    expect(fnSection).toMatch(/is_free\s*===\s*true\s*\|\|\s*.*is_free\s*===\s*false/);
  });

  it("handles day_of_week, recurrence_rule, location_mode, capacity", () => {
    expect(fnSection).toContain('case "day_of_week"');
    expect(fnSection).toContain('case "recurrence_rule"');
    expect(fnSection).toContain('case "location_mode"');
    expect(fnSection).toContain('case "capacity"');
  });
});

// ---------------------------------------------------------------------------
// B) Conservative default preserved
// ---------------------------------------------------------------------------
describe("Phase 9C — conservative default", () => {
  it("default case remains return false (no generic fallback)", () => {
    const fnStart = postprocessSource.indexOf("isBlockingFieldSatisfied");
    const fnEnd = postprocessSource.indexOf("\n}", fnStart);
    const fnSection = postprocessSource.slice(fnStart, fnEnd);
    expect(fnSection).toMatch(/default:\s*\n?\s*return false/);
  });
});

// ---------------------------------------------------------------------------
// C) Pipeline ordering
// ---------------------------------------------------------------------------
describe("Phase 9C — pipeline ordering", () => {
  it("pruneSatisfiedBlockingFields runs AFTER mergeLockedCreateDraft in route.ts", () => {
    const mergeIdx = interpretRouteSource.indexOf("mergeLockedCreateDraft");
    const pruneIdx = interpretRouteSource.indexOf("pruneSatisfiedBlockingFields");
    expect(mergeIdx).toBeGreaterThan(0);
    expect(pruneIdx).toBeGreaterThan(0);
    expect(pruneIdx).toBeGreaterThan(mergeIdx);
  });

  it("pruneOptionalBlockingFields still only prunes end_time (no accidental expansion)", () => {
    const fnStart = postprocessSource.indexOf("pruneOptionalBlockingFields");
    const fnSection = postprocessSource.slice(fnStart, fnStart + 600);
    expect(fnSection).toContain("end_time");
    // Should not contain other field names in this function
    expect(fnSection).not.toContain("description");
    expect(fnSection).not.toContain("cost_label");
  });
});
