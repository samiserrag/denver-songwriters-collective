/**
 * Phase 4.42c: Unified Recurrence Contract
 *
 * This module provides a SINGLE source of truth for interpreting recurrence.
 * Both the generator (nextOccurrence.ts) and the label path (recurrenceHumanizer.ts)
 * MUST consume this contract. No independent interpretation allowed.
 *
 * INVARIANTS:
 * 1. A recurring event MUST expand to multiple occurrences (unless bounded by end rules)
 * 2. Labels MUST match what the generator produces
 * 3. day_of_week is descriptive only - never authoritative alone
 * 4. event_date defines the START of a series, not the ONLY date
 *
 * NOTE: This module intentionally duplicates parseRRule to avoid circular dependencies
 * with recurrenceHumanizer.ts which imports from this module.
 */

// Inline ParsedRRule type and parser to avoid circular dependency
interface ParsedRRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  interval: number;
  byday: Array<{ ordinal: number | null; day: string }>;
  bymonthday: number[];
  count: number | null;
  until: Date | null;
}

const dayAbbrevToFull: Record<string, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

/**
 * Parse an RFC 5545 RRULE string into components.
 * Duplicated here to avoid circular dependency with recurrenceHumanizer.
 */
function parseRRule(rrule: string | null): ParsedRRule | null {
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
 * Map full day names to RRULE-style abbreviations.
 */
const DAY_NAME_TO_ABBREV: Record<string, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
};

/**
 * Map legacy ordinal strings to numeric ordinals.
 */
const LEGACY_ORDINAL_TO_NUMBER: Record<string, number> = {
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
  "5th": 5,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  last: -1,
};

/**
 * Recurrence frequency types
 */
export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "daily" | "yearly" | "custom" | "one-time" | "unknown";

/**
 * Parsed recurrence rule in normalized form.
 * This is the CANONICAL representation that both generator and label path use.
 */
export interface NormalizedRecurrence {
  /** Whether this is a recurring event */
  isRecurring: boolean;
  /** Recurrence frequency */
  frequency: RecurrenceFrequency;
  /** Day of week index (0=Sunday, 6=Saturday), null for one-time or unknown */
  dayOfWeekIndex: number | null;
  /** Day of week abbreviation (SU, MO, TU, etc.), null for one-time or unknown */
  dayAbbrev: string | null;
  /** Day of week full name (Sunday, Monday, etc.), null for one-time or unknown */
  dayName: string | null;
  /** For monthly patterns: ordinal positions (1=first, 2=second, -1=last, etc.) */
  ordinals: number[];
  /** Interval (1=every, 2=every other, etc.) */
  interval: number;
  /** Start date (YYYY-MM-DD) if specified */
  startDate: string | null;
  /** End date (YYYY-MM-DD) if specified */
  endDate: string | null;
  /** Count limit if specified */
  count: number | null;
  /** Original parsed RRULE if applicable */
  parsedRRule: ParsedRRule | null;
  /** Confidence: can we reliably compute occurrences? */
  isConfident: boolean;
}

/**
 * Input for recurrence interpretation - minimal event fields needed.
 */
export interface RecurrenceInput {
  event_date?: string | null;
  day_of_week?: string | null;
  recurrence_rule?: string | null;
  recurrence_end_date?: string | null;
}

/**
 * Check if a recurrence rule is a multi-ordinal pattern.
 */
function isMultiOrdinalPattern(rule: string | null | undefined): boolean {
  if (!rule) return false;
  const r = rule.toLowerCase().trim();
  if (r.includes("/") || r.includes("&") || r.includes(",")) return true;
  if (/\band\b/.test(r)) return true;
  const ordinalMatches = r.match(/\b(1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth|last)\b/g);
  if (ordinalMatches && ordinalMatches.length > 1) return true;
  return false;
}

/**
 * Parse multi-ordinal legacy format like "2nd/3rd", "1st & 3rd".
 */
function parseMultiOrdinal(rule: string): number[] {
  const r = rule.toLowerCase().trim();
  const parts = r.split(/[\/&,]|\band\b/).map((p) => p.trim()).filter(Boolean);
  const ordinals: number[] = [];
  for (const part of parts) {
    const ordinal = LEGACY_ORDINAL_TO_NUMBER[part];
    if (ordinal !== undefined) {
      ordinals.push(ordinal);
    }
  }
  return ordinals;
}

