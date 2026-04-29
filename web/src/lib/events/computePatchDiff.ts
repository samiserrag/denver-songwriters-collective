/**
 * Server-side patch diff utility (Track 1, PR 2)
 *
 * Computes a structural, registry-aware diff between an event's current
 * state and a proposed patch from the AI edit/update flow.
 *
 * This module is pure-utility plumbing. PR 2 does not wire it into any
 * runtime call site. It is consumed by:
 *   - PR 9: published-event gate, to know which fields require
 *     confirmation before they are written
 *   - PR 11: "What changed" UI section, to render a trustworthy
 *     field-level diff
 *   - PR 3 (telemetry): to record the registry classification at
 *     decision time
 *
 * Design notes (per collaboration plan §6 PR 2):
 *   - Array fields (event_type, categories, custom_dates) diff by
 *     added/removed values, not positional order. Reordering alone is
 *     not a change.
 *   - Scalar normalization treats null / undefined / empty string as
 *     equivalent so the AI patch surface and the CSV ops surface
 *     (`lib/ops/eventDiff.ts`) agree on emptiness.
 *   - Patch fields outside the registry are surfaced in
 *     `unknownFields`; callers must treat unknowns as high-risk +
 *     enforced per plan §5.1. This utility does not silently drop
 *     them.
 *   - Occurrence-scope diffs reject patches that touch series-only
 *     fields (recurrence shape, publish state, identity); rejected
 *     fields are returned in `outOfScopeFields` and not included in
 *     `changedFields`.
 */

import type { Database } from "@/lib/supabase/database.types";
import {
  PATCH_FIELD_REGISTRY,
  UNCLASSIFIED_BY_DESIGN,
  type EventsColumn,
  type EnforcementMode,
  type PatchFieldClassification,
  type PatchFieldName,
  type PatchScope,
  type RiskTier,
} from "@/lib/events/patchFieldRegistry";

type EventsRow = Database["public"]["Tables"]["events"]["Row"];

export type EventPatch = Partial<EventsRow>;
export type EventState = Partial<EventsRow>;

export type ScalarValue = string | number | boolean | null;

export interface ScalarFieldChange {
  field: PatchFieldName;
  kind: "scalar";
  before: ScalarValue;
  after: ScalarValue;
  risk_tier: RiskTier;
  enforcement_mode: EnforcementMode;
  scope: PatchScope;
}

export interface ArrayFieldChange {
  field: PatchFieldName;
  kind: "array";
  before: string[];
  after: string[];
  added: string[];
  removed: string[];
  risk_tier: RiskTier;
  enforcement_mode: EnforcementMode;
  scope: PatchScope;
}

export type FieldChange = ScalarFieldChange | ArrayFieldChange;

export interface PatchDiffSummary {
  high_risk_changes: number;
  medium_risk_changes: number;
  low_risk_changes: number;
  enforced_changes: number;
  shadow_changes: number;
}

/**
 * `target` mirrors the `scope` discriminator on the AI edit response
 * (collaboration plan §5.3). The diff caller passes the resolved
 * target so this utility can reject series-only fields when the patch
 * applies to a single occurrence.
 */
export type PatchTarget = "series" | "occurrence";

export interface ComputePatchDiffOptions {
  target?: PatchTarget;
}

export interface PatchDiffResult {
  changedFields: FieldChange[];
  unchangedFields: PatchFieldName[];
  unknownFields: string[];
  outOfScopeFields: PatchFieldName[];
  summary: PatchDiffSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeScalar(value: unknown): ScalarValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  // Anything else (objects, dates, etc.) is not part of the events row
  // scalar shape; coerce to null rather than silently passing through.
  return null;
}

function normalizeArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return [];
  const cleaned: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed === "") continue;
    cleaned.push(trimmed);
  }
  // Dedupe while preserving first-seen order so diffs stay stable.
  return Array.from(new Set(cleaned));
}

function arraysEqualAsSets(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  for (const value of b) {
    if (!seen.has(value)) return false;
  }
  return true;
}

