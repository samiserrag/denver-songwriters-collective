/**
 * Edit-Turn Telemetry (Track 1, PR 3 — module only, no wiring)
 *
 * Collaboration plan reference:
 *   docs/investigation/ai-event-ops-collaboration-plan.md §6 PR 3
 *
 * This module provides:
 *   - The `EditTurnTelemetryEvent` schema covering exactly the fields
 *     enumerated in §6 PR 3.
 *   - `buildEditTurnTelemetryEvent(input)` — pure helper that takes the
 *     call-site inputs, applies defaults, validates the shape, and
 *     returns a fully-populated event. Wiring is one line at each call
 *     site.
 *   - `emitEditTurnTelemetry(event)` — emits one structured line via
 *     `console.info` with the `[edit-turn-telemetry]` prefix. **This
 *     sink is temporary**: the wiring follow-up PR will replace it with
 *     a structured production pipeline. Until then, no DB writes, no
 *     external HTTP, no env-gated production sink, no env vars added.
 *   - `hashPriorState(prior)` — deterministic short hash (sha256 hex,
 *     first 16 chars) over a stably-stringified normalization of the
 *     prior event JSON. `null` / `undefined` round-trip to `null` (not
 *     a hash of "null"), so absence is distinguishable in telemetry.
 *
 * Out of scope for PR 3 (this file): any call-site wiring, any new env
 * var, any production sink, any DB migration. Call-site wiring touches
 * §8.2-locked files (interpret/route.ts, ConversationalCreateUI.tsx)
 * and lands in a follow-up PR after explicit Sami lock release.
 *
 * `riskTier` and `enforcementMode` are imported from
 * `patchFieldRegistry` to keep the registry as the single source of
 * truth (collab plan §5.1). Do not duplicate the string-literal unions
 * here.
 */

import { createHash, randomUUID } from "node:crypto";

import type { EnforcementMode, RiskTier } from "@/lib/events/patchFieldRegistry";

export type EditTurnMode = "create" | "edit_series" | "edit_occurrence";
export type EditTurnScopeDecision = "series" | "occurrence" | "ambiguous";
export type EditTurnUserOutcome = "accepted" | "rejected" | "unknown";

/**
 * Definitive user outcome for an edit turn, captured client-side after
 * the user explicitly commits or discards the proposed change. Outcome
 * events are correlation-only pings — they share `turnId` with the
 * initial `EditTurnTelemetryEvent` but carry no other context. Analysts
 * join initial + outcome events by `turnId` in Axiom.
 */
export type EditTurnDefinitiveOutcome = Exclude<EditTurnUserOutcome, "unknown">;

export interface EditTurnTelemetryEvent {
  /**
   * Stable correlation id (UUIDv4) shared by an initial event and any
   * later `EditTurnOutcomeEvent` for the same turn. Defaults to a fresh
   * UUIDv4 when omitted at build time. Server-side initial emits always
   * omit (server-side default is the norm); the same id is then echoed
   * in the success response so the client can post a matching outcome.
   */
  turnId: string;
  mode: EditTurnMode;
  currentEventId: string | null;
  priorStateHash: string | null;
  scopeDecision: EditTurnScopeDecision | null;
  proposedChangedFields: string[];
  verifierAutoPatchedFields: string[];
  riskTier: RiskTier;
  enforcementMode: EnforcementMode;
  blockedFields: string[];
  userOutcome: EditTurnUserOutcome;
  modelId: string | null;
  latencyMs: number;
  occurredAt: string;
}

export interface BuildEditTurnTelemetryInput {
  mode: EditTurnMode;
  /** UUIDv4 correlation id; defaults to `randomUUID()` when omitted. */
  turnId?: string;
  currentEventId?: string | null;
  priorStateHash?: string | null;
  scopeDecision?: EditTurnScopeDecision | null;
  proposedChangedFields?: readonly string[];
  verifierAutoPatchedFields?: readonly string[];
  riskTier: RiskTier;
  enforcementMode: EnforcementMode;
  blockedFields?: readonly string[];
  userOutcome?: EditTurnUserOutcome;
  modelId?: string | null;
  latencyMs: number;
  /** ISO timestamp; defaults to `new Date().toISOString()` when omitted. */
  occurredAt?: string;
}

