import { describe, expect, it } from "vitest";
import {
  computePatchDiff,
  hasEnforcedChange,
  type ArrayFieldChange,
  type ScalarFieldChange,
} from "@/lib/events/computePatchDiff";
import { PATCH_FIELD_REGISTRY } from "@/lib/events/patchFieldRegistry";

describe("computePatchDiff", () => {
  describe("empty / no-op patches", () => {
    it("returns an empty diff when the patch is {}", () => {
      const diff = computePatchDiff({ title: "First Friday" }, {});
      expect(diff.changedFields).toEqual([]);
      expect(diff.unchangedFields).toEqual([]);
      expect(diff.unknownFields).toEqual([]);
      expect(diff.outOfScopeFields).toEqual([]);
      expect(diff.summary).toEqual({
        high_risk_changes: 0,
        medium_risk_changes: 0,
        low_risk_changes: 0,
        enforced_changes: 0,
        shadow_changes: 0,
      });
    });

    it("preserves fields that are absent from the patch (plan §5.4)", () => {
      const diff = computePatchDiff(
        { title: "First Friday", description: "Original" },
        { description: "Original" },
      );
      // Only description is in the patch; title is preserved without
      // being marked as a change or being listed as unchanged.
      expect(diff.changedFields).toEqual([]);
      expect(diff.unchangedFields).toEqual(["description"]);
    });
  });

  describe("scalar fields", () => {
    it("detects a simple scalar change with the registry classification snapshot", () => {
      const diff = computePatchDiff(
        { event_date: "2026-05-01" },
        { event_date: "2026-05-08" },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ScalarFieldChange;
      expect(change.kind).toBe("scalar");
      expect(change.field).toBe("event_date");
      expect(change.before).toBe("2026-05-01");
      expect(change.after).toBe("2026-05-08");
      expect(change.risk_tier).toBe(PATCH_FIELD_REGISTRY.event_date.risk_tier);
      expect(change.enforcement_mode).toBe(
        PATCH_FIELD_REGISTRY.event_date.enforcement_mode,
      );
      expect(change.scope).toBe(PATCH_FIELD_REGISTRY.event_date.scope);
    });

    it("treats null, undefined, and empty string as equivalent (no change)", () => {
      const cases = [
        { current: null, patch: undefined },
        { current: null, patch: "" },
        { current: "", patch: null },
        { current: undefined, patch: "" },
      ];
      for (const { current, patch } of cases) {
        const diff = computePatchDiff(
          { description: current as string | null },
          { description: patch as string | null },
        );
        expect(diff.changedFields, JSON.stringify({ current, patch })).toEqual([]);
      }
    });

    it("trims whitespace before comparing strings", () => {
      const diff = computePatchDiff(
        { title: "First Friday" },
        { title: "  First Friday  " },
      );
      expect(diff.changedFields).toEqual([]);
      expect(diff.unchangedFields).toEqual(["title"]);
    });

    it("treats clearing a value as a change from string to null", () => {
      const diff = computePatchDiff(
        { description: "Old text" },
        { description: "" },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ScalarFieldChange;
      expect(change.before).toBe("Old text");
      expect(change.after).toBeNull();
    });

    it("detects boolean changes", () => {
      const diff = computePatchDiff(
        { is_published: false },
        { is_published: true },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ScalarFieldChange;
      expect(change.before).toBe(false);
      expect(change.after).toBe(true);
    });

    it("detects numeric changes and normalizes non-finite values to null", () => {
      const diff = computePatchDiff(
        { capacity: 50 },
        { capacity: Number.NaN as unknown as number },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ScalarFieldChange;
      expect(change.before).toBe(50);
      expect(change.after).toBeNull();
    });
  });

  describe("array fields", () => {
    it("diffs by added/removed values, not positional order", () => {
      const diff = computePatchDiff(
        { event_type: ["open_mic", "song_circle"] },
        { event_type: ["song_circle", "open_mic"] },
      );
      expect(diff.changedFields).toEqual([]);
      expect(diff.unchangedFields).toEqual(["event_type"]);
    });

    it("reports added and removed entries separately", () => {
      const diff = computePatchDiff(
        { event_type: ["open_mic", "song_circle"] },
        { event_type: ["open_mic", "workshop"] },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ArrayFieldChange;
      expect(change.kind).toBe("array");
      expect(change.added).toEqual(["workshop"]);
      expect(change.removed).toEqual(["song_circle"]);
      expect(change.before).toEqual(["open_mic", "song_circle"]);
      expect(change.after).toEqual(["open_mic", "workshop"]);
    });

    it("dedupes both sides before comparing", () => {
      const diff = computePatchDiff(
        { event_type: ["open_mic", "open_mic"] },
        { event_type: ["open_mic"] },
      );
      expect(diff.changedFields).toEqual([]);
    });

    it("treats null / undefined / [] as equivalent empty arrays", () => {
      const cases = [
        { current: null, patch: [] as string[] },
        { current: undefined, patch: [] as string[] },
        { current: [] as string[], patch: null },
        { current: [] as string[], patch: undefined },
      ];
      for (const { current, patch } of cases) {
        const diff = computePatchDiff(
          { event_type: current as string[] | null },
          { event_type: patch as string[] | null },
        );
        expect(diff.changedFields, JSON.stringify({ current, patch })).toEqual([]);
      }
    });

    it("treats setting [] when current has values as removing all", () => {
      const diff = computePatchDiff(
        { event_type: ["open_mic"] },
        { event_type: [] },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ArrayFieldChange;
      expect(change.added).toEqual([]);
      expect(change.removed).toEqual(["open_mic"]);
      expect(change.after).toEqual([]);
    });

    it("strips empty strings and trims entries before comparing", () => {
      const diff = computePatchDiff(
        { categories: ["music", "  poetry  "] },
        { categories: ["", "music", "poetry"] },
      );
      expect(diff.changedFields).toEqual([]);
    });

    it("classifies custom_dates as an array field", () => {
      const diff = computePatchDiff(
        { custom_dates: ["2026-05-01"] },
        { custom_dates: ["2026-05-01", "2026-05-08"] },
      );
      expect(diff.changedFields).toHaveLength(1);
      const change = diff.changedFields[0] as ArrayFieldChange;
      expect(change.kind).toBe("array");
      expect(change.added).toEqual(["2026-05-08"]);
      expect(change.removed).toEqual([]);
    });
  });

  describe("unknown and unclassified fields", () => {
    it("surfaces UNCLASSIFIED_BY_DESIGN fields in unknownFields", () => {
      const diff = computePatchDiff(
        { id: "current-id" },
        // `id` is intentionally unclassified; AI patches must not touch it.
        { id: "spoofed-id" },
      );
      expect(diff.changedFields).toEqual([]);
      expect(diff.unknownFields).toContain("id");
    });

    it("surfaces names that are not events columns at all", () => {
      const diff = computePatchDiff(
        { title: "First Friday" },
        // Cast through unknown so the test can simulate a stray patch
        // field arriving from the model output.
        { not_a_real_field: "value" } as unknown as Parameters<typeof computePatchDiff>[1],
      );
      expect(diff.unknownFields).toContain("not_a_real_field");
    });

    it("treats system timestamps as unknown for AI patches", () => {
      const diff = computePatchDiff(
        { updated_at: "2026-04-01T00:00:00Z" },
        { updated_at: "2026-05-01T00:00:00Z" },
      );
      expect(diff.changedFields).toEqual([]);
      expect(diff.unknownFields).toContain("updated_at");
    });
  });

  describe("scope handling", () => {
    it("rejects series-only fields when target is occurrence", () => {
      const diff = computePatchDiff(
        { recurrence_rule: "weekly", title: "First Friday" },
        { recurrence_rule: "biweekly", title: "Second Friday" },
        { target: "occurrence" },
      );
      // recurrence_rule is series-only → out of scope
      expect(diff.outOfScopeFields).toContain("recurrence_rule");
      // title is series-scope but `MEDIUM_SHADOW("series")` so it is
      // also series-only.
      expect(diff.outOfScopeFields).toContain("title");
      // No series-only field should appear as a change at occurrence
      // scope.
      const changedNames = diff.changedFields.map((c) => c.field);
      expect(changedNames).not.toContain("recurrence_rule");
      expect(changedNames).not.toContain("title");
    });

    it("allows scope=both fields at occurrence target", () => {
      const diff = computePatchDiff(
        { event_date: "2026-05-01" },
        { event_date: "2026-05-08" },
        { target: "occurrence" },
      );
      expect(diff.changedFields).toHaveLength(1);
      expect(diff.changedFields[0].field).toBe("event_date");
      expect(diff.outOfScopeFields).toEqual([]);
    });

    it("allows series-only fields at series target", () => {
      const diff = computePatchDiff(
        { is_published: false },
        { is_published: true },
        { target: "series" },
      );
      expect(diff.changedFields).toHaveLength(1);
      expect(diff.outOfScopeFields).toEqual([]);
    });

    it("defaults target to series when not specified", () => {
      const diff = computePatchDiff(
        { recurrence_rule: "weekly" },
        { recurrence_rule: "biweekly" },
      );
      expect(diff.changedFields).toHaveLength(1);
    });
  });

  describe("summary counts", () => {
    it("counts changes by risk tier and enforcement mode", () => {
      const diff = computePatchDiff(
        {
          event_date: "2026-05-01",
          description: "Old",
          event_type: ["open_mic"],
        },
        {
          // event_date: high + enforced
          event_date: "2026-05-08",
          // description: low + shadow
          description: "New",
          // event_type: medium + shadow
          event_type: ["open_mic", "song_circle"],
        },
      );
      expect(diff.summary).toEqual({
        high_risk_changes: 1,
        medium_risk_changes: 1,
        low_risk_changes: 1,
        enforced_changes: 1,
        shadow_changes: 2,
      });
    });
  });

  describe("hasEnforcedChange", () => {
    it("returns true when at least one change is enforced", () => {
      const diff = computePatchDiff(
        { event_date: "2026-05-01" },
        { event_date: "2026-05-08" },
      );
      expect(hasEnforcedChange(diff)).toBe(true);
    });

    it("returns false when only shadow-mode changes are present", () => {
      const diff = computePatchDiff(
        { description: "Old" },
        { description: "New" },
      );
      expect(hasEnforcedChange(diff)).toBe(false);
    });

    it("returns false when there are no changes", () => {
      const diff = computePatchDiff({ description: "Same" }, { description: "Same" });
      expect(hasEnforcedChange(diff)).toBe(false);
    });
  });

  describe("input safety", () => {
    it("does not mutate the input patch or current", () => {
      const current = { event_type: ["open_mic"] };
      const patch = { event_type: ["song_circle", "open_mic"] };
      const currentSnapshot = JSON.stringify(current);
      const patchSnapshot = JSON.stringify(patch);
      computePatchDiff(current, patch);
      expect(JSON.stringify(current)).toBe(currentSnapshot);
      expect(JSON.stringify(patch)).toBe(patchSnapshot);
    });
  });
});
