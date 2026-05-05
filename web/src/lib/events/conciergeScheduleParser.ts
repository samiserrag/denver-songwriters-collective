/**
 * Concierge deterministic schedule parser — Lane 9 PR 2.
 *
 * Pure function: takes a `ConciergeInput`, returns a `ConciergeIR`. No I/O,
 * no network, no LLM call. Deterministic across runs.
 *
 * Handles the five page-text shapes enumerated in the design doc §3:
 *   1. Date-then-times block (`Wednesday, May 6: 6:00 - 9:00 pm Buffalo Lodge`
 *      followed by indented time-slot lines).
 *   2. Repeating header (multiple date-headed blocks under one venue line).
 *   3. Slot table (rows are time slots, columns are date / performer / start /
 *      end).
 *   4. Single-event flyer text (one date, one time, one venue).
 *   5. Pure conversation (free-text host message with no schedule shape).
 *
 * If a shape is unrecognized, the parser populates whatever fields it
 * confidently extracted and leaves the rest `null` / empty. The validator is
 * responsible for deciding whether the draft is shippable.
 */

import {
  emptyConciergeIR,
  type ConciergeIR,
  type ConciergeInferredFact,
  type ConciergeInput,
  type ConciergeOccurrence,
  type ConciergeProvenanceEntry,
} from "@/lib/events/conciergeIR";

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const STATE_ABBREVIATIONS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const STREET_SUFFIX_PATTERN =
  /\b(?:Blvd|Boulevard|St|Street|Ave|Avenue|Rd|Road|Pkwy|Parkway|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Hwy|Highway|Way|Ter|Terrace|Trl|Trail|Cir|Circle|Sq|Square)\b\.?/i;

