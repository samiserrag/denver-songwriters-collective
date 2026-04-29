/**
 * Patch Field Registry (Track 1, PR 1)
 *
 * Single source of truth for how the AI edit/update flow may patch the
 * `events` table. This module is data only — no runtime call sites are
 * wired up in PR 1. Wiring happens in later PRs (server-side diff in
 * PR 2, published-event gate in PR 9, etc.).
 *
 * Field shape is defined by the collaboration plan
 * (`docs/investigation/ai-event-ops-collaboration-plan.md` §5.1):
 *
 *   risk_tier            "low" | "medium" | "high"
 *   enforcement_mode     "enforced" | "shadow"
 *   verifier_auto_patchable
 *                        Whether the post-extraction verifier may correct
 *                        this field without explicit user confirmation.
 *   scope                "series" | "occurrence" | "both"
 *                        Which target a patch may apply to. Series-only
 *                        fields (recurrence shape, publish state, slug)
 *                        cannot be patched on a single occurrence.
 *   value_kind           "scalar" | "array"
 *
 * Day-one enforced high-risk fields (per plan §5.2): date, start time,
 * end time, signup time, recurrence, venue/location, cover image,
 * publish state, cancellation, deletion. Lower-risk fields default to
 * `shadow` so live behavior stays unchanged while telemetry is
 * collected.
 *
 * Unknown fields default to high risk + enforced. The classification
 * test in `__tests__/patchFieldRegistry.test.ts` is the deterministic
 * enforcement boundary: every column on the events row must be either
 * classified here or listed in `UNCLASSIFIED_BY_DESIGN` with a
 * justification.
 */

import type { Database } from "@/lib/supabase/database.types";

export type RiskTier = "low" | "medium" | "high";
export type EnforcementMode = "enforced" | "shadow";
export type PatchScope = "series" | "occurrence" | "both";
export type ValueKind = "scalar" | "array";

export interface PatchFieldClassification {
  risk_tier: RiskTier;
  enforcement_mode: EnforcementMode;
  verifier_auto_patchable: boolean;
  scope: PatchScope;
  value_kind: ValueKind;
}

type EventsRow = Database["public"]["Tables"]["events"]["Row"];
export type EventsColumn = keyof EventsRow;

/**
 * Every column on `public.events`. Kept in sync with the generated
 * Supabase types via the compile-time guard below.
 */
export const EVENTS_COLUMN_NAMES = [
  "age_policy",
  "allow_guest_slots",
  "cancel_reason",
  "cancelled_at",
  "capacity",
  "categories",
  "category",
  "cost_label",
  "cover_image_url",
  "created_at",
  "custom_address",
  "custom_city",
  "custom_dates",
  "custom_latitude",
  "custom_location_name",
  "custom_longitude",
  "custom_state",
  "day_of_week",
  "description",
  "end_time",
  "event_date",
  "event_type",
  "external_url",
  "has_timeslots",
  "host_id",
  "host_notes",
  "id",
  "is_dsc_event",
  "is_free",
  "is_published",
  "is_recurring",
  "is_showcase",
  "is_spotlight",
  "last_major_update_at",
  "last_verified_at",
  "location_mode",
  "location_notes",
  "max_occurrences",
  "notes",
  "online_url",
  "parent_event_id",
  "published_at",
  "recurrence_end_date",
  "recurrence_pattern",
  "recurrence_rule",
  "region_id",
  "series_id",
  "series_index",
  "signup_deadline",
  "signup_mode",
  "signup_time",
  "signup_url",
  "slot_duration_minutes",
  "slot_offer_window_minutes",
  "slug",
  "source",
  "spotify_url",
  "spotlight_reason",
  "start_time",
  "status",
  "timezone",
  "title",
  "total_slots",
  "updated_at",
  "venue_address",
  "venue_id",
  "venue_name",
  "verified_by",
  "visibility",
  "youtube_url",
] as const satisfies readonly EventsColumn[];

// Compile-time guard: EVENTS_COLUMN_NAMES must equal `keyof EventsRow`
// in both directions. Tuple wrapping prevents distributive conditional
// behavior so a single missing or extra column fails type-checking.
type _ColumnNamesUnion = (typeof EVENTS_COLUMN_NAMES)[number];
type _MissingFromList = [EventsColumn] extends [_ColumnNamesUnion] ? true : never;
type _ExtraInList = [_ColumnNamesUnion] extends [EventsColumn] ? true : never;
const _columnsCoverRow: _MissingFromList = true;
const _columnsAreSubsetOfRow: _ExtraInList = true;
void _columnsCoverRow;
void _columnsAreSubsetOfRow;