/**
 * Get the day of week index for a date string.
 */
function getDayOfWeekFromDate(dateStr: string): { index: number; abbrev: string; name: string } | null {
  try {
    const date = new Date(`${dateStr}T12:00:00`);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayAbbrevs = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const index = date.getUTCDay();
    return {
      index,
      abbrev: dayAbbrevs[index],
      name: dayNames[index],
    };
  } catch {
    return null;
  }
}

/**
 * Interpret recurrence from event fields.
 *
 * This is the SINGLE source of truth. Both:
 * - nextOccurrence.ts (generator)
 * - recurrenceHumanizer.ts (label)
 *
 * MUST use this function to interpret recurrence.
 *
 * @param input - Event fields relevant to recurrence
 * @returns Normalized recurrence interpretation
 */
export function interpretRecurrence(input: RecurrenceInput): NormalizedRecurrence {
  const { event_date, day_of_week, recurrence_rule, recurrence_end_date } = input;

  // Try parsing as RRULE first
  const parsedRRule = parseRRule(recurrence_rule ?? null);

  // Default result for unknown/one-time
  const baseResult: NormalizedRecurrence = {
    isRecurring: false,
    frequency: "one-time",
    dayOfWeekIndex: null,
    dayAbbrev: null,
    dayName: null,
    ordinals: [],
    interval: 1,
    startDate: event_date ?? null,
    endDate: recurrence_end_date ?? null,
    count: null,
    parsedRRule: null,
    isConfident: true,
  };

  // Case 1: RRULE parsing succeeded
  if (parsedRRule) {
    return interpretFromRRule(parsedRRule, input, baseResult);
  }

  // Case 2: Legacy text-based recurrence_rule
  if (recurrence_rule) {
    return interpretLegacyRule(recurrence_rule, input, baseResult);
  }

  // Case 3: day_of_week only (no recurrence_rule) - treat as weekly
  if (day_of_week) {
    const dayLower = day_of_week.toLowerCase().trim();
    const dayAbbrev = DAY_NAME_TO_ABBREV[dayLower];
    if (dayAbbrev) {
      const dayIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(dayAbbrev);
      return {
        ...baseResult,
        isRecurring: true,
        frequency: "weekly",
        dayOfWeekIndex: dayIndex,
        dayAbbrev,
        dayName: day_of_week.charAt(0).toUpperCase() + day_of_week.slice(1).toLowerCase(),
        startDate: event_date ?? null,
      };
    }
  }

  // Case 4: event_date only (no recurrence) - one-time event
  if (event_date) {
    const dayInfo = getDayOfWeekFromDate(event_date);
    return {
      ...baseResult,
      isRecurring: false,
      frequency: "one-time",
      dayOfWeekIndex: dayInfo?.index ?? null,
      dayAbbrev: dayInfo?.abbrev ?? null,
      dayName: dayInfo?.name ?? null,
      startDate: event_date,
    };
  }

  // Case 5: Nothing specified - unknown
  return {
    ...baseResult,
    frequency: "unknown",
    isConfident: false,
  };
}

/**
 * Interpret from a parsed RRULE.
 */