function diffArrays(
  before: readonly string[],
  after: readonly string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const value of after) {
    if (!beforeSet.has(value)) added.push(value);
  }
  for (const value of before) {
    if (!afterSet.has(value)) removed.push(value);
  }
  return { added, removed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field lookups
// ─────────────────────────────────────────────────────────────────────────────

const UNCLASSIFIED_KEYS = new Set<string>(Object.keys(UNCLASSIFIED_BY_DESIGN));

function isPatchFieldName(field: string): field is PatchFieldName {
  return Object.prototype.hasOwnProperty.call(PATCH_FIELD_REGISTRY, field);
}

function isOutOfScope(
  classification: PatchFieldClassification,
  target: PatchTarget,
): boolean {
  if (classification.scope === "both") return false;
  return classification.scope !== target;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a registry-aware diff between current event state and a
 * proposed patch.
 *
 * Inputs:
 *   - `current`: the persisted event row (or a partial subset)
 *   - `patch`: fields the AI flow proposes to update; fields missing
 *     from the patch are preserved (plan §5.4)
 *   - `options.target`: when set to `"occurrence"`, series-only
 *     classified fields are rejected into `outOfScopeFields`
 *
 * Outputs are pure data; no I/O, no mutation of inputs.
 */
export function computePatchDiff(
  current: EventState,
  patch: EventPatch,
  options: ComputePatchDiffOptions = {},
): PatchDiffResult {
  const target = options.target ?? "series";

  const changedFields: FieldChange[] = [];
  const unchangedFields: PatchFieldName[] = [];
  const unknownFields: string[] = [];
  const outOfScopeFields: PatchFieldName[] = [];

  // Iterate keys actually present on the patch; absent keys mean
  // "no change" per plan §5.4.
  for (const rawField of Object.keys(patch)) {
    if (!isPatchFieldName(rawField)) {
      // System timestamps, identifiers, admin-only fields, or any name
      // not on `events` at all. Surface so callers can decide.
      if (UNCLASSIFIED_KEYS.has(rawField) || isEventsColumn(rawField)) {
        unknownFields.push(rawField);
      } else {
        unknownFields.push(rawField);
      }
      continue;
    }

    const field = rawField;
    const classification = PATCH_FIELD_REGISTRY[field];

    if (isOutOfScope(classification, target)) {
      outOfScopeFields.push(field);
      continue;
    }

    if (classification.value_kind === "array") {
      const before = normalizeArray(current[field]);
      const after = normalizeArray(patch[field]);
      if (arraysEqualAsSets(before, after)) {
        unchangedFields.push(field);
        continue;
      }
      const { added, removed } = diffArrays(before, after);
      changedFields.push({
        field,
        kind: "array",
        before,
        after,
        added,
        removed,
        risk_tier: classification.risk_tier,
        enforcement_mode: classification.enforcement_mode,
        scope: classification.scope,
      });
      continue;
    }

    const before = normalizeScalar(current[field]);
    const after = normalizeScalar(patch[field]);
    if (before === after) {
      unchangedFields.push(field);
      continue;
    }
    changedFields.push({
      field,
      kind: "scalar",
      before,
      after,
      risk_tier: classification.risk_tier,
      enforcement_mode: classification.enforcement_mode,
      scope: classification.scope,
    });
  }

  return {
    changedFields,
    unchangedFields,
    unknownFields,
    outOfScopeFields,
    summary: summarize(changedFields),
  };
}

function summarize(changes: readonly FieldChange[]): PatchDiffSummary {
  const summary: PatchDiffSummary = {
    high_risk_changes: 0,
    medium_risk_changes: 0,
    low_risk_changes: 0,
    enforced_changes: 0,
    shadow_changes: 0,
  };
  for (const change of changes) {
    if (change.risk_tier === "high") summary.high_risk_changes += 1;
    else if (change.risk_tier === "medium") summary.medium_risk_changes += 1;
    else summary.low_risk_changes += 1;
    if (change.enforcement_mode === "enforced") summary.enforced_changes += 1;
    else summary.shadow_changes += 1;
  }
  return summary;
}

const EVENTS_COLUMN_LOOKUP: Set<string> = new Set([
  ...Object.keys(PATCH_FIELD_REGISTRY),
  ...Object.keys(UNCLASSIFIED_BY_DESIGN),
]);

function isEventsColumn(name: string): name is EventsColumn {
  return EVENTS_COLUMN_LOOKUP.has(name);
}

/**
 * Convenience: returns true when at least one changed field is
 * classified as enforced. Useful for PR 9's gate to decide whether
 * confirmation is required.
 */
export function hasEnforcedChange(diff: PatchDiffResult): boolean {
  return diff.changedFields.some((c) => c.enforcement_mode === "enforced");
}
