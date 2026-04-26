import { parseRRule } from "@/lib/recurrenceHumanizer";
import { addDaysDenver, denverDateKeyFromDate } from "@/lib/events/nextOccurrence";

type Draft = Record<string, unknown>;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_ABBREV_TO_NAME: Record<string, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};
const DAY_ABBREV_TO_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function normalizeDateList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && DATE_KEY_PATTERN.test(v)))]
    .sort()
    .slice(0, limit);
}

function getAnchorDate(draft: Draft): string | null {
  const start = typeof draft.start_date === "string" && DATE_KEY_PATTERN.test(draft.start_date)
    ? draft.start_date
    : null;
  const event = typeof draft.event_date === "string" && DATE_KEY_PATTERN.test(draft.event_date)
    ? draft.event_date
    : null;
  return start ?? event;
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function dateKey(year: number, monthIndex: number, day: number): string | null {
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  if (date.getUTCMonth() !== monthIndex) return null;
  return denverDateKeyFromDate(date);
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekdayIndex: number, ordinal: number): string | null {
  if (ordinal > 0) {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const key = dateKey(year, monthIndex, day);
      if (!key) break;
      if (dateFromKey(key).getUTCDay() === weekdayIndex) {
        count++;
        if (count === ordinal) return key;
      }
    }
  }

  if (ordinal < 0) {
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
    let count = 0;
    for (let day = lastDay; day >= 1; day--) {
      const key = dateKey(year, monthIndex, day);
      if (key && dateFromKey(key).getUTCDay() === weekdayIndex) {
        count++;
        if (count === Math.abs(ordinal)) return key;
      }
    }
  }

  return null;
}

function daysBetween(startKey: string, endKey: string): number {
  const start = dateFromKey(startKey).getTime();
  const end = dateFromKey(endKey).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function expandRRuleToCustomDates(rule: string, anchorDate: string, limit = 12): string[] {
  const parsed = parseRRule(rule);
  if (!parsed) return [];

  const dates: string[] = [];
  const add = (key: string | null) => {
    if (key && key >= anchorDate && !dates.includes(key)) dates.push(key);
  };

  if (parsed.freq === "DAILY") {
    let current = anchorDate;
    while (dates.length < limit) {
      add(current);
      current = addDaysDenver(current, parsed.interval);
    }
    return dates;
  }

  if (parsed.freq === "WEEKLY") {
    const dayIndexes = parsed.byday
      .map((entry) => DAY_ABBREV_TO_INDEX[entry.day])
      .filter((index): index is number => typeof index === "number")
      .sort((a, b) => a - b);
    if (dayIndexes.length === 0) return [];

    let current = anchorDate;
    for (let i = 0; i < 730 && dates.length < limit; i++) {
      const dayIndex = dateFromKey(current).getUTCDay();
      const weekOffset = Math.floor(daysBetween(anchorDate, current) / 7);
      if (dayIndexes.includes(dayIndex) && weekOffset % parsed.interval === 0) {
        add(current);
      }
      current = addDaysDenver(current, 1);
    }
    return dates;
  }

  if (parsed.freq === "MONTHLY") {
    const anchor = dateFromKey(anchorDate);
    for (let monthOffset = 0; monthOffset < 36 && dates.length < limit; monthOffset++) {
      if (monthOffset % parsed.interval !== 0) continue;
      const month = addMonths(anchor, monthOffset);
      const year = month.getUTCFullYear();
      const monthIndex = month.getUTCMonth();

      if (parsed.byday.length > 0) {
        for (const entry of parsed.byday) {
          const weekdayIndex = DAY_ABBREV_TO_INDEX[entry.day];
          if (weekdayIndex === undefined || entry.ordinal === null) continue;
          add(nthWeekdayOfMonth(year, monthIndex, weekdayIndex, entry.ordinal));
        }
      }

      for (const monthDay of parsed.bymonthday) {
        add(dateKey(year, monthIndex, monthDay));
      }
    }
    return dates.sort().slice(0, limit);
  }

  if (parsed.freq === "YEARLY") {
    const anchor = dateFromKey(anchorDate);
    for (let offset = 0; offset < limit; offset++) {
      const year = anchor.getUTCFullYear() + offset * parsed.interval;
      add(dateKey(year, anchor.getUTCMonth(), anchor.getUTCDate()));
    }
    return dates;
  }

  return [];
}

function normalizeMonthlyBySetPos(rule: string): string {
  const bydayThenSetpos = rule.match(/^FREQ=MONTHLY;BYDAY=([A-Z]{2});BYSETPOS=(-?\d+)$/i);
  if (bydayThenSetpos) {
    return `FREQ=MONTHLY;BYDAY=${bydayThenSetpos[2]}${bydayThenSetpos[1].toUpperCase()}`;
  }

  const setposThenByday = rule.match(/^FREQ=MONTHLY;BYSETPOS=(-?\d+);BYDAY=([A-Z]{2})$/i);
  if (setposThenByday) {
    return `FREQ=MONTHLY;BYDAY=${setposThenByday[1]}${setposThenByday[2].toUpperCase()}`;
  }

  return rule;
}

function applyCustomDates(draft: Draft, dates: string[]): void {
  if (dates.length === 0) return;
  draft.series_mode = "custom";
  draft.recurrence_rule = "custom";
  draft.custom_dates = dates;
  draft.start_date = dates[0];
  draft.event_date = dates[0];
}

export function normalizeDraftRecurrenceFields(draft: Draft, options?: { customDateLimit?: number }): Draft {
  const limit = options?.customDateLimit ?? 12;
  const customDates = normalizeDateList(draft.custom_dates, limit);
  if (customDates.length > 0) {
    applyCustomDates(draft, customDates);
    return draft;
  }

  if (typeof draft.recurrence_rule !== "string" || !draft.recurrence_rule.trim()) {
    if (draft.series_mode === "recurring") draft.series_mode = "single";
    return draft;
  }

  const rule = normalizeMonthlyBySetPos(draft.recurrence_rule.trim());
  draft.recurrence_rule = rule;

  const parsed = parseRRule(rule);
  if (!parsed) {
    const legacy = rule.toLowerCase();
    if (legacy === "weekly" || legacy === "biweekly" || legacy === "monthly" || legacy === "custom") {
      draft.series_mode = legacy;
    }
    return draft;
  }

  const anchorDate = getAnchorDate(draft);
  const firstByday = parsed.byday[0];

  if (parsed.freq === "WEEKLY" && parsed.byday.length === 1 && parsed.interval <= 2 && firstByday) {
    draft.series_mode = parsed.interval === 2 ? "biweekly" : "weekly";
    draft.day_of_week = DAY_ABBREV_TO_NAME[firstByday.day] ?? draft.day_of_week;
    return draft;
  }

  if (
    parsed.freq === "MONTHLY" &&
    parsed.byday.length > 0 &&
    parsed.byday.every((entry) => entry.ordinal !== null && entry.day === firstByday?.day)
  ) {
    draft.series_mode = "monthly";
    if (firstByday) draft.day_of_week = DAY_ABBREV_TO_NAME[firstByday.day] ?? draft.day_of_week;
    return draft;
  }

  if (anchorDate) {
    const generatedDates = expandRRuleToCustomDates(rule, anchorDate, limit);
    if (generatedDates.length > 0) {
      applyCustomDates(draft, generatedDates);
      return draft;
    }
  }

  draft.series_mode = "custom";
  return draft;
}
