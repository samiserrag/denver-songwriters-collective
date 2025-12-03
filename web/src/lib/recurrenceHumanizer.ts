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
  // A1.6: If null -> Schedule TBD
  if (!recurrenceRule) {
    return "Schedule TBD";
  }

  const raw = recurrenceRule.trim();
  const rule = raw.toUpperCase();

  // simple textual shortcuts
  if (rule === "WEEKLY" || rule === "WEEK") {
    return dayOfWeek ? `Every ${dayOfWeek}` : "Weekly";
  }
  if (rule === "BIWEEKLY" || rule === "EVERY OTHER WEEK" || rule === "EVERY-OTHER-WEEK") {
    return dayOfWeek ? `Every other ${dayOfWeek}` : "Every other week";
  }
  if (rule === "MONTHLY") {
    return dayOfWeek ? `Monthly on ${dayOfWeek}` : "Monthly";
  }
  if (rule === "LAST") {
    return dayOfWeek ? `Last ${dayOfWeek} of the month` : "Last of the month";
  }

  // Parse RFC-like rule parts (FREQ=..., INTERVAL=..., BYDAY=...)
  const parts = rule.split(";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k && v) map[k] = v;
  }

  const freq = map["FREQ"] ?? "";
  const interval = parseInt(map["INTERVAL"] ?? "1", 10) || 1;
  const bydayRaw = (map["BYDAY"] ?? "").trim();

  // A1.3 & A1.1: WEEKLY / BIWEEKLY
  if (freq === "WEEKLY") {
    if (interval === 2) return dayOfWeek ? `Every other ${dayOfWeek}` : "Every other week";
    return dayOfWeek ? `Every ${dayOfWeek}` : "Weekly";
  }

  // A1.4 & A1.5: MONTHLY and LAST
  if (freq === "MONTHLY") {
    if (!bydayRaw) return dayOfWeek ? `Monthly on ${dayOfWeek}` : "Monthly";

    // BYDAY may be "1MO,3MO" or "-1MO" or "1MO/3MO"
    const entries = bydayRaw.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    const ordinals: string[] = [];
    let weekday = dayOfWeek ?? "";

    for (const entry of entries) {
      const m = entry.match(/^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
      if (!m) continue;
      const ord = m[1] ?? "";
      const wdCode = m[2] ?? "";
      const wdMap: Record<string, string> = {
        SU: "Sunday",
        MO: "Monday",
        TU: "Tuesday",
        WE: "Wednesday",
        TH: "Thursday",
        FR: "Friday",
        SA: "Saturday",
      };
      weekday = wdMap[wdCode] ?? weekday;
      if (ord) {
        // A1.5: last -> "-1"
        if (String(ord) === "-1") {
          return `Last ${weekday} of the month`;
        }
        const word = ordinalWords[String(ord)] ?? `${ord}th`;
        ordinals.push(word);
      } else {
        // no ordinal (just weekday)
        ordinals.push(weekday);
      }
    }

    const unique = Array.from(new Set(ordinals)).filter(Boolean);
    if (unique.length === 0) return `Monthly on ${weekday || "the specified day"}`;
    if (unique.length === 1) {
      const single = unique[0];
      // If single is a weekday name, use "Monthly on X", otherwise "Third Monday"
      if (["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].includes(single)) {
        return `Monthly on ${single}`;
      }
      return `${single} ${weekday}`.trim();
    }
    // Multiple ordinals -> join with " & "
    return `${unique.join(" & ")} ${weekday}`.trim();
  }

  // DAILY fallback
  if (freq === "DAILY") {
    if (interval === 2) return "Every other day";
    return "Daily";
  }

  // General fallbacks: if rule mentions week/month, prefer showing Every {day} or Monthly on {day}
  if (rule.includes("WEEK")) return dayOfWeek ? `Every ${dayOfWeek}` : "Weekly";
  if (rule.includes("MONTH")) return dayOfWeek ? `Monthly on ${dayOfWeek}` : "Monthly";

  // final fallback: short raw
  const fallback = raw.length > 80 ? `${raw.slice(0, 77)}...` : raw;
  return fallback;
}

export default {
  humanizeRecurrence,
  formatTimeToAMPM,
  dayOrder,
};