const ADDRESS_LINE_PATTERN =
  /^\s*(\d+\s+[\w'&\-]+(?:\s+[\w'&\-]+)*\s+(?:Blvd|Boulevard|St|Street|Ave|Avenue|Rd|Road|Pkwy|Parkway|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Hwy|Highway|Way|Ter|Terrace|Trl|Trail|Cir|Circle|Sq|Square)\b\.?)(?:\s*,\s*([\w \-']+?))?(?:\s*,\s*([A-Z]{2}))?(?:\s*(\d{5}(?:-\d{4})?))?\s*$/i;

// e.g. `Wednesday, May 6: 6:00 - 9:00 pm` or `May 6 — 6 to 9 pm` or `5/6/2026`.
const DATE_HEADER_WORD_PATTERN =
  /^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat)(?:day|nesday|sday|urday)?,?\s*)?(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?\b/i;

const DATE_HEADER_NUMERIC_PATTERN =
  /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

// Match "6:00 - 9:00 pm", "6:30-7:00pm", "6 to 9 pm", with optional am/pm on either side.
const TIME_RANGE_PATTERN =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

// Match a single time like "6:00 pm".
const SINGLE_TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

// Time slot lines that look like `6:30 - 7:00 pm — Performer Name` (em / en
// dash, hyphen, or colon separator before the performer).
const TIME_SLOT_LINE_PATTERN =
  /^[\s\-•·*]*((?:\d{1,2})(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|—|to)\s*(?:\d{1,2})(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|:|\|)?\s*(.*)$/i;

// Cost / signup / membership / age policy hints.
const COST_HINT_PATTERN = /(\$\d[\d.]*(?:\s*(?:suggested|donation|cover|cash|members?|non-?members?))?|free\s+(?:entry|admission|to\s+attend|with\s+rsvp)?|donation\s+based|pay\s+what\s+you\s+can)/i;
const SIGNUP_HINT_PATTERN = /(sign[\s-]?ups?|sign\s+up\s+at|open\s+mic\s+sign[\s-]?up)/i;
const MEMBERSHIP_HINT_PATTERN = /(members?\s*\$|non-?members?|membership\s+\$|members?\s+free|members?\s+only)/i;
const AGE_POLICY_PATTERN = /\b(all\s+ages|21\+|18\+|family\s+friendly|kids\s+welcome)\b/i;

const SCHEDULE_TABLE_HEADER_PATTERN =
  /\b(?:date|day)\s*[\t|]+\s*(?:time|start)\s*[\t|]*\s*(?:performer|artist|act|name)?\s*[\t|]*/i;

const HOST_PROVIDED_VENUE_PATTERN =
  /\b(?:at|@|venue:?)\s*(.+?)(?:[,;]|$)/i;

const URL_DOMAIN_PATTERN = /^https?:\/\/([^\/]+)/i;

type ParsedDate = { year: number; month: number; day: number };

type DateHeaderMatch = {
  iso: string;
  sharedStart: string | null;
  sharedEnd: string | null;
  remainder: string;
};

type AddressMatch = {
  address: string;
  city: string | null;
  state: string | null;
};

type TimeSlotMatch = {
  start: string | null;
  end: string | null;
  remainder: string;
};

function todayParts(today_iso: string | null | undefined): ParsedDate {
  if (today_iso && /^\d{4}-\d{2}-\d{2}$/.test(today_iso)) {
    return {
      year: Number(today_iso.slice(0, 4)),
      month: Number(today_iso.slice(5, 7)),
      day: Number(today_iso.slice(8, 10)),
    };
  }
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(p: ParsedDate): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function compareParsed(a: ParsedDate, b: ParsedDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function normalizeLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));
}

function compactWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function to24Hour(hour: number, minute: number, meridiem: string | null | undefined): string {
  let h = hour % 12;
  if ((meridiem ?? "").toLowerCase() === "pm") h += 12;
  if (!meridiem && hour === 12) h = 12;
  return `${pad2(h)}:${pad2(minute)}`;
}

function inferMeridiem(
  startMer: string | null | undefined,
  endMer: string | null | undefined,
  startHour: number,
  endHour: number,
): { startMer: string; endMer: string } {
  const knownEnd = endMer ?? null;
  const knownStart = startMer ?? null;
  if (knownStart && knownEnd) return { startMer: knownStart, endMer: knownEnd };
  if (knownEnd) {
    const start = startHour >= endHour && knownEnd === "pm" ? "am" : knownEnd;
    return { startMer: start, endMer: knownEnd };
  }
  if (knownStart) return { startMer: knownStart, endMer: knownStart };
  // No meridiem at all — assume PM if both hours are <= 12 and start < end (typical evening event).
  return { startMer: "pm", endMer: "pm" };
}

function parseTimeRange(text: string): { start: string; end: string | null } | null {
  const m = TIME_RANGE_PATTERN.exec(text);
  if (!m) return null;
  const startHour = Number(m[1]);
  const startMin = m[2] ? Number(m[2]) : 0;
  const startMer = m[3] ?? null;
  const endHour = Number(m[4]);
  const endMin = m[5] ? Number(m[5]) : 0;
  const endMer = m[6] ?? null;
  const meridiems = inferMeridiem(startMer, endMer, startHour, endHour);
  return {
    start: to24Hour(startHour, startMin, meridiems.startMer),
    end: to24Hour(endHour, endMin, meridiems.endMer),
  };
}

function parseSingleTime(text: string): string | null {
  const m = SINGLE_TIME_PATTERN.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3] ?? null;
  return to24Hour(hour, min, mer);
}

function parseDateHeader(line: string, today: ParsedDate): DateHeaderMatch | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const wordMatch = DATE_HEADER_WORD_PATTERN.exec(trimmed);
  let parsed: ParsedDate | null = null;
  let remainder = "";
  if (wordMatch) {
    const monthKey = wordMatch[1].toLowerCase().replace(/\.$/, "");
    const month = MONTH_NAMES[monthKey];
    const day = Number(wordMatch[2]);
    let year = wordMatch[3] ? Number(wordMatch[3]) : today.year;
    if (!month || !day) return null;
    if (!wordMatch[3]) {
      const candidate = { year, month, day };
      // If the candidate date is before today by month/day, advance year.
      if (compareParsed(candidate, today) < 0) {
        year = today.year + 1;
      }
    }
    parsed = { year, month, day };
    remainder = trimmed.slice(wordMatch[0].length);
  } else {
    const numericMatch = DATE_HEADER_NUMERIC_PATTERN.exec(trimmed);
    if (numericMatch) {
      const month = Number(numericMatch[1]);
      const day = Number(numericMatch[2]);
      let year = today.year;
      if (numericMatch[3]) {
        const yr = Number(numericMatch[3]);
        year = yr < 100 ? 2000 + yr : yr;
      } else {
        const candidate = { year, month, day };
        if (compareParsed(candidate, today) < 0) year = today.year + 1;
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      parsed = { year, month, day };
      remainder = trimmed.slice(numericMatch[0].length);
    }
  }

  if (!parsed) return null;

  // The remainder may contain a shared time range and / or a venue snippet.
  const remainderClean = remainder.replace(/^[\s:|—–\-]+/, "");
  const range = parseTimeRange(remainderClean);
  return {
    iso: toIso(parsed),
    sharedStart: range?.start ?? null,
    sharedEnd: range?.end ?? null,
    remainder: remainderClean,
  };
}

function parseAddressLine(line: string): AddressMatch | null {
  const m = ADDRESS_LINE_PATTERN.exec(line.trim());
  if (!m) return null;
  const address = compactWhitespace(m[1]);
  const city = m[2] ? compactWhitespace(m[2]) : null;
  const state = m[3] && STATE_ABBREVIATIONS.has(m[3].toUpperCase()) ? m[3].toUpperCase() : null;
  return { address, city, state };
}

function parseTimeSlotLine(line: string): TimeSlotMatch | null {
  const m = TIME_SLOT_LINE_PATTERN.exec(line.trim());
  if (!m) return null;
  const range = parseTimeRange(m[1]);
  if (!range) return null;
  const remainder = compactWhitespace(m[2] ?? "");
  // If the remainder is empty or itself looks like a date header, this isn't a slot.
  if (!remainder || DATE_HEADER_WORD_PATTERN.test(remainder) || DATE_HEADER_NUMERIC_PATTERN.test(remainder)) {
    return null;
  }
  return { start: range.start, end: range.end, remainder };
}

function recordProvenance(
  ir: ConciergeIR,
  field: string,
  pointer: string,
  evidence: string,
): void {
  const entry: ConciergeProvenanceEntry = {
    source_pointer: pointer,
    evidence_text: compactWhitespace(evidence).slice(0, 240),
  };
  if (!ir.provenance[field]) {
    ir.provenance[field] = entry;
  }
}

function noteInferredFact(
  ir: ConciergeIR,
  field: string,
  value: unknown,
  basis: string,
): void {
  const entry: ConciergeInferredFact = { field, value, basis };
  ir.inferred_facts.push(entry);
}

function detectDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = URL_DOMAIN_PATTERN.exec(url);
  return m ? m[1].replace(/^www\./, "") : null;
}