function interpretFromRRule(
  parsed: ParsedRRule,
  input: RecurrenceInput,
  base: NormalizedRecurrence
): NormalizedRecurrence {
  const { event_date, day_of_week } = input;

  // Determine day info - prefer BYDAY from RRULE, fall back to day_of_week field
  let dayInfo: { index: number; abbrev: string; name: string } | null = null;
  let ordinals: number[] = [];

  if (parsed.byday.length > 0) {
    const firstByday = parsed.byday[0];
    const dayIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(firstByday.day);
    if (dayIndex >= 0) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      dayInfo = { index: dayIndex, abbrev: firstByday.day, name: dayNames[dayIndex] };
    }
    // Collect ordinals from BYDAY entries
    ordinals = parsed.byday
      .filter((d) => d.ordinal !== null)
      .map((d) => d.ordinal!);
  } else if (day_of_week) {
    const dayLower = day_of_week.toLowerCase().trim();
    const abbrev = DAY_NAME_TO_ABBREV[dayLower];
    if (abbrev) {
      const dayIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(abbrev);
      dayInfo = {
        index: dayIndex,
        abbrev,
        name: day_of_week.charAt(0).toUpperCase() + day_of_week.slice(1).toLowerCase(),
      };
    }
  }

  // Map RRULE frequency to our types
  let frequency: RecurrenceFrequency;
  switch (parsed.freq) {
    case "DAILY":
      frequency = "daily";
      break;
    case "WEEKLY":
      frequency = parsed.interval === 2 ? "biweekly" : "weekly";
      break;
    case "MONTHLY":
      frequency = "monthly";
      break;
    case "YEARLY":
      frequency = "yearly";
      break;
    default:
      frequency = "unknown";
  }

  return {
    ...base,
    // frequency from RRULE is always recurring unless "unknown"
    isRecurring: frequency !== "unknown",
    frequency,
    dayOfWeekIndex: dayInfo?.index ?? null,
    dayAbbrev: dayInfo?.abbrev ?? null,
    dayName: dayInfo?.name ?? null,
    ordinals,
    interval: parsed.interval,
    startDate: event_date ?? null,
    endDate: parsed.until ? parsed.until.toISOString().split("T")[0] : base.endDate,
    count: parsed.count,
    parsedRRule: parsed,
    isConfident: dayInfo !== null || frequency === "daily",
  };
}

/**
 * Interpret legacy text-based recurrence rules.
 */