/**
 * Minimal correlation ping emitted when the user reaches a definitive
 * accept/reject moment for a prior edit turn. Carries only the shared
 * `turnId`, the definitive outcome, and the server-set `occurredAt`.
 * All rich context (mode, fields, riskTier, etc.) lives on the initial
 * `EditTurnTelemetryEvent`; consumers join by `turnId`.
 */
export interface EditTurnOutcomeEvent {
  turnId: string;
  userOutcome: EditTurnDefinitiveOutcome;
  occurredAt: string;
}

export interface BuildEditTurnOutcomeInput {
  turnId: string;
  userOutcome: EditTurnDefinitiveOutcome;
  /** ISO timestamp; defaults to `new Date().toISOString()` when omitted. */
  occurredAt?: string;
}

export const EDIT_TURN_TELEMETRY_LOG_PREFIX = "[edit-turn-telemetry]";
export const EDIT_TURN_OUTCOME_LOG_PREFIX = "[edit-turn-outcome]";

const VALID_MODES: ReadonlySet<EditTurnMode> = new Set([
  "create",
  "edit_series",
  "edit_occurrence",
]);
const VALID_SCOPE_DECISIONS: ReadonlySet<EditTurnScopeDecision> = new Set([
  "series",
  "occurrence",
  "ambiguous",
]);
const VALID_RISK_TIERS: ReadonlySet<RiskTier> = new Set(["low", "medium", "high"]);
const VALID_ENFORCEMENT_MODES: ReadonlySet<EnforcementMode> = new Set([
  "enforced",
  "shadow",
]);
const VALID_USER_OUTCOMES: ReadonlySet<EditTurnUserOutcome> = new Set([
  "accepted",
  "rejected",
  "unknown",
]);
const VALID_DEFINITIVE_OUTCOMES: ReadonlySet<EditTurnDefinitiveOutcome> = new Set([
  "accepted",
  "rejected",
]);

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
// RFC 4122 v4 (variant 10xx in the second byte of clock_seq_hi_and_reserved).
// Matches both lowercase and uppercase hex; `randomUUID()` returns lowercase.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error(`EditTurnTelemetryEvent: ${field} must be a string[]`);
  }
}

function validateEditTurnTelemetryEvent(event: EditTurnTelemetryEvent): void {
  if (typeof event.turnId !== "string" || !UUID_V4_RE.test(event.turnId)) {
    throw new Error("EditTurnTelemetryEvent: turnId must be a UUIDv4 string");
  }
  if (!VALID_MODES.has(event.mode)) {
    throw new Error(
      `EditTurnTelemetryEvent: invalid mode "${String(event.mode)}"; expected one of create | edit_series | edit_occurrence`,
    );
  }
  if (event.currentEventId !== null && typeof event.currentEventId !== "string") {
    throw new Error("EditTurnTelemetryEvent: currentEventId must be string | null");
  }
  if (event.priorStateHash !== null && typeof event.priorStateHash !== "string") {
    throw new Error("EditTurnTelemetryEvent: priorStateHash must be string | null");
  }
  if (event.scopeDecision !== null && !VALID_SCOPE_DECISIONS.has(event.scopeDecision)) {
    throw new Error(
      `EditTurnTelemetryEvent: invalid scopeDecision "${String(event.scopeDecision)}"; expected one of series | occurrence | ambiguous | null`,
    );
  }
  assertStringArray(event.proposedChangedFields, "proposedChangedFields");
  assertStringArray(event.verifierAutoPatchedFields, "verifierAutoPatchedFields");
  assertStringArray(event.blockedFields, "blockedFields");
  if (!VALID_RISK_TIERS.has(event.riskTier)) {
    throw new Error(
      `EditTurnTelemetryEvent: invalid riskTier "${String(event.riskTier)}"; expected one of low | medium | high`,
    );
  }
  if (!VALID_ENFORCEMENT_MODES.has(event.enforcementMode)) {
    throw new Error(
      `EditTurnTelemetryEvent: invalid enforcementMode "${String(event.enforcementMode)}"; expected one of enforced | shadow`,
    );
  }
  if (!VALID_USER_OUTCOMES.has(event.userOutcome)) {
    throw new Error(
      `EditTurnTelemetryEvent: invalid userOutcome "${String(event.userOutcome)}"; expected one of accepted | rejected | unknown`,
    );
  }
  if (event.modelId !== null && typeof event.modelId !== "string") {
    throw new Error("EditTurnTelemetryEvent: modelId must be string | null");
  }
  if (typeof event.latencyMs !== "number" || !Number.isFinite(event.latencyMs) || event.latencyMs < 0) {
    throw new Error("EditTurnTelemetryEvent: latencyMs must be a non-negative finite number");
  }
  if (typeof event.occurredAt !== "string" || !ISO_TIMESTAMP_RE.test(event.occurredAt)) {
    throw new Error("EditTurnTelemetryEvent: occurredAt must be an ISO 8601 timestamp string");
  }
}