function detectVenueLine(line: string): string | null {
  // Heuristic: a venue line is short, capitalized, no time / date markers, no
  // street suffix (those are addresses). Up to 8 words.
  const trimmed = compactWhitespace(line);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  if (DATE_HEADER_WORD_PATTERN.test(trimmed)) return null;
  if (DATE_HEADER_NUMERIC_PATTERN.test(trimmed)) return null;
  if (TIME_RANGE_PATTERN.test(trimmed)) return null;
  if (STREET_SUFFIX_PATTERN.test(trimmed)) return null;
  if (/^\d/.test(trimmed)) return null;
  if (/[@:]\s*$/.test(trimmed)) return null;
  if (trimmed.split(/\s+/).length > 8) return null;
  // Must start with a letter and contain at least one word with a capital.
  if (!/^[A-Za-z]/.test(trimmed)) return null;
  if (!/[A-Z]/.test(trimmed)) return null;
  return trimmed;
}

function detectExplicitVenueMention(line: string): string | null {
  const m = HOST_PROVIDED_VENUE_PATTERN.exec(line);
  if (!m) return null;
  const candidate = compactWhitespace(m[1]);
  if (!candidate) return null;
  if (candidate.length > 80) return null;
  return candidate;
}

function isLikelyTitle(line: string): boolean {
  const trimmed = compactWhitespace(line);
  if (!trimmed) return false;
  if (trimmed.length > 100) return false;
  if (DATE_HEADER_WORD_PATTERN.test(trimmed)) return false;
  if (DATE_HEADER_NUMERIC_PATTERN.test(trimmed)) return false;
  if (TIME_RANGE_PATTERN.test(trimmed)) return false;
  return /[A-Z]/.test(trimmed) && trimmed.split(/\s+/).length <= 12;
}

