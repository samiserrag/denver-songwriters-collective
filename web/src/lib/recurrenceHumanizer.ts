/**
 * Recurrence humanizer and time helpers
 * - humanizeRecurrence(recurrenceRule, dayOfWeek)
 * - formatTimeToAMPM(time)
 * - parseRRule(rrule) - Parse RFC 5545 RRULE string
 * - getNextOccurrence(rrule, startDate) - Calculate next occurrence
 * - dayOrder (Sunday -> Saturday)
 */

const ordinalWords: Record<string, string> = {
  "1": "First",
  "2": "Second",
  "3": "Third",
  "4": "Fourth",
  "5": "Fifth",
  "-1": "Last",
  "-2": "Second to Last",
};

const dayAbbrevToFull: Record<string, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

const dayAbbrevToIndex: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Parse an RFC 5545 RRULE string into components
 */
export interface ParsedRRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  interval: number;
  byday: Array<{ ordinal: number | null; day: string }>;
  bymonthday: number[];
  count: number | null;
  until: Date | null;
}

export function parseRRule(rrule: string | null): ParsedRRule | null {
  if (!rrule) return null;

  const result: ParsedRRule = {
    freq: null,
    interval: 1,
    byday: [],
    bymonthday: [],
    count: null,
    until: null,
  };

  // Handle both RRULE: prefix and raw format
  const ruleStr = rrule.replace(/^RRULE:/i, "").trim();

  // Parse each component
  const parts = ruleStr.split(/[;\n]+/);
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;

    const upperKey = key.toUpperCase().trim();
    const trimValue = value.trim();

    switch (upperKey) {
      case "FREQ":
        result.freq = trimValue.toUpperCase() as ParsedRRule["freq"];
        break;

      case "INTERVAL":
        result.interval = parseInt(trimValue, 10) || 1;
        break;

      case "BYDAY":
        // Parse BYDAY values like "MO", "1MO", "-1FR", "2TU,4TU"
        const dayParts = trimValue.toUpperCase().split(",");
        for (const dayPart of dayParts) {
          const match = dayPart.match(/^(-?\d+)?([A-Z]{2})$/);
          if (match) {
            const ordinal = match[1] ? parseInt(match[1], 10) : null;
            const day = match[2];
            if (dayAbbrevToFull[day]) {
              result.byday.push({ ordinal, day });
            }
          }
        }
        break;

      case "BYMONTHDAY":
        result.bymonthday = trimValue.split(",").map((d) => parseInt(d, 10)).filter((n) => !isNaN(n));
        break;

      case "COUNT":
        result.count = parseInt(trimValue, 10) || null;
        break;

      case "UNTIL":
        // Parse YYYYMMDD or YYYYMMDDTHHMMSSZ format
        if (trimValue.length >= 8) {
          const year = parseInt(trimValue.slice(0, 4), 10);
          const month = parseInt(trimValue.slice(4, 6), 10) - 1;
          const day = parseInt(trimValue.slice(6, 8), 10);
          result.until = new Date(year, month, day);
        }
        break;
    }
  }

  return result.freq ? result : null;
}

/**
 * Get the next occurrence date for a recurring event
 */
export function getNextOccurrence(rrule: string | null, startDate: Date | string | null): Date | null {
  if (!rrule) return null;

  const parsed = parseRRule(rrule);
  if (!parsed) return null;

  const start = startDate ? new Date(startDate) : new Date();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // If event has ended (UNTIL passed), return null
  if (parsed.until && parsed.until < now) {
    return null;
  }

  let candidate = new Date(start);
  candidate.setHours(0, 0, 0, 0);

  // Simple implementation for common cases
  switch (parsed.freq) {
    case "WEEKLY":
      // Find the next matching day of week
      if (parsed.byday.length > 0) {
        const targetDays = parsed.byday.map((d) => dayAbbrevToIndex[d.day]);
        let found = false;
        for (let i = 0; i < 14 * parsed.interval && !found; i++) {
          const checkDate = new Date(now);
          checkDate.setDate(now.getDate() + i);
          if (targetDays.includes(checkDate.getDay())) {
            candidate = checkDate;
            found = true;
          }
        }
      }
      break;

    case "MONTHLY":
      // Handle nth weekday of month (e.g., 2nd Tuesday)
      if (parsed.byday.length > 0 && parsed.byday[0].ordinal !== null) {
        const { ordinal, day } = parsed.byday[0];
        const targetDayIndex = dayAbbrevToIndex[day];

        // Check current month and next few months
        for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
          const checkMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
          const occurrence = getNthWeekdayOfMonth(checkMonth.getFullYear(), checkMonth.getMonth(), targetDayIndex, ordinal);
          if (occurrence && occurrence >= now) {
            candidate = occurrence;
            break;
          }
        }
      }
      break;

    case "DAILY":
      candidate = now;
      break;
  }

  return candidate;
}

