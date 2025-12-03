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
export function humanizeRecurrence(recurrenceRule?: string | null, dayOfWeek?: string | null): string {
  if (!recurrenceRule) {
    return dayOfWeek ? String(dayOfWeek) : "";
  }

  const rule = recurrenceRule.toUpperCase();
  const parts = rule.split(";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k && v) map[k] = v;
  }

  const freq = map["FREQ"] ?? "";
  const interval = parseInt(map["INTERVAL"] ?? "1", 10) || 1;
  const byday = map["BYDAY"] ?? "";

  if (freq === "WEEKLY") {
    if (interval === 2) {
      return dayOfWeek ? `Every other ${dayOfWeek}` : "Every other week";
    }
    return dayOfWeek ? `${dayOfWeek} • Weekly` : "Weekly";
  }

  if (freq === "DAILY") {
    if (interval === 2) return "Every other day";
    return "Daily";
  }

  if (freq === "MONTHLY") {
    if (!byday) {
      return "Monthly";
    }
    // BYDAY can be like "1MO,3MO" or "-1MO"
    const entries = byday.split(",").map((s) => s.trim()).filter(Boolean);
    const humanParts: string[] = [];
    for (const entry of entries) {
      // match optional ordinal prefix followed by weekday code (MO,TU,...)
      const m = entry.match(/^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
      if (!m) continue;
      const ord = m[1] ?? "";
      const wdCode = m[2] ?? "";
      // map weekday code to full name
      const wdMap: Record<string, string> = {
        SU: "Sunday",
        MO: "Monday",
        TU: "Tuesday",
        WE: "Wednesday",
        TH: "Thursday",
        FR: "Friday",
        SA: "Saturday",
      };
      const wd = wdMap[wdCode] ?? dayOfWeek ?? "";
      const word = ord ? (ordinalWords[String(ord)] ?? `${ord}th`) : "";
      if (word) {
        humanParts.push(`${word} ${wd}`);
      } else {
        humanParts.push(wd);
      }
    }

    if (humanParts.length === 0) return "Monthly";
    if (humanParts.length === 1) return `${humanParts[0]} of each month`;
    // comma join with "and"
    if (humanParts.length === 2) return `${humanParts[0]} and ${humanParts[1]} of each month`;
    const last = humanParts.pop();
    return `${humanParts.join(", ")}, and ${last} of each month`;
  }

  if (freq === "YEARLY") {
    return "Yearly";
  }

  // fallback: return the raw rule (shortened) plus optional day
  const fallback = recurrenceRule.length > 80 ? `${recurrenceRule.slice(0, 77)}...` : recurrenceRule;
  return dayOfWeek ? `${dayOfWeek} • ${fallback}` : fallback;
}

export default {
  humanizeRecurrence,
  formatTimeToAMPM,
  dayOrder,
};