function isSlotTableHeader(line: string): boolean {
  return SCHEDULE_TABLE_HEADER_PATTERN.test(line);
}

function splitSlotTableRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
  if (line.includes("|")) {
    return line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  return [];
}

type ParseSection = {
  iso: string;
  sharedStart: string | null;
  sharedEnd: string | null;
  lineup: string[];
  notes: string[];
};

function applySharedFactsFromBody(ir: ConciergeIR, lines: string[], today: ParsedDate): void {
  void today;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (!ir.shared_facts.address) {
      const addr = parseAddressLine(line);
      if (addr) {
        ir.shared_facts.address = addr.address;
        if (addr.city && !ir.shared_facts.city) ir.shared_facts.city = addr.city;
        if (addr.state && !ir.shared_facts.state) ir.shared_facts.state = addr.state;
        recordProvenance(ir, "address", "body", line);
        if (addr.city) recordProvenance(ir, "city", "body", line);
        if (addr.state) recordProvenance(ir, "state", "body", line);
        continue;
      }
    }

    if (!ir.shared_facts.cost) {
      const cost = COST_HINT_PATTERN.exec(line);
      if (cost) {
        ir.shared_facts.cost = compactWhitespace(cost[0]);
        recordProvenance(ir, "cost", "body", line);
      }
    }

    if (!ir.shared_facts.signup) {
      if (SIGNUP_HINT_PATTERN.test(line)) {
        ir.shared_facts.signup = compactWhitespace(line).slice(0, 160);
        recordProvenance(ir, "signup", "body", line);
      }
    }

    if (!ir.shared_facts.membership) {
      if (MEMBERSHIP_HINT_PATTERN.test(line)) {
        ir.shared_facts.membership = compactWhitespace(line).slice(0, 160);
        recordProvenance(ir, "membership", "body", line);
      }
    }

    if (!ir.shared_facts.age_policy) {
      const age = AGE_POLICY_PATTERN.exec(line);
      if (age) {
        ir.shared_facts.age_policy = compactWhitespace(age[0]).toLowerCase();
        recordProvenance(ir, "age_policy", "body", line);
      }
    }
  }
}