/**
 * Get the nth weekday of a month
 * @param year - Year
 * @param month - Month (0-11)
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param n - Which occurrence (1=first, 2=second, -1=last, etc.)
 */
function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date | null {
  if (n > 0) {
    // Find nth occurrence from start of month
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) break; // Went past end of month
      if (date.getDay() === dayOfWeek) {
        count++;
        if (count === n) return date;
      }
    }
  } else if (n < 0) {
    // Find nth occurrence from end of month
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let day = lastDay; day >= 1; day--) {
      const date = new Date(year, month, day);
      if (date.getDay() === dayOfWeek) {
        count++;
        if (count === Math.abs(n)) return date;
      }
    }
  }
  return null;
}

/**
 * Convert a time string (HH:MM or ISO datetime) to human AM/PM like "7:30 PM".
 * Returns "NA" when not parseable or not provided (Phase 4.8 NA standardization).
 */
export function formatTimeToAMPM(time?: string | null): string {
  if (!time) return "NA";

  try {
    // If ISO datetime, split on 'T'
    const t = time.includes("T") ? time.split("T")[1] : time;
    const timeOnly = t.split("Z")[0].split("+")[0]; // remove timezone if present
    const parts = timeOnly.split(":");
    if (parts.length < 1) return "NA";
    const hh = parseInt(parts[0], 10);
    const mm = parts[1] ?? "00";
    if (Number.isNaN(hh)) return "NA";
    const ampm = hh >= 12 ? "PM" : "AM";
    const hour12 = ((hh + 11) % 12) + 1;
    const minutes = mm.padEnd(2, "0").slice(0, 2);
    return `${hour12}${minutes === "00" ? "" : `:${minutes}`} ${ampm}`.trim();
  } catch {
    return "NA";
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

  if (!day && !recurrence) return "Schedule TBD";

  const d = day ? capitalize(String(day).toLowerCase()) : null;

  // Try parsing as RRULE first
  const parsed = parseRRule(recurrence);
  if (parsed) {
    return humanizeParsedRRule(parsed, d);
  }

  // Fall back to simple text matching
  if (!recurrence) return d ? `Every ${d}` : "Schedule TBD";

  const r = String(recurrence).trim().toLowerCase();

  if (r === "weekly") return d ? `Every ${d}` : "Weekly";
  if (r === "biweekly" || r === "every other week") return d ? `Every Other ${d}` : "Every Other Week";
  if (r === "monthly") return d ? `Every ${d} (Monthly)` : "Monthly";
  if (r === "seasonal") return "Seasonal — check venue";
  if (r === "last") return d ? `Last ${d} of the Month` : "Last Week of Month";

  // ordinals like "1st", "2nd", "3rd", "4th"
  if (d && ORDINAL_MAP[r]) {
    return `${ORDINAL_MAP[r]} ${d} of the Month`;
  }

  // pairs like "1st/3rd" or "2nd/4th"
  if (d && r.includes("/")) {
    const parts = r.split("/").map((p) => p.trim().toLowerCase());
    const valid = parts.map((p) => ORDINAL_MAP[p]).filter(Boolean);
    if (valid.length >= 2) {
      return `${valid.join(" & ")} ${d}s`;
    }
  }

  return d ? `Every ${d}` : "Schedule TBD";
}

/**
 * Convert a parsed RRULE into human-readable text
 */
function humanizeParsedRRule(parsed: ParsedRRule, fallbackDay: string | null): string {
  const { freq, interval, byday } = parsed;

  // Get day names from BYDAY
  const dayNames = byday.map((d) => dayAbbrevToFull[d.day]).filter(Boolean);
  const ordinals = byday.filter((d) => d.ordinal !== null);

  switch (freq) {
    case "DAILY":
      if (interval === 1) return "Every Day";
      return `Every ${interval} Days`;

    case "WEEKLY":
      const dayDisplay = dayNames.length > 0 ? dayNames.join(", ") : fallbackDay || "Week";
      if (interval === 1) {
        return dayNames.length > 0 ? `Every ${dayDisplay}` : "Weekly";
      }
      if (interval === 2) {
        return `Every Other ${dayDisplay}`;
      }
      return `Every ${interval} Weeks on ${dayDisplay}`;

    case "MONTHLY":
      if (ordinals.length > 0) {
        // e.g., "1st and 3rd Tuesday"
        const parts = ordinals.map((d) => {
          const ordinalText = ordinalWords[String(d.ordinal)] || `${d.ordinal}th`;
          return `${ordinalText} ${dayAbbrevToFull[d.day] || d.day}`;
        });
        if (parts.length === 1) {
          return `${parts[0]} of the Month`;
        }
        return `${parts.join(" & ")} of the Month`;
      }
      if (dayNames.length > 0) {
        return `${dayNames.join(", ")} (Monthly)`;
      }
      if (interval === 1) return "Monthly";
      return `Every ${interval} Months`;

    case "YEARLY":
      if (interval === 1) return "Yearly";
      return `Every ${interval} Years`;

    default:
      return fallbackDay ? `Every ${fallbackDay}` : "Recurring";
  }
}

/**
 * Get a short recurrence summary suitable for Tier 2 pills on event cards.
 * This is the presentation-layer transformation for recurrence display.
 *
 * @param recurrenceRule - RRULE or simple text ("weekly", "1st", etc.)
 * @param dayOfWeek - Day of week from event (e.g., "Monday")
 * @param eventDate - Optional event_date for one-time events
 * @returns Plain-language summary: "One-time", "Every Monday", "First Tuesday of the Month", etc.
 */
export function getRecurrenceSummary(
  recurrenceRule: string | null | undefined,
  dayOfWeek: string | null | undefined,
  eventDate: string | null | undefined
): string {
  // One-time events: have an event_date but no recurrence or day_of_week pattern
  // OR: have event_date and no meaningful recurrence_rule
  if (eventDate && !recurrenceRule && !dayOfWeek) {
    return "One-time";
  }

  // If there's a recurrence rule or day_of_week, use humanizeRecurrence
  if (recurrenceRule || dayOfWeek) {
    const humanized = humanizeRecurrence(recurrenceRule ?? null, dayOfWeek ?? null);
    // Fallback if humanizeRecurrence returns empty or "Schedule TBD"
    if (!humanized || humanized === "Schedule TBD") {
      // If we have a day_of_week, at least show that pattern
      if (dayOfWeek) {
        return `Every ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1).toLowerCase()}`;
      }
      // If we have recurrence_rule but couldn't parse, show generic
      if (recurrenceRule) {
        return "Recurring";
      }
      // If we have an event_date as fallback, it's one-time
      if (eventDate) {
        return "One-time";
      }
      return "Recurring";
    }
    return humanized;
  }

  // If we have an event_date but nothing else, it's one-time
  if (eventDate) {
    return "One-time";
  }

  // Fallback
  return "Recurring";
}

// Named export for module consumers
export const recurrenceHumanizer = {
  humanizeRecurrence,
  formatTimeToAMPM,
  parseRRule,
  getNextOccurrence,
  getRecurrenceSummary,
  dayOrder,
};

export default recurrenceHumanizer;
