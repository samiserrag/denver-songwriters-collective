/**
 * Recurrence humanizer and time helpers
 * - humanizeRecurrence(recurrenceRule, dayOfWeek)
 * - formatTimeToAMPM(time)
 * - dayOrder (Sunday -> Saturday)
 */

const ordinalWords: Record<string, string> = {
  "1": "First",
  "2": "Second",
  "3": "Third",
  "4": "Fourth",
  "-1": "Last",
};

export const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Convert a time string (HH:MM or ISO datetime) to human AM/PM like "7:30 PM".
 * Returns "TBD" when not parseable or not provided.
 */
export function formatTimeToAMPM(time?: string | null): string {
  if (!time) return "TBD";

  try {
    // If ISO datetime, split on 'T'
    const t = time.includes("T") ? time.split("T")[1] : time;
    const timeOnly = t.split("Z")[0].split("+")[0]; // remove timezone if present
    const parts = timeOnly.split(":");
    if (parts.length < 1) return "TBD";
    const hh = parseInt(parts[0], 10);
    const mm = parts[1] ?? "00";
    if (Number.isNaN(hh)) return "TBD";
    const ampm = hh >= 12 ? "PM" : "AM";
    const hour12 = ((hh + 11) % 12) + 1;
    const minutes = mm.padEnd(2, "0").slice(0, 2);
    return `${hour12}${minutes === "00" ? "" : `:${minutes}`} ${ampm}`.trim();
  } catch {
    return "TBD";
  }
}

/**
 * Humanize a recurrence rule (RFC-like string) plus optional day_of_week into readable text.
 * Examples:
 * - FREQ=WEEKLY -> "Weekly"
 * - FREQ=WEEKLY;INTERVAL=2 -> "Every other week"
 * - FREQ=MONTHLY;BYDAY=1MO,3MO -> "First and Third Monday of each month"
 * - FREQ=MONTHLY;BYDAY=-1MO -> "Last Monday of each month"
 * - null/undefined -> dayOfWeek ? dayOfWeek : ""
 */
export function humanizeRecurrence(recurrence: string | null, day: string | null) {
  // simple capitalize helper (inline)
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const ORDINAL_MAP: Record<string, string> = {
    "1st": "1st",
    "2nd": "2nd",
    "3rd": "3rd",
    "4th": "4th",
  };

  if (!day) return "Schedule TBD";
  if (!recurrence) return "Schedule TBD";

  const d = capitalize(String(day).toLowerCase());

  const r = String(recurrence).trim().toLowerCase();

  if (r === "weekly") return `Every ${d}`;
  if (r === "biweekly" || r === "every other week") return `Every Other ${d}`;
  if (r === "monthly") return `Every ${d} (Monthly)`;
  if (r === "seasonal") return `Seasonal — check venue`;
  if (r === "last") return `Last ${d} of the Month`;

  // ordinals like "1st", "2nd", "3rd", "4th"
  if (ORDINAL_MAP[r]) {
    return `${ORDINAL_MAP[r]} ${d} of the Month`;
  }

  // pairs like "1st/3rd" or "2nd/4th"
  if (r.includes("/")) {
    const parts = r.split("/").map((p) => p.trim().toLowerCase());
    const valid = parts.map((p) => ORDINAL_MAP[p]).filter(Boolean);
    if (valid.length >= 2) {
      return `${valid.join(" & ")} ${d}s`;
    }
  }

  return "Schedule TBD";
}

export default {
  humanizeRecurrence,
  formatTimeToAMPM,
  dayOrder,
};