function interpretLegacyRule(
  rule: string,
  input: RecurrenceInput,
  base: NormalizedRecurrence
): NormalizedRecurrence {
  const { event_date, day_of_week } = input;
  const r = rule.toLowerCase().trim();

  // Get day info from day_of_week field
  let dayInfo: { index: number; abbrev: string; name: string } | null = null;
  if (day_of_week) {
    const dayLower = day_of_week.toLowerCase().trim();
    const abbrev = DAY_NAME_TO_ABBREV[dayLower];
    if (abbrev) {
      const dayIndex = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(abbrev);
      dayInfo = {
        index: dayIndex,
        abbrev,
        name: day_of_week.charAt(0).toUpperCase() + day_of_week.slice(1).toLowerCase(),
      };
    }
  }

  // Phase 4.83: Defensive fallback - if day_of_week is missing but event_date exists,
  // derive the day from the anchor date. This is a render-time safety net for events
  // that somehow got saved without day_of_week. Server-side canonicalization should
  // prevent this, but this fallback ensures correct display even for legacy data.
  if (!dayInfo && event_date) {
    dayInfo = getDayOfWeekFromDate(event_date);
  }

  // "none" or empty - if we have a day, it's weekly
  if (r === "none" || r === "") {
    if (dayInfo) {
      return {
        ...base,
        isRecurring: true,
        frequency: "weekly",
        dayOfWeekIndex: dayInfo.index,
        dayAbbrev: dayInfo.abbrev,
        dayName: dayInfo.name,
        startDate: event_date ?? null,
      };
    }
    // No day info - treat as one-time if we have event_date
    if (event_date) {
      const dateDay = getDayOfWeekFromDate(event_date);
      return {
        ...base,
        isRecurring: false,
        frequency: "one-time",
        dayOfWeekIndex: dateDay?.index ?? null,
        dayAbbrev: dateDay?.abbrev ?? null,
        dayName: dateDay?.name ?? null,
        startDate: event_date,
      };
    }
    return { ...base, frequency: "unknown", isConfident: false };
  }

  // "weekly"
  if (r === "weekly") {
    return {
      ...base,
      isRecurring: true,
      frequency: "weekly",
      dayOfWeekIndex: dayInfo?.index ?? null,
      dayAbbrev: dayInfo?.abbrev ?? null,
      dayName: dayInfo?.name ?? null,
      startDate: event_date ?? null,
      isConfident: dayInfo !== null,
    };
  }

  // "biweekly" or "every other week"
  if (r === "biweekly" || r === "every other week") {
    return {
      ...base,
      isRecurring: true,
      frequency: "biweekly",
      interval: 2,
      dayOfWeekIndex: dayInfo?.index ?? null,
      dayAbbrev: dayInfo?.abbrev ?? null,
      dayName: dayInfo?.name ?? null,
      startDate: event_date ?? null,
      isConfident: dayInfo !== null,
    };
  }

  // "custom" - custom dates series (dates stored in custom_dates column)
  if (r === "custom") {
    return {
      ...base,
      isRecurring: true,
      frequency: "custom",
      startDate: event_date ?? null,
      isConfident: true,
    };
  }

  // "monthly"
  if (r === "monthly") {
    return {
      ...base,
      isRecurring: true,
      frequency: "monthly",
      dayOfWeekIndex: dayInfo?.index ?? null,
      dayAbbrev: dayInfo?.abbrev ?? null,
      dayName: dayInfo?.name ?? null,
      startDate: event_date ?? null,
      isConfident: dayInfo !== null,
    };
  }

  // "seasonal"
  if (r === "seasonal") {
    return {
      ...base,
      isRecurring: true,
      frequency: "unknown",
      isConfident: false,
    };
  }

  // Multi-ordinal patterns: "1st/3rd", "2nd & 4th", etc.
  if (isMultiOrdinalPattern(r)) {
    const ordinals = parseMultiOrdinal(r);
    if (ordinals.length > 0 && dayInfo) {
      return {
        ...base,
        isRecurring: true,
        frequency: "monthly",
        dayOfWeekIndex: dayInfo.index,
        dayAbbrev: dayInfo.abbrev,
        dayName: dayInfo.name,
        ordinals,
        startDate: event_date ?? null,
      };
    }
    // Couldn't parse fully
    return { ...base, isRecurring: true, frequency: "monthly", isConfident: false };
  }

  // Single ordinal: "1st", "2nd", "3rd", "4th", "last"
  const singleOrdinal = LEGACY_ORDINAL_TO_NUMBER[r];
  if (singleOrdinal !== undefined) {
    return {
      ...base,
      isRecurring: true,
      frequency: "monthly",
      dayOfWeekIndex: dayInfo?.index ?? null,
      dayAbbrev: dayInfo?.abbrev ?? null,
      dayName: dayInfo?.name ?? null,
      ordinals: [singleOrdinal],
      startDate: event_date ?? null,
      isConfident: dayInfo !== null,
    };
  }

  // Fallback: if we have a day, assume weekly
  if (dayInfo) {
    return {
      ...base,
      isRecurring: true,
      frequency: "weekly",
      dayOfWeekIndex: dayInfo.index,
      dayAbbrev: dayInfo.abbrev,
      dayName: dayInfo.name,
      startDate: event_date ?? null,
    };
  }

  // Unknown
  return { ...base, frequency: "unknown", isConfident: false };
}

/**
 * Generate a human-readable label from normalized recurrence.
 * This ensures labels ALWAYS match what the generator produces.
 */
export function labelFromRecurrence(rec: NormalizedRecurrence): string {
  if (!rec.isRecurring) {
    return rec.frequency === "one-time" ? "One-time" : "Schedule TBD";
  }

  const dayName = rec.dayName;

  switch (rec.frequency) {
    case "weekly":
      return dayName ? `Every ${dayName}` : "Weekly";

    case "biweekly":
      return dayName ? `Every Other ${dayName}` : "Every Other Week";

    case "monthly":
      if (rec.ordinals.length > 0 && dayName) {
        const ordinalWords: Record<number, string> = {
          1: "1st",
          2: "2nd",
          3: "3rd",
          4: "4th",
          5: "5th",
          "-1": "Last",
        };
        if (rec.ordinals.length === 1) {
          const ordText = ordinalWords[rec.ordinals[0]] || `${rec.ordinals[0]}th`;
          return `${ordText} ${dayName} of the Month`;
        }
        // Multiple ordinals
        const ordTexts = rec.ordinals.map((o) => ordinalWords[o] || `${o}th`);
        return `${ordTexts.join(" & ")} ${dayName}s`;
      }
      return dayName ? `${dayName} (Monthly)` : "Monthly";

    case "daily":
      return rec.interval === 1 ? "Every Day" : `Every ${rec.interval} Days`;

    case "yearly":
      return rec.interval === 1 ? "Yearly" : `Every ${rec.interval} Years`;

    case "custom":
      return "Custom Schedule";

    default:
      return dayName ? `Every ${dayName}` : "Recurring";
  }
}