export function buildEditTurnTelemetryEvent(
  input: BuildEditTurnTelemetryInput,
): EditTurnTelemetryEvent {
  const event: EditTurnTelemetryEvent = {
    turnId: input.turnId ?? randomUUID(),
    mode: input.mode,
    currentEventId: input.currentEventId ?? null,
    priorStateHash: input.priorStateHash ?? null,
    scopeDecision: input.scopeDecision ?? null,
    proposedChangedFields: [...(input.proposedChangedFields ?? [])],
    verifierAutoPatchedFields: [...(input.verifierAutoPatchedFields ?? [])],
    riskTier: input.riskTier,
    enforcementMode: input.enforcementMode,
    blockedFields: [...(input.blockedFields ?? [])],
    userOutcome: input.userOutcome ?? "unknown",
    modelId: input.modelId ?? null,
    latencyMs: input.latencyMs,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
  validateEditTurnTelemetryEvent(event);
  return event;
}

function validateEditTurnOutcomeEvent(event: EditTurnOutcomeEvent): void {
  if (typeof event.turnId !== "string" || !UUID_V4_RE.test(event.turnId)) {
    throw new Error("EditTurnOutcomeEvent: turnId must be a UUIDv4 string");
  }
  if (!VALID_DEFINITIVE_OUTCOMES.has(event.userOutcome)) {
    throw new Error(
      `EditTurnOutcomeEvent: invalid userOutcome "${String(event.userOutcome)}"; expected accepted | rejected`,
    );
  }
  if (typeof event.occurredAt !== "string" || !ISO_TIMESTAMP_RE.test(event.occurredAt)) {
    throw new Error("EditTurnOutcomeEvent: occurredAt must be an ISO 8601 timestamp string");
  }
}

export function buildEditTurnOutcomeEvent(
  input: BuildEditTurnOutcomeInput,
): EditTurnOutcomeEvent {
  const event: EditTurnOutcomeEvent = {
    turnId: input.turnId,
    userOutcome: input.userOutcome,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
  validateEditTurnOutcomeEvent(event);
  return event;
}

export function emitEditTurnOutcome(event: EditTurnOutcomeEvent): void {
  validateEditTurnOutcomeEvent(event);
  // Same temporary sink as `emitEditTurnTelemetry`: one structured
  // console.info line, no env gating, no DB writes. Production sink
  // swap is shared with the initial event pipeline.
  console.info(`${EDIT_TURN_OUTCOME_LOG_PREFIX} ${JSON.stringify(event)}`);
}

export function emitEditTurnTelemetry(event: EditTurnTelemetryEvent): void {
  validateEditTurnTelemetryEvent(event);
  // Temporary sink: the wiring follow-up PR will replace this with the
  // production telemetry pipeline. Until then a single structured
  // console.info line is the only sink and there is no env gating.
  console.info(`${EDIT_TURN_TELEMETRY_LOG_PREFIX} ${JSON.stringify(event)}`);
}

/**
 * Stable JSON stringify with sorted object keys. Keys with `undefined`
 * values are skipped (matches `JSON.stringify` object-key behavior).
 * Arrays preserve order; only object key order is normalized.
 */
function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const v = obj[key];
      if (typeof v === "undefined") continue;
      parts.push(`${JSON.stringify(key)}:${stableStringify(v)}`);
    }
    return `{${parts.join(",")}}`;
  }
  // function / symbol / undefined: not representable; omit by returning "null".
  return "null";
}

/**
 * Deterministic short hash of the prior event state. Returns `null`
 * when `prior` is `null` or `undefined` so absence is distinguishable
 * from the hash of any value. Object key order is normalized before
 * hashing so semantically equal payloads produce the same hash.
 */
export function hashPriorState(prior: unknown): string | null {
  if (prior === null || typeof prior === "undefined") return null;
  const normalized = stableStringify(prior);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}