function chooseTitleAndVenue(ir: ConciergeIR, lines: string[]): void {
  // Title candidate: first non-empty line that is likely a title and has no
  // date / time / address.
  let titleCandidate: string | null = null;
  let venueCandidate: string | null = null;
  let venueLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (parseDateHeader(line, { year: 2000, month: 1, day: 1 })) break;
    if (parseAddressLine(line)) {
      if (!venueCandidate && titleCandidate) {
        // Look back: previous non-empty line might be the venue.
        for (let j = i - 1; j >= 0; j--) {
          const prev = lines[j].trim();
          if (!prev) continue;
          if (prev === titleCandidate) break;
          const venue = detectVenueLine(prev);
          if (venue) {
            venueCandidate = venue;
            venueLineIndex = j;
            break;
          }
        }
      }
      break;
    }
    if (!titleCandidate && isLikelyTitle(line)) {
      titleCandidate = compactWhitespace(line);
      continue;
    }
    if (titleCandidate && !venueCandidate) {
      const venue = detectVenueLine(line);
      if (venue) {
        venueCandidate = venue;
        venueLineIndex = i;
      }
    }
  }

  if (titleCandidate) {
    ir.title = titleCandidate;
    ir.event_family = titleCandidate;
    recordProvenance(ir, "title", "body", titleCandidate);
  }
  if (venueCandidate) {
    ir.shared_facts.venue = venueCandidate;
    recordProvenance(ir, "venue", venueLineIndex >= 0 ? `line:${venueLineIndex}` : "body", venueCandidate);
  } else {
    // Look for an explicit `at <Venue>` mention anywhere in the body.
    for (const line of lines) {
      const venueMention = detectExplicitVenueMention(line);
      if (venueMention) {
        ir.shared_facts.venue = venueMention;
        recordProvenance(ir, "venue", "body", line);
        break;
      }
    }
  }
}

function pickSharedTime(sections: ParseSection[]): { start: string; end: string | null } | null {
  if (sections.length === 0) return null;
  const first = sections.find((s) => s.sharedStart);
  if (!first || !first.sharedStart) return null;
  // Shared only if every section that has a sharedStart agrees.
  const allAgree = sections
    .filter((s) => s.sharedStart)
    .every((s) => s.sharedStart === first.sharedStart && s.sharedEnd === first.sharedEnd);
  if (!allAgree) return null;
  return { start: first.sharedStart, end: first.sharedEnd };
}

function tryParseSlotTable(lines: string[], today: ParsedDate): ParseSection[] {
  const headerIndex = lines.findIndex((line) => isSlotTableHeader(line));
  if (headerIndex < 0) return [];
  const headerCells = splitSlotTableRow(lines[headerIndex]).map((s) => s.toLowerCase());
  if (headerCells.length < 2) return [];
  const dateIdx = headerCells.findIndex((c) => /^date|^day$/.test(c));
  const timeIdx = headerCells.findIndex((c) => /^(time|start)/.test(c));
  const performerIdx = headerCells.findIndex((c) => /performer|artist|act|name/.test(c));
  if (dateIdx < 0 || timeIdx < 0) return [];
  const sections: Map<string, ParseSection> = new Map();
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = splitSlotTableRow(lines[i]);
    if (cells.length === 0) continue;
    const dateRaw = cells[dateIdx];
    const timeRaw = cells[timeIdx];
    if (!dateRaw || !timeRaw) continue;
    const dateMatch = parseDateHeader(dateRaw, today);
    if (!dateMatch) continue;
    const range = parseTimeRange(timeRaw) ?? null;
    const performer = performerIdx >= 0 ? cells[performerIdx] ?? "" : "";
    let section = sections.get(dateMatch.iso);
    if (!section) {
      section = {
        iso: dateMatch.iso,
        sharedStart: null,
        sharedEnd: null,
        lineup: [],
        notes: [],
      };
      sections.set(dateMatch.iso, section);
    }
    const trimmedPerformer = compactWhitespace(performer);
    if (trimmedPerformer) section.lineup.push(trimmedPerformer);
    if (range) {
      // We only treat the table's broadest time as shared — leave granular
      // start/end on per-slot lineup entries.
      if (!section.sharedStart) {
        section.sharedStart = range.start;
        section.sharedEnd = range.end;
      }
    }
  }
  return Array.from(sections.values());
}

function buildOccurrences(sections: ParseSection[], shared: { start: string; end: string | null } | null): ConciergeOccurrence[] {
  const out: ConciergeOccurrence[] = [];
  for (const section of sections) {
    const useShared = shared && section.sharedStart === shared.start && section.sharedEnd === shared.end;
    out.push({
      date: section.iso,
      start_time: useShared ? null : section.sharedStart,
      end_time: useShared ? null : section.sharedEnd,
      lineup: [...section.lineup],
      per_date_notes: section.notes.length > 0 ? section.notes.join(" ") : null,
    });
  }
  return out;
}

