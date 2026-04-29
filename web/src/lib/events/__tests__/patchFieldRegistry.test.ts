import { describe, expect, it } from "vitest";
import {
  DAY_ONE_ENFORCED_HIGH_RISK_FIELDS,
  EVENTS_COLUMN_NAMES,
  PATCH_FIELD_REGISTRY,
  UNCLASSIFIED_BY_DESIGN,
  getPatchFieldClassification,
  type EventsColumn,
} from "@/lib/events/patchFieldRegistry";

describe("patchFieldRegistry", () => {
  const registryKeys = new Set(Object.keys(PATCH_FIELD_REGISTRY) as EventsColumn[]);
  const unclassifiedKeys = new Set(Object.keys(UNCLASSIFIED_BY_DESIGN) as EventsColumn[]);

  it("classifies every events column or lists it in UNCLASSIFIED_BY_DESIGN", () => {
    const missing: EventsColumn[] = [];
    for (const column of EVENTS_COLUMN_NAMES) {
      const isClassified = registryKeys.has(column);
      const isUnclassifiedByDesign = unclassifiedKeys.has(column);
      if (!isClassified && !isUnclassifiedByDesign) {
        missing.push(column);
      }
    }
    expect(missing).toEqual([]);
  });

  it("does not classify and unclassify the same column", () => {
    const overlap = [...registryKeys].filter((key) => unclassifiedKeys.has(key));
    expect(overlap).toEqual([]);
  });

  it("only references real events columns", () => {
    const known = new Set<string>(EVENTS_COLUMN_NAMES);
    const stray = [...registryKeys, ...unclassifiedKeys].filter((key) => !known.has(key));
    expect(stray).toEqual([]);
  });

  it("requires a non-empty justification for every UNCLASSIFIED_BY_DESIGN entry", () => {
    const missingJustification = Object.entries(UNCLASSIFIED_BY_DESIGN)
      .filter(([, value]) => typeof value !== "string" || value.trim().length === 0)
      .map(([key]) => key);
    expect(missingJustification).toEqual([]);
  });

  it("requires every registry entry to declare scope and value_kind", () => {
    const allowedScopes = new Set(["series", "occurrence", "both"]);
    const allowedValueKinds = new Set(["scalar", "array"]);
    const allowedRiskTiers = new Set(["low", "medium", "high"]);
    const allowedEnforcement = new Set(["enforced", "shadow"]);

    for (const [field, classification] of Object.entries(PATCH_FIELD_REGISTRY)) {
      expect(allowedRiskTiers.has(classification.risk_tier), `${field} risk_tier`).toBe(true);
      expect(
        allowedEnforcement.has(classification.enforcement_mode),
        `${field} enforcement_mode`,
      ).toBe(true);
      expect(allowedScopes.has(classification.scope), `${field} scope`).toBe(true);
      expect(allowedValueKinds.has(classification.value_kind), `${field} value_kind`).toBe(true);
      expect(typeof classification.verifier_auto_patchable, `${field} verifier_auto_patchable`).toBe(
        "boolean",
      );
    }
  });

  it("marks every day-one enforced high-risk field as enforced + high", () => {
    for (const field of DAY_ONE_ENFORCED_HIGH_RISK_FIELDS) {
      const classification = PATCH_FIELD_REGISTRY[field];
      expect(classification, `${field} must be classified`).toBeDefined();
      expect(classification.risk_tier, `${field} risk_tier`).toBe("high");
      expect(classification.enforcement_mode, `${field} enforcement_mode`).toBe("enforced");
      // Day-one enforced high-risk fields cannot be silently auto-patched
      // by the verifier; user confirmation must be required.
      expect(
        classification.verifier_auto_patchable,
        `${field} must not be verifier_auto_patchable on day one`,
      ).toBe(false);
    }
  });

  it("forbids auto-patching on any high-risk enforced field", () => {
    const offenders: string[] = [];
    for (const [field, classification] of Object.entries(PATCH_FIELD_REGISTRY)) {
      if (
        classification.risk_tier === "high" &&
        classification.enforcement_mode === "enforced" &&
        classification.verifier_auto_patchable
      ) {
        offenders.push(field);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses the array value_kind for known array columns", () => {
    const arrayColumns: EventsColumn[] = ["categories", "custom_dates", "event_type"];
    for (const column of arrayColumns) {
      const classification = PATCH_FIELD_REGISTRY[column as keyof typeof PATCH_FIELD_REGISTRY];
      expect(classification, `${column} must be classified`).toBeDefined();
      expect(classification.value_kind, `${column} value_kind`).toBe("array");
    }
  });

  it("returns the classification via the lookup helper", () => {
    expect(getPatchFieldClassification("event_date")).toEqual(
      PATCH_FIELD_REGISTRY.event_date,
    );
  });

  it("returns undefined from the lookup helper for unclassified columns", () => {
    // `id` is intentionally not patchable; the helper must return
    // undefined so callers fall back to high-risk + enforced defaults.
    expect(getPatchFieldClassification("id")).toBeUndefined();
  });
});