/**
 * Check if a recurrence should expand to multiple occurrences.
 * Used for invariant enforcement.
 */
export function shouldExpandToMultiple(rec: NormalizedRecurrence): boolean {
  return rec.isRecurring && rec.isConfident;
}

// ============================================================================
// Phase 4.86: Centralized ordinal<->string conversion for preview consistency
// ============================================================================

/**
 * Map numeric ordinals to canonical string format.
 * This is the INVERSE of LEGACY_ORDINAL_TO_NUMBER and must be kept in sync.
 */
const NUMBER_TO_ORDINAL: Record<number, string> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
  4: "4th",
  5: "5th",
  [-1]: "last",
};

/**
 * Build a recurrence_rule string from numeric ordinals.
 * This is the single source of truth for converting form state to DB format.
 *
 * @param ordinals - Array of numeric ordinals (1-5 or -1 for last)
 * @returns Canonical recurrence_rule string (e.g., "4th", "1st/3rd", "2nd/last")
 */
export function buildRecurrenceRuleFromOrdinals(ordinals: number[]): string {
  if (ordinals.length === 0) return "";

  // Sort with "last" (-1) always at the end
  const sorted = [...ordinals].sort((a, b) => {
    if (a === -1) return 1;
    if (b === -1) return -1;
    return a - b;
  });

  return sorted.map(o => NUMBER_TO_ORDINAL[o] || `${o}th`).join("/");
}

/**
 * Parse a recurrence_rule string into numeric ordinals.
 * This is the single source of truth for extracting ordinals from DB format.
 *
 * @param rule - recurrence_rule string (e.g., "4th", "1st/3rd", "2nd and 4th")
 * @returns Array of numeric ordinals, empty if not a monthly ordinal pattern
 */
export function parseOrdinalsFromRecurrenceRule(rule: string | null | undefined): number[] {
  if (!rule) return [];

  const r = rule.toLowerCase().trim();

  // Skip non-ordinal patterns
  if (r === "weekly" || r === "biweekly" || r === "custom" || r === "monthly" || r === "none" || r === "") {
    return [];
  }

  // Split on common separators: /, &, "and", comma
  const parts = r.split(/[\/&,]|\band\b/).map(p => p.trim()).filter(Boolean);
  const ordinals: number[] = [];

  for (const part of parts) {
    const ordinal = LEGACY_ORDINAL_TO_NUMBER[part];
    if (ordinal !== undefined) {
      ordinals.push(ordinal);
    }
  }

  return ordinals;
}

/**
 * Development/test invariant check: warn if a recurring event only produced one occurrence.
 * This catches the exact bug class we're fixing.
 *
 * NOTE: Does NOT warn when:
 * - Event has explicit count or endDate bounds
 * - Window is too small (< 14 days) to expect multiple occurrences
 * - This is a test environment with intentionally small windows
 */
export function assertRecurrenceInvariant(
  rec: NormalizedRecurrence,
  occurrenceCount: number,
  eventId?: string,
  windowDays?: number
): void {
  // Skip check for bounded events (count or endDate set)
  if (rec.count || rec.endDate) return;

  // Skip check for small windows (likely test scenarios)
  // Weekly events need at least 7 days, biweekly at least 14
  const minWindow = rec.frequency === "biweekly" ? 14 : rec.frequency === "monthly" ? 28 : 7;
  if (windowDays !== undefined && windowDays < minWindow) return;

  // Only warn if this should have produced multiple but didn't
  if (shouldExpandToMultiple(rec) && occurrenceCount === 1) {
    const warning = `[RECURRENCE INVARIANT VIOLATION] Event ${eventId ?? "unknown"} is recurring (${rec.frequency}) but only produced 1 occurrence. This indicates a generator bug.`;
    if (process.env.NODE_ENV === "development") {
      console.error(warning);
    }
    // In production/test, just warn (don't spam test output)
    if (process.env.NODE_ENV !== "test") {
      console.warn(warning);
    }
  }
}