export function parse(input: ConciergeInput): ConciergeIR {
  const today = todayParts(input.today_iso ?? null);
  const ir = emptyConciergeIR(input.source_kind, input.source_url ?? null);
  if (input.source_url) recordProvenance(ir, "source_url", "input", input.source_url);

  const lines = normalizeLines(input.raw_text ?? "");

  // Title + venue + body shared facts.
  chooseTitleAndVenue(ir, lines);
  applySharedFactsFromBody(ir, lines, today);

  // First, try the slot-table shape. If present and non-empty, prefer it.
  const tableSections = tryParseSlotTable(lines, today);

  let sections: ParseSection[] = tableSections;
  if (sections.length === 0) {
    // Walk lines and group by date header.
    const collected: ParseSection[] = [];
    let current: ParseSection | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        continue;
      }
      const header = parseDateHeader(line, today);
      if (header) {
        current = {
          iso: header.iso,
          sharedStart: header.sharedStart,
          sharedEnd: header.sharedEnd,
          lineup: [],
          notes: [],
        };
        collected.push(current);
        // The remainder may name a venue or an additional time range — already
        // captured into sharedStart/sharedEnd above. Nothing else to do here.
        continue;
      }
      if (current) {
        const slot = parseTimeSlotLine(line);
        if (slot) {
          current.lineup.push(slot.remainder);
          continue;
        }
        // Lines that aren't slots but still belong to the current date become
        // notes.
        const compact = compactWhitespace(line);
        if (compact) current.notes.push(compact);
      }
    }
    sections = collected;
  }

  if (sections.length === 0) {
    // No date headers found. Try a single-event flyer shape: one date + one
    // time + one venue across the whole body.
    const flyerDate = lines.map((l) => parseDateHeader(l, today)).find((m) => m !== null) ?? null;
    if (flyerDate) {
      const range = lines.map((l) => parseTimeRange(l)).find((r) => r !== null) ?? null;
      sections = [
        {
          iso: flyerDate.iso,
          sharedStart: range?.start ?? flyerDate.sharedStart,
          sharedEnd: range?.end ?? flyerDate.sharedEnd,
          lineup: [],
          notes: [],
        },
      ];
    }
  }

  if (sections.length === 0) {
    // Pure conversation shape — no occurrences. Single-time hint, if present,
    // becomes the shared_facts.time.
    const single = lines
      .map((l) => parseTimeRange(l) ?? (parseSingleTime(l) ? { start: parseSingleTime(l)!, end: null } : null))
      .find((r) => r !== null) as { start: string; end: string | null } | null | undefined;
    if (single && !ir.shared_facts.time) {
      ir.shared_facts.time = { start: single.start, end: single.end };
      recordProvenance(ir, "time", "body", `${single.start}${single.end ? ` - ${single.end}` : ""}`);
    }
    return ir;
  }

  const sharedTime = pickSharedTime(sections);
  if (sharedTime) {
    ir.shared_facts.time = { start: sharedTime.start, end: sharedTime.end };
    recordProvenance(
      ir,
      "shared_time",
      "body",
      `${sharedTime.start}${sharedTime.end ? ` - ${sharedTime.end}` : ""}`,
    );
    // Note that per-occurrence start/end being null is an inferred fact:
    // shared time was hoisted.
    for (const section of sections) {
      if (section.sharedStart === sharedTime.start && section.sharedEnd === sharedTime.end) {
        noteInferredFact(ir, `occurrence:${section.iso}.start_time`, sharedTime.start, "shared_time_hoisted");
      }
    }
  }

  ir.occurrences = buildOccurrences(sections, sharedTime);
  return ir;
}

export const __test__ = {
  parseDateHeader,
  parseTimeRange,
  parseTimeSlotLine,
  parseAddressLine,
  detectVenueLine,
  detectDomain,
};
