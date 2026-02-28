/**
 * Phase 7 — Interpreter fixture regression suite.
 *
 * Tests the deterministic post-processing pipeline WITHOUT calling the LLM.
 * Each fixture provides a simulated LLM response; the test runs it through:
 *   sanitization → venue resolution → location hints → hardening →
 *   title fallback → recurrence guard → clarification reducer.
 *
 * Phase 7 helpers (recurrence guard, time semantics, clarification reducer,
 * venue/custom exclusivity) are imported from the shared module
 * `interpreterPostprocess.ts` — the same code used by route.ts — to prevent
 * logic drift between production and tests.
 *
 * Safety-critical fixtures are tagged and tracked separately.
 */
import { describe, expect, it } from "vitest";
import {
  sanitizeInterpretDraftPayload,
  validateSanitizedDraftPayload,
  buildQualityHints,
  type InterpretMode,
} from "@/lib/events/interpretEventContract";
import {
  resolveVenue,
  shouldResolveVenue,
  type VenueCatalogEntry,
} from "@/lib/events/venueResolver";
import { normalizeSignupMode } from "@/lib/events/signupModeContract";
import {
  detectsRecurrenceIntent,
  applyTimeSemantics,
  reduceClarificationToSingle,
  enforceVenueCustomExclusivity,
  mergeLockedCreateDraft,
  normalizeInterpreterLocationMode,
  pruneOptionalBlockingFields,
} from "@/lib/events/interpreterPostprocess";
import fixtureData from "@/__fixtures__/interpreter/phase7-cases.json";

// ---------------------------------------------------------------------------
// Types for fixture data
// ---------------------------------------------------------------------------

interface FixtureCase {
  id: string;
  name: string;
  mode: string;
  message: string;
  eventId?: string;
  dateKey?: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  locked_draft?: Record<string, unknown>;
  venueCatalog: Array<{ id: string; name: string; slug?: string }>;
  simulatedLlmResponse: {
    next_action: string;
    confidence: number;
    human_summary: string;
    clarification_question: string | null;
    blocking_fields: string[];
    draft_payload: Record<string, unknown>;
  };
  expected: Record<string, unknown>;
  safety_critical: boolean;
  safety_rule?: string;
}

// ---------------------------------------------------------------------------
// Local helpers that remain test-only (pre-Phase-7 route logic)
// ---------------------------------------------------------------------------

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const GOOGLE_MAPS_URL_SINGLE_REGEX =
  /\bhttps?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.com\/maps\/[^\s]+|maps\.google\.com\/[^\s]+)\b/i;

function isGoogleMapsUrl(value: unknown): value is string {
  return typeof value === "string" && GOOGLE_MAPS_URL_SINGLE_REGEX.test(value.trim());
}

function collectsTimeslotIntent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): boolean {
  const intentText = [message, ...history.filter((h) => h.role === "user").map((h) => h.content)]
    .join("\n")
    .toLowerCase();
  if (!intentText.trim()) return false;
  const explicitSignals = [
    /\btimeslots?\b/i,
    /\btime\s*slots?\b/i,
    /\bslot\s*duration\b/i,
    /\blineup\b/i,
    /\b\d+\s+(?:performer\s+)?slots?\b/i,
    /\benable\s+(?:performer\s+)?slots?\b/i,
  ];
  return explicitSignals.some((pattern) => pattern.test(intentText));
}

// ---------------------------------------------------------------------------
// Full deterministic pipeline (mirrors route.ts POST handler logic)
//
// Phase 7 guards (steps 4–6, 9) use the SHARED module to guarantee
// identical behavior between production and tests.
// ---------------------------------------------------------------------------