/**
 * Day-one enforced high-risk fields, per collaboration plan §5.2.
 * The classification test asserts each entry resolves to
 * `risk_tier: "high"` and `enforcement_mode: "enforced"`.
 */
export const DAY_ONE_ENFORCED_HIGH_RISK_FIELDS = [
  // date and time
  "event_date",
  "start_time",
  "end_time",
  "signup_time",
  // recurrence shape
  "recurrence_pattern",
  "recurrence_rule",
  "recurrence_end_date",
  "day_of_week",
  "max_occurrences",
  "is_recurring",
  "custom_dates",
  // venue / location
  "venue_id",
  "venue_name",
  "venue_address",
  "custom_address",
  "custom_city",
  "custom_state",
  "custom_latitude",
  "custom_longitude",
  "custom_location_name",
  "location_mode",
  "online_url",
  // cover image
  "cover_image_url",
  // publish state
  "is_published",
  "visibility",
  // cancellation / lifecycle
  "status",
  "cancelled_at",
  "cancel_reason",
] as const;

export type DayOneEnforcedField = (typeof DAY_ONE_ENFORCED_HIGH_RISK_FIELDS)[number];

const HIGH_ENFORCED = (
  scope: PatchScope,
  value_kind: ValueKind = "scalar",
): PatchFieldClassification => ({
  risk_tier: "high",
  enforcement_mode: "enforced",
  verifier_auto_patchable: false,
  scope,
  value_kind,
});

const MEDIUM_SHADOW = (
  scope: PatchScope,
  value_kind: ValueKind = "scalar",
  verifier_auto_patchable = false,
): PatchFieldClassification => ({
  risk_tier: "medium",
  enforcement_mode: "shadow",
  verifier_auto_patchable,
  scope,
  value_kind,
});

const LOW_SHADOW = (
  scope: PatchScope,
  value_kind: ValueKind = "scalar",
  verifier_auto_patchable = true,
): PatchFieldClassification => ({
  risk_tier: "low",
  enforcement_mode: "shadow",
  verifier_auto_patchable,
  scope,
  value_kind,
});

/**
 * Classification of every host-editable column on `public.events`.
 * Scope notes:
 *   - "series" means the field describes the parent/series shape and
 *     cannot be overridden on a single occurrence (recurrence fields,
 *     publish state, identity).
 *   - "occurrence" is reserved for fields that only exist on the
 *     occurrence override layer (none today; overrides live in a
 *     separate table).
 *   - "both" means the field is meaningful on the parent record and
 *     may also be patched per-occurrence via the override layer.
 */
