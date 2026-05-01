"use client";

import { Fragment, useMemo } from "react";
import {
  computePatchDiff,
  type EventPatch,
  type EventState,
  type FieldChange,
  type PatchTarget,
  type ScalarValue,
} from "@/lib/events/computePatchDiff";
import type { PatchFieldName } from "@/lib/events/patchFieldRegistry";

// ---------------------------------------------------------------------------
// Friendly labels for fields shown in the diff. Anything missing falls back
// to a humanized snake_case name. The registry stays the source of truth for
// classification; labels are display-only sugar that mirrors the lab's
// existing FIELD_INPUT_HINTS shape.
// ---------------------------------------------------------------------------
const FIELD_LABELS: Partial<Record<PatchFieldName, string>> = {
  title: "Title",
  description: "Description",
  event_type: "Type",
  categories: "Categories",
  category: "Category",
  event_date: "Date",
  start_time: "Start time",
  end_time: "End time",
  signup_time: "Signup time",
  signup_deadline: "Signup deadline",
  timezone: "Timezone",
  recurrence_rule: "Recurrence",
  recurrence_pattern: "Recurrence pattern",
  recurrence_end_date: "Recurrence ends",
  day_of_week: "Day of week",
  custom_dates: "Custom dates",
  is_recurring: "Recurring",
  max_occurrences: "Max occurrences",
  venue_id: "Venue",
  venue_name: "Venue",
  venue_address: "Venue address",
  custom_location_name: "Location",
  custom_address: "Address",
  custom_city: "City",
  custom_state: "State",
  custom_latitude: "Latitude",
  custom_longitude: "Longitude",
  location_mode: "Location mode",
  location_notes: "Location notes",
  online_url: "Online URL",
  cover_image_url: "Cover image",
  is_published: "Published",
  visibility: "Visibility",
  status: "Status",
  cancelled_at: "Cancelled at",
  cancel_reason: "Cancel reason",
  signup_mode: "Signup",
  signup_url: "Signup URL",
  external_url: "External URL",
  is_free: "Free",
  cost_label: "Cost",
  capacity: "Capacity",
  total_slots: "Total slots",
  has_timeslots: "Timeslots",
  allow_guest_slots: "Guest slots",
  slot_duration_minutes: "Slot length (minutes)",
  slot_offer_window_minutes: "Slot offer window (minutes)",
  age_policy: "Age policy",
  notes: "Notes",
  host_notes: "Host notes",
};

function humanizeFieldName(field: string): string {
  if (FIELD_LABELS[field as PatchFieldName]) {
    return FIELD_LABELS[field as PatchFieldName] as string;
  }
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(value: ScalarValue): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

// ---------------------------------------------------------------------------
// Render mode resolution: "What changed" only applies to edit modes. Diff
// against the prior in-flight draft so the user sees what the AI just moved
// in this turn — a turn-level field-list, not a full event re-statement.
// ---------------------------------------------------------------------------
type WhatChangedMode = "create" | "edit_series" | "edit_occurrence";

function modeToTarget(mode: WhatChangedMode): PatchTarget {
  return mode === "edit_occurrence" ? "occurrence" : "series";
}

interface WhatChangedProps {
  mode: WhatChangedMode;
  before: EventState | null;
  after: EventPatch | null;
  className?: string;
}

export function WhatChanged({ mode, before, after, className }: WhatChangedProps) {
  const diffResult = useMemo(() => {
    if (mode === "create") return null;
    if (!before || !after) return null;
    return computePatchDiff(before, after, { target: modeToTarget(mode) });
  }, [mode, before, after]);

  if (!diffResult) return null;
  if (diffResult.changedFields.length === 0) return null;

  return (
    <section
      aria-label="What changed"
      className={
        className ??
        "rounded-lg border border-[var(--color-border-input)] bg-[var(--color-bg-secondary)]/35 p-3"
      }
      data-testid="what-changed-section"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        What changed
      </p>
      <ul className="mt-2 space-y-2 text-sm">
        {diffResult.changedFields.map((change) => (
          <li
            key={change.field}
            className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr]"
          >
            <span className="text-[var(--color-text-tertiary)]">
              {humanizeFieldName(change.field)}
            </span>
            <span className="text-[var(--color-text-primary)]">
              <ChangeValue change={change} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChangeValue({ change }: { change: FieldChange }) {
  if (change.kind === "array") {
    if (change.added.length === 0 && change.removed.length === 0) {
      return <span className="text-[var(--color-text-tertiary)]">No change</span>;
    }
    return (
      <span className="space-y-0.5 block">
        {change.added.length > 0 && (
          <span className="block">
            <span className="text-[var(--color-text-tertiary)]">Added: </span>
            <span className="font-medium text-[var(--color-text-primary)]">
              {change.added.join(", ")}
            </span>
          </span>
        )}
        {change.removed.length > 0 && (
          <span className="block">
            <span className="text-[var(--color-text-tertiary)]">Removed: </span>
            <span className="font-medium text-[var(--color-text-primary)] line-through">
              {change.removed.join(", ")}
            </span>
          </span>
        )}
      </span>
    );
  }

  return (
    <Fragment>
      <span className="text-[var(--color-text-tertiary)] line-through">
        {formatScalar(change.before)}
      </span>
      <span className="px-1.5 text-[var(--color-text-tertiary)]">→</span>
      <span className="font-medium text-[var(--color-text-primary)]">
        {formatScalar(change.after)}
      </span>
    </Fragment>
  );
}

export default WhatChanged;