function runDeterministicPipeline(fixture: FixtureCase) {
  const mode = fixture.mode as InterpretMode;
  const llm = fixture.simulatedLlmResponse;
  const lockedDraft =
    mode === "create"
      ? sanitizeInterpretDraftPayload("create", fixture.locked_draft ?? null)
      : null;
  const venueCatalog: VenueCatalogEntry[] = fixture.venueCatalog.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug ?? null,
  }));

  // 1. Sanitize draft payload
  const sanitizedDraft = sanitizeInterpretDraftPayload(
    mode,
    llm.draft_payload,
    fixture.dateKey
  );

  // 2. Venue resolution (post-LLM)
  let resolvedNextAction = llm.next_action;
  let resolvedBlockingFields = [...llm.blocking_fields];
  let resolvedClarificationQuestion = llm.clarification_question;

  const shouldSendVenueCatalog =
    mode === "create" ||
    /\b(venue|location|address|move|moved|switch|relocat|different venue|online|virtual|zoom|livestream)\b/i.test(
      fixture.message
    );

  if (
    shouldResolveVenue({
      mode,
      hasLocationIntent: shouldSendVenueCatalog,
      draftPayload: sanitizedDraft,
    })
  ) {
    const isCustomLocation =
      typeof sanitizedDraft.custom_location_name === "string" &&
      (sanitizedDraft.custom_location_name as string).trim().length > 0 &&
      !sanitizedDraft.venue_id;

    const venueResolution = resolveVenue({
      draftVenueId: sanitizedDraft.venue_id as string | null | undefined,
      draftVenueName:
        (sanitizedDraft.venue_name as string | null | undefined) ??
        (sanitizedDraft.custom_location_name as string | null | undefined),
      userMessage: fixture.message,
      venueCatalog,
      draftLocationMode: sanitizedDraft.location_mode as string | null | undefined,
      draftOnlineUrl: sanitizedDraft.online_url as string | null | undefined,
      isCustomLocation,
    });

    if (venueResolution.status === "resolved") {
      sanitizedDraft.venue_id = venueResolution.venueId;
      sanitizedDraft.venue_name = venueResolution.venueName;
      if (!sanitizedDraft.location_mode || sanitizedDraft.location_mode === "online") {
        sanitizedDraft.location_mode = "venue";
      }
    } else if (venueResolution.status === "ambiguous") {
      if (resolvedNextAction !== "ask_clarification") {
        resolvedNextAction = "ask_clarification";
        const candidateList = venueResolution.candidates
          .map((c, i) => `${i + 1}. ${c.name}`)
          .join(", ");
        resolvedClarificationQuestion = `I found multiple possible venues matching "${venueResolution.inputName}": ${candidateList}. Which one did you mean?`;
      }
      if (!resolvedBlockingFields.includes("venue_id")) {
        resolvedBlockingFields.push("venue_id");
      }
    } else if (venueResolution.status === "unresolved") {
      const needsOnlineUrl =
        sanitizedDraft.location_mode === "online" &&
        !(typeof sanitizedDraft.online_url === "string" && sanitizedDraft.online_url.trim().length > 0);
      if (resolvedNextAction !== "ask_clarification") {
        resolvedNextAction = "ask_clarification";
        if (needsOnlineUrl) {
          resolvedClarificationQuestion = "Please provide the online event URL (Zoom, YouTube, etc.) for this online event.";
        } else {
          const inputHint = venueResolution.inputName ? ` matching "${venueResolution.inputName}"` : "";
          resolvedClarificationQuestion = `I couldn't find a known venue${inputHint}. Could you provide the venue name, or specify if this is an online event?`;
        }
      }
      const blockingField = needsOnlineUrl ? "online_url" : "venue_id";
      if (!resolvedBlockingFields.includes(blockingField)) {
        resolvedBlockingFields.push(blockingField);
      }
    }
  }

  // Remove redundant location blockers when custom location is present
  if (hasNonEmptyString(sanitizedDraft.custom_location_name)) {
    const redundant = new Set([
      "venue_id", "venue_name", "venue_name_confirmation",
      "venue_id/venue_name_confirmation", "custom_address", "custom_city", "custom_state",
    ]);
    resolvedBlockingFields = resolvedBlockingFields.filter((f) => !redundant.has(f));
  }

  // 3. Hardening (mirrors hardenDraftForCreateEdit)
  if (mode === "create" || mode === "edit_series") {
    const hasOnlineUrl = hasNonEmptyString(sanitizedDraft.online_url);
    sanitizedDraft.location_mode = normalizeInterpreterLocationMode(
      sanitizedDraft.location_mode,
      hasOnlineUrl ? "online" : "venue"
    );
    sanitizedDraft.signup_mode = normalizeSignupMode(sanitizedDraft.signup_mode);
  }
  if (isGoogleMapsUrl(sanitizedDraft.external_url)) {
    sanitizedDraft.external_url = null;
  }
  if (hasNonEmptyString(sanitizedDraft.venue_id)) {
    sanitizedDraft.location_mode = "venue";
  }
  if (mode === "create" && sanitizedDraft.has_timeslots === true) {
    if (!collectsTimeslotIntent(fixture.message, fixture.conversationHistory)) {
      sanitizedDraft.has_timeslots = false;
      sanitizedDraft.total_slots = null;
      sanitizedDraft.slot_duration_minutes = null;
      sanitizedDraft.allow_guests = false;
    }
  }

  // 4. Phase 7B: Recurrence intent guard — SHARED MODULE
  if (
    mode === "create" &&
    typeof sanitizedDraft.series_mode === "string" &&
    sanitizedDraft.series_mode !== "single"
  ) {
    if (!detectsRecurrenceIntent(fixture.message, fixture.conversationHistory)) {
      sanitizedDraft.series_mode = "single";
      sanitizedDraft.recurrence_rule = null;
      sanitizedDraft.day_of_week = null;
      sanitizedDraft.occurrence_count = null;
      sanitizedDraft.max_occurrences = null;
      sanitizedDraft.custom_dates = null;
    }
  }

  // 5. Phase 7D: Time semantics (doors vs performance) — SHARED MODULE
  if (mode === "create" || mode === "edit_series") {
    applyTimeSemantics(sanitizedDraft, fixture.message);
  }

  // 6. Phase 7D: Venue/custom mutual exclusivity cleanup — SHARED MODULE
  enforceVenueCustomExclusivity(sanitizedDraft);

  // 6b. Multi-turn create draft lock (restores confirmed fields that the
  // current turn omitted/reset during short clarification replies).
  if (mode === "create") {
    mergeLockedCreateDraft({
      draft: sanitizedDraft,
      lockedDraft,
      message: fixture.message,
    });
    const hasOnlineUrl = hasNonEmptyString(sanitizedDraft.online_url);
    sanitizedDraft.location_mode = normalizeInterpreterLocationMode(
      sanitizedDraft.location_mode,
      hasOnlineUrl ? "online" : "venue"
    );
  }

  // 7. Title fallback (simplified — no extractedImageText in fixtures)
  if (mode === "create" && !hasNonEmptyString(sanitizedDraft.title)) {
    // Try text-based extraction
    const text = [fixture.message, ...fixture.conversationHistory.map((h) => h.content)].join("\n");
    const titlePatterns: RegExp[] = [
      /\b(?:rsvp\s+for|join us for|for)\s+([A-Z][A-Za-z0-9 '&:/-]{3,90}?(?:open mic(?: night)?|song circle|showcase|workshop|jam(?: session)?|gig|meetup))/i,
      /\b([A-Z][A-Za-z0-9 '&:/-]{3,90}?(?:open mic(?: night)?|song circle|showcase|workshop|jam(?: session)?|gig|meetup))\b/i,
    ];
    let foundTitle: string | null = null;
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].replace(/\s+/g, " ").trim().replace(/^["'`]+|["'`]+$/g, "");
        if (candidate.length >= 4 && candidate.length <= 90) {
          foundTitle = candidate;
          break;
        }
      }
    }

    if (!foundTitle) {
      // Context-based fallback
      const eventTypes = Array.isArray(sanitizedDraft.event_type)
        ? sanitizedDraft.event_type.filter((v): v is string => typeof v === "string")
        : [];
      const typeLabelByKey: Record<string, string> = {
        open_mic: "Open Mic Night",
        showcase: "Showcase",
        song_circle: "Song Circle",
        workshop: "Workshop",
        jam_session: "Jam Session",
        gig: "Live Music Event",
        meetup: "Meetup",
        other: "Community Event",
      };
      const primaryType = eventTypes[0] ?? null;
      const baseTitle = primaryType ? typeLabelByKey[primaryType] ?? null : null;
      const venueName = typeof sanitizedDraft.venue_name === "string" ? sanitizedDraft.venue_name.trim() : "";

      if (baseTitle && venueName) foundTitle = `${baseTitle} at ${venueName}`;
      else if (baseTitle) foundTitle = baseTitle;
    }

    if (foundTitle) sanitizedDraft.title = foundTitle;
  }

  // 8. Final validation guard
  if (resolvedNextAction !== "ask_clarification") {
    const draftValidation = validateSanitizedDraftPayload(mode, sanitizedDraft);
    if (!draftValidation.ok) {
      resolvedNextAction = "ask_clarification";
      if (draftValidation.blockingField && !resolvedBlockingFields.includes(draftValidation.blockingField)) {
        resolvedBlockingFields.push(draftValidation.blockingField);
      }
      resolvedClarificationQuestion = `Please provide ${draftValidation.blockingField || "required field"} to continue.`;
    }
  }

  // 8b. Optional blockers should not block create/edit-series progression.
  const optionalPrune = pruneOptionalBlockingFields(
    mode,
    resolvedBlockingFields,
    resolvedClarificationQuestion
  );
  resolvedBlockingFields = optionalPrune.blockingFields;
  resolvedClarificationQuestion = optionalPrune.clarificationQuestion;

  // 9. Phase 7C: Clarification reducer — SHARED MODULE
  if (resolvedNextAction === "ask_clarification") {
    const reduced = reduceClarificationToSingle(resolvedBlockingFields, resolvedClarificationQuestion);
    resolvedBlockingFields = reduced.blockingFields;
    resolvedClarificationQuestion = reduced.clarificationQuestion;
  }

  // 10. Empty blocking fields cleanup
  if (resolvedNextAction === "ask_clarification" && resolvedBlockingFields.length === 0) {
    resolvedClarificationQuestion = null;
    resolvedNextAction = "show_preview";
  }

  return {
    mode,
    next_action: resolvedNextAction,
    confidence: llm.confidence,
    human_summary: llm.human_summary,
    clarification_question: resolvedClarificationQuestion,
    blocking_fields: resolvedBlockingFields,
    draft_payload: sanitizedDraft,
    quality_hints: buildQualityHints(sanitizedDraft),
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const cases = (fixtureData as { cases: FixtureCase[] }).cases;

describe("Phase 7 Interpreter Fixture Regression Suite", () => {
  const results: Array<{ id: string; name: string; passed: boolean; safety: boolean; errors: string[] }> = [];

  for (const fixture of cases) {
    it(`[${fixture.id}] ${fixture.name}`, () => {
      const errors: string[] = [];
      const result = runDeterministicPipeline(fixture);
      const draft = result.draft_payload;
      const expected = fixture.expected;

      // --- Assert expected fields ---

      if (expected.next_action !== undefined) {
        if (result.next_action !== expected.next_action) {
          errors.push(`next_action: expected ${expected.next_action}, got ${result.next_action}`);
        }
      }

      if (expected.title !== undefined) {
        if (draft.title !== expected.title) {
          errors.push(`title: expected "${expected.title}", got "${draft.title}"`);
        }
      }

      if (expected.title_not_empty === true) {
        if (!hasNonEmptyString(draft.title)) {
          errors.push(`title_not_empty: title is empty or missing`);
        }
      }

      if (expected.series_mode !== undefined) {
        if (draft.series_mode !== expected.series_mode) {
          errors.push(`series_mode: expected ${expected.series_mode}, got ${draft.series_mode}`);
        }
      }

      if (expected.recurrence_rule_must_be_null === true) {
        if (draft.recurrence_rule !== null && draft.recurrence_rule !== undefined) {
          errors.push(`recurrence_rule_must_be_null: got ${draft.recurrence_rule}`);
        }
      }

      if (expected.start_date !== undefined) {
        if (draft.start_date !== expected.start_date) {
          errors.push(`start_date: expected ${expected.start_date}, got ${draft.start_date}`);
        }
      }

      if (expected.start_time !== undefined) {
        if (draft.start_time !== expected.start_time) {
          errors.push(`start_time: expected ${expected.start_time}, got ${draft.start_time}`);
        }
      }

      if (expected.venue_id !== undefined) {
        if (draft.venue_id !== expected.venue_id) {
          errors.push(`venue_id: expected ${expected.venue_id}, got ${draft.venue_id}`);
        }
      }

      if (expected.venue_name !== undefined) {
        if (draft.venue_name !== expected.venue_name) {
          errors.push(`venue_name: expected "${expected.venue_name}", got "${draft.venue_name}"`);
        }
      }

      if (expected.venue_id_must_be_absent === true) {
        if (hasNonEmptyString(draft.venue_id)) {
          errors.push(`venue_id_must_be_absent: got ${draft.venue_id}`);
        }
      }

      if (expected.location_mode !== undefined) {
        if (draft.location_mode !== expected.location_mode) {
          errors.push(`location_mode: expected ${expected.location_mode}, got ${draft.location_mode}`);
        }
      }

      if (expected.online_url !== undefined) {
        if (draft.online_url !== expected.online_url) {
          errors.push(`online_url: expected ${expected.online_url}, got ${draft.online_url}`);
        }
      }

      if (expected.custom_location_name !== undefined) {
        if (draft.custom_location_name !== expected.custom_location_name) {
          errors.push(`custom_location_name: expected "${expected.custom_location_name}", got "${draft.custom_location_name}"`);
        }
      }

      if (expected.custom_location_name_must_be_null === true) {
        if (draft.custom_location_name !== null && draft.custom_location_name !== undefined) {
          errors.push(`custom_location_name_must_be_null: got "${draft.custom_location_name}"`);
        }
      }

      if (expected.custom_address_must_be_null === true) {
        if (draft.custom_address !== null && draft.custom_address !== undefined) {
          errors.push(`custom_address_must_be_null: got "${draft.custom_address}"`);
        }
      }

      if (expected.signup_mode !== undefined) {
        if (draft.signup_mode !== expected.signup_mode) {
          errors.push(`signup_mode: expected ${expected.signup_mode}, got ${draft.signup_mode}`);
        }
      }

      if (expected.signup_mode_must_be_null === true) {
        if (draft.signup_mode !== null && draft.signup_mode !== undefined) {
          errors.push(`signup_mode_must_be_null: got "${draft.signup_mode}"`);
        }
      }

      if (expected.has_timeslots !== undefined) {
        if (draft.has_timeslots !== expected.has_timeslots) {
          errors.push(`has_timeslots: expected ${expected.has_timeslots}, got ${draft.has_timeslots}`);
        }
      }

      if (expected.total_slots !== undefined) {
        if (draft.total_slots !== expected.total_slots) {
          errors.push(`total_slots: expected ${expected.total_slots}, got ${draft.total_slots}`);
        }
      }

      if (expected.total_slots_must_be_null === true) {
        if (draft.total_slots !== null && draft.total_slots !== undefined) {
          errors.push(`total_slots_must_be_null: got ${draft.total_slots}`);
        }
      }

      if (expected.slot_duration_minutes !== undefined) {
        if (draft.slot_duration_minutes !== expected.slot_duration_minutes) {
          errors.push(`slot_duration_minutes: expected ${expected.slot_duration_minutes}, got ${draft.slot_duration_minutes}`);
        }
      }

      if (expected.slot_duration_minutes_must_be_null === true) {
        if (draft.slot_duration_minutes !== null && draft.slot_duration_minutes !== undefined) {
          errors.push(`slot_duration_minutes_must_be_null: got ${draft.slot_duration_minutes}`);
        }
      }

      if (expected.is_free !== undefined) {
        if (draft.is_free !== expected.is_free) {
          errors.push(`is_free: expected ${expected.is_free}, got ${draft.is_free}`);
        }
      }

      if (expected.external_url_must_be_null === true) {
        if (draft.external_url !== null && draft.external_url !== undefined) {
          errors.push(`external_url_must_be_null: got "${draft.external_url}"`);
        }
      }

      if (expected.blocking_fields_includes !== undefined) {
        const expected_fields = expected.blocking_fields_includes as string[];
        for (const field of expected_fields) {
          if (!result.blocking_fields.includes(field)) {
            errors.push(`blocking_fields should include "${field}", got [${result.blocking_fields.join(", ")}]`);
          }
        }
      }

      if (expected.blocking_fields_empty === true) {
        if (result.blocking_fields.length > 0) {
          errors.push(`blocking_fields should be empty, got [${result.blocking_fields.join(", ")}]`);
        }
      }

      if (expected.blocking_fields_max_count !== undefined) {
        const maxCount = expected.blocking_fields_max_count as number;
        if (result.blocking_fields.length > maxCount) {
          errors.push(
            `blocking_fields count should be ≤${maxCount}, got ${result.blocking_fields.length}: [${result.blocking_fields.join(", ")}]`
          );
        }
      }

      if (expected.clarification_question_not_null === true) {
        if (result.clarification_question === null) {
          errors.push(`clarification_question should not be null`);
        }
      }

      // Track results for summary
      const passed = errors.length === 0;
      results.push({
        id: fixture.id,
        name: fixture.name,
        passed,
        safety: fixture.safety_critical,
        errors,
      });

      // Fail the test with detailed errors
      if (errors.length > 0) {
        expect.fail(`\n${errors.join("\n")}`);
      }
    });
  }

  // Summary test — runs after all fixtures
  it("SAFETY SUMMARY: all safety-critical fixtures must pass", () => {
    const safetyCriticalResults = results.filter((r) => r.safety);
    const failures = safetyCriticalResults.filter((r) => !r.passed);

    if (failures.length > 0) {
      const report = failures
        .map((f) => `  [${f.id}] ${f.name}:\n    ${f.errors.join("\n    ")}`)
        .join("\n");
      expect.fail(
        `\n${failures.length} safety-critical fixture(s) FAILED:\n${report}`
      );
    }
  });

  it("reports overall pass rate", () => {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const safetyCritical = results.filter((r) => r.safety);
    const safetyPassed = safetyCritical.filter((r) => r.passed).length;

    console.log(`\n--- Phase 7 Fixture Results ---`);
    console.log(`Total: ${passed}/${total} passed`);
    console.log(`Safety-critical: ${safetyPassed}/${safetyCritical.length} passed`);

    for (const r of results) {
      const tag = r.safety ? " [SAFETY]" : "";
      const status = r.passed ? "✓" : "✗";
      console.log(`  ${status} [${r.id}]${tag} ${r.name}`);
      if (!r.passed) {
        for (const err of r.errors) {
          console.log(`    → ${err}`);
        }
      }
    }
    console.log(`--- End Results ---\n`);

    // This test always passes — it's for reporting
    expect(true).toBe(true);
  });
});