export const PATCH_FIELD_REGISTRY = {
  // ------- date / time (high, enforced) -------
  event_date: HIGH_ENFORCED("both"),
  start_time: HIGH_ENFORCED("both"),
  end_time: HIGH_ENFORCED("both"),
  signup_time: HIGH_ENFORCED("both"),
  signup_deadline: HIGH_ENFORCED("both"),
  timezone: HIGH_ENFORCED("series"),

  // ------- recurrence shape (high, enforced, series-only) -------
  is_recurring: HIGH_ENFORCED("series"),
  recurrence_pattern: HIGH_ENFORCED("series"),
  recurrence_rule: HIGH_ENFORCED("series"),
  recurrence_end_date: HIGH_ENFORCED("series"),
  // Note: the server-side recurrence canonicalizer (recurrenceCanonicalization.ts)
  // may derive day_of_week from event_date on the write path. That is a write-
  // path normalization, not an AI verifier auto-patch — it runs regardless of
  // origin and does not bypass the publish/cancellation gate.
  day_of_week: HIGH_ENFORCED("series"),
  max_occurrences: HIGH_ENFORCED("series"),
  custom_dates: HIGH_ENFORCED("series", "array"),

  // ------- venue / location (high, enforced) -------
  venue_id: HIGH_ENFORCED("both"),
  venue_name: HIGH_ENFORCED("both"),
  venue_address: HIGH_ENFORCED("both"),
  custom_address: HIGH_ENFORCED("both"),
  custom_city: HIGH_ENFORCED("both"),
  custom_state: HIGH_ENFORCED("both"),
  custom_latitude: HIGH_ENFORCED("both"),
  custom_longitude: HIGH_ENFORCED("both"),
  custom_location_name: HIGH_ENFORCED("both"),
  location_mode: HIGH_ENFORCED("both"),
  online_url: HIGH_ENFORCED("both"),

  // ------- cover image (high, enforced) -------
  cover_image_url: HIGH_ENFORCED("both"),

  // ------- publish state (high, enforced, series-only) -------
  is_published: HIGH_ENFORCED("series"),
  visibility: HIGH_ENFORCED("series"),

  // ------- cancellation / lifecycle (high, enforced) -------
  status: HIGH_ENFORCED("both"),
  cancelled_at: HIGH_ENFORCED("both"),
  cancel_reason: HIGH_ENFORCED("both"),

  // ------- branding / spotlight (high, enforced) -------
  // is_dsc_event is admin-gated at the API layer today; the registry
  // mirrors that conservatism so AI patches cannot flip CSC branding.
  is_dsc_event: HIGH_ENFORCED("series"),
  // Spotlight is admin-curated; the AI flow must not promote events
  // into spotlight slots silently.
  is_spotlight: HIGH_ENFORCED("series"),

  // ------- identity / display (medium, shadow) -------
  title: MEDIUM_SHADOW("series"),
  slug: { ...MEDIUM_SHADOW("series"), verifier_auto_patchable: true },

  // ------- categorization (medium, shadow) -------
  event_type: MEDIUM_SHADOW("both", "array", true),
  categories: MEDIUM_SHADOW("both", "array"),
  category: MEDIUM_SHADOW("both"),

  // ------- capacity / format (medium, shadow) -------
  capacity: MEDIUM_SHADOW("both"),
  total_slots: MEDIUM_SHADOW("both"),
  has_timeslots: MEDIUM_SHADOW("series"),
  allow_guest_slots: MEDIUM_SHADOW("both"),
  slot_duration_minutes: MEDIUM_SHADOW("both"),
  slot_offer_window_minutes: MEDIUM_SHADOW("both"),
  signup_mode: MEDIUM_SHADOW("both"),
  signup_url: MEDIUM_SHADOW("both"),

  // ------- audience / cost (medium, shadow) -------
  age_policy: MEDIUM_SHADOW("both"),
  is_free: MEDIUM_SHADOW("both"),
  cost_label: MEDIUM_SHADOW("both"),
  is_showcase: MEDIUM_SHADOW("series"),
  external_url: MEDIUM_SHADOW("both"),
  spotlight_reason: MEDIUM_SHADOW("series"),

  // ------- free-text content (low, shadow) -------
  description: LOW_SHADOW("both"),
  notes: LOW_SHADOW("both"),
  host_notes: LOW_SHADOW("series"),
  location_notes: LOW_SHADOW("both"),
} as const satisfies Partial<Record<EventsColumn, PatchFieldClassification>>;

export type PatchFieldName = keyof typeof PATCH_FIELD_REGISTRY;

/**
 * Columns that exist on `public.events` but are intentionally not
 * editable via the AI host edit/update flow. Each entry must carry a
 * justification; the classification test asserts that.
 *
 * Categories:
 *   - system timestamps and identifiers
 *   - server-derived values (region, series identity, slug source)
 *   - ownership transfer (separate explicit flow, not AI patch)
 *   - admin-only media embed fields (admin path, not host AI flow)
 *   - admin verification pair (separate confirmation flow)
 */
export const UNCLASSIFIED_BY_DESIGN = {
  id: "Primary key. Immutable; never patched.",
  created_at: "System timestamp set on insert.",
  updated_at: "System timestamp maintained by the write path.",
  published_at: "Set by the publish path, not by AI patches.",
  last_major_update_at: "Server-derived telemetry timestamp.",
  last_verified_at:
    "Admin/host verification flow (see verification.ts); not part of the AI host edit surface.",
  verified_by:
    "Admin verification pair with last_verified_at; assigned by the verification flow.",
  host_id:
    "Ownership transfer is a separate explicit flow with its own approval gate.",
  region_id: "Server-derived from the resolved venue; not patched directly.",
  series_id: "System-managed series identity assigned at creation time.",
  series_index: "System-managed occurrence index within a series.",
  parent_event_id: "System-managed series link; mutated by series operations only.",
  source:
    "Origin telemetry tag (manual / ai_chat / ai_edit / url_import). Set by the write path, never user-editable.",
  spotify_url:
    "Admin-only media embed field (see 10-web-product-invariants.md §API Route Known Footguns); not on the host AI edit surface.",
  youtube_url:
    "Admin-only media embed field (see 10-web-product-invariants.md §API Route Known Footguns); not on the host AI edit surface.",
} as const satisfies Partial<Record<EventsColumn, string>>;

export type UnclassifiedColumn = keyof typeof UNCLASSIFIED_BY_DESIGN;

/**
 * Lookup helper. Returns `undefined` when the column is unknown or
 * intentionally unclassified; callers must treat that as "high risk +
 * enforced" per plan §5.1.
 */
export function getPatchFieldClassification(
  column: EventsColumn,
): PatchFieldClassification | undefined {
  return (PATCH_FIELD_REGISTRY as Record<string, PatchFieldClassification | undefined>)[column];
}
