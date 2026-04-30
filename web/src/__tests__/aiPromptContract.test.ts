import { describe, expect, it } from "vitest";

import {
  AI_INTERPRET_SCOPES,
  AI_PROMPT_CURRENT_EVENT_FIELDS,
  appendAiPromptContractAdditions,
  buildAiPromptContractAdditions,
  buildAiPromptResponseSchema,
  buildAiPromptUserEnvelope,
  buildOrderedImageReferences,
  decideScopeAmbiguity,
  isAiInterpretScope,
  projectCurrentEventForPrompt,
} from "@/lib/events/aiPromptContract";
import {
  evaluateTrack1Outputs,
  type Track1EvalScenarioOutput,
} from "@/lib/events/evals/runTrack1EvalHarness";
import { TRACK1_EVAL_CASES } from "@/lib/events/evals/track1EvalCases";

describe("aiPromptContract — scope contract", () => {
  it("exposes the three scope values required by collab plan §5.3", () => {
    expect([...AI_INTERPRET_SCOPES]).toEqual(["series", "occurrence", "ambiguous"]);
  });

  it("validates known scope strings", () => {
    expect(isAiInterpretScope("series")).toBe(true);
    expect(isAiInterpretScope("occurrence")).toBe(true);
    expect(isAiInterpretScope("ambiguous")).toBe(true);
    expect(isAiInterpretScope("series_or_something")).toBe(false);
    expect(isAiInterpretScope(null)).toBe(false);
    expect(isAiInterpretScope(undefined)).toBe(false);
  });

  it("response schema requires top-level scope with the three enum values", () => {
    const schema = buildAiPromptResponseSchema();
    expect(schema.required).toContain("scope");
    expect(schema.properties.scope).toEqual({
      type: "string",
      enum: ["series", "occurrence", "ambiguous"],
    });
  });

  it("response schema preserves base required fields (no regression)", () => {
    const schema = buildAiPromptResponseSchema();
    for (const field of [
      "next_action",
      "confidence",
      "human_summary",
      "clarification_question",
      "blocking_fields",
      "draft_payload",
    ]) {
      expect(schema.required).toContain(field);
    }
  });
});

describe("aiPromptContract — system prompt additions", () => {
  it("includes structured-scope contract guidance", () => {
    const additions = buildAiPromptContractAdditions().join("\n");
    expect(additions).toMatch(/scope contract/i);
    expect(additions).toMatch(/'series'/);
    expect(additions).toMatch(/'occurrence'/);
    expect(additions).toMatch(/'ambiguous'/);
  });

  it("includes the three negative ambiguity examples from §13.2", () => {
    const additions = buildAiPromptContractAdditions().join("\n");
    expect(additions).toMatch(/move next thursday to 7/i);
    expect(additions).toMatch(/change this one to the new venue/i);
    expect(additions).toMatch(/use the other cover/i);
  });

  it("instructs the model that ambiguous scope forces server-side clarification even with a patch", () => {
    const additions = buildAiPromptContractAdditions().join("\n");
    expect(additions.toLowerCase()).toContain("force");
    expect(additions.toLowerCase()).toContain("clarification");
  });

  it("describes the patch-only edit semantics from §5.4", () => {
    const additions = buildAiPromptContractAdditions().join("\n");
    expect(additions.toLowerCase()).toContain("patch-only");
    expect(additions.toLowerCase()).toContain("current_event");
    expect(additions.toLowerCase()).toContain("did not ask to change");
  });

  it("describes ordered image references with stable indices", () => {
    const additions = buildAiPromptContractAdditions().join("\n");
    expect(additions.toLowerCase()).toContain("image_references");
    expect(additions.toLowerCase()).toContain("index");
    expect(additions.toLowerCase()).toContain("isCurrentCover".toLowerCase());
  });

  it("includes the one-question rule", () => {
    const additions = buildAiPromptContractAdditions().join("\n");
    expect(additions.toLowerCase()).toContain("at most one");
  });

  it("appends additions onto an existing base prompt without dropping it", () => {
    const base = "You are an event interpretation service.\nRules:\n- existing rule.";
    const merged = appendAiPromptContractAdditions(base);
    expect(merged.startsWith(base)).toBe(true);
    expect(merged).toMatch(/Scope contract/i);
    expect(merged.length).toBeGreaterThan(base.length);
  });
});

describe("aiPromptContract — ordered image references", () => {
  it("returns an empty array for missing or malformed input", () => {
    expect(buildOrderedImageReferences(undefined)).toEqual([]);
    expect(buildOrderedImageReferences(null)).toEqual([]);
    expect(buildOrderedImageReferences("not an array")).toEqual([]);
  });

  it("normalizes shape and reindexes from 0 in input order", () => {
    const refs = buildOrderedImageReferences([
      { clientId: "c1", fileName: "flyer.png", isCurrentCover: true },
      { clientId: "c2", eventImageId: "ei-99", isCurrentCover: false },
      { clientId: "c3" },
    ]);
    expect(refs).toEqual([
      {
        index: 0,
        clientId: "c1",
        eventImageId: null,
        fileName: "flyer.png",
        isCurrentCover: true,
      },
      {
        index: 1,
        clientId: "c2",
        eventImageId: "ei-99",
        fileName: null,
        isCurrentCover: false,
      },
      {
        index: 2,
        clientId: "c3",
        eventImageId: null,
        fileName: null,
        isCurrentCover: false,
      },
    ]);
  });

  it("accepts both camelCase and snake_case keys", () => {
    const refs = buildOrderedImageReferences([
      { client_id: "c1", event_image_id: "ei-1", file_name: "a.png", is_current_cover: true },
    ]);
    expect(refs).toEqual([
      {
        index: 0,
        clientId: "c1",
        eventImageId: "ei-1",
        fileName: "a.png",
        isCurrentCover: true,
      },
    ]);
  });

  it("drops entries without a clientId (no silent injection)", () => {
    const refs = buildOrderedImageReferences([
      { fileName: "missing-id.png", isCurrentCover: true },
      { clientId: "ok", isCurrentCover: false },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].clientId).toBe("ok");
    expect(refs[0].index).toBe(0);
  });
});

describe("aiPromptContract — user prompt envelope", () => {
  const baseInput = {
    mode: "edit_series" as const,
    message: "change the whole series to 6:30",
    conversationHistory: [],
    venueCatalog: [{ id: "v1", name: "Lost Lake" }],
    currentEvent: { id: "e1", title: "Tuesday Open Mic", start_time: "19:00:00" },
    currentDate: "2026-04-30",
  };

  it("emits valid JSON with the §13.2 contract surface populated", () => {
    const json = buildAiPromptUserEnvelope({
      ...baseInput,
      imageReferences: [
        {
          index: 0,
          clientId: "c1",
          eventImageId: "ei-1",
          fileName: "current.png",
          isCurrentCover: true,
        },
        {
          index: 1,
          clientId: "c2",
          eventImageId: null,
          fileName: "other.png",
          isCurrentCover: false,
        },
      ],
    });
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("edit_series");
    expect(parsed.current_event).toEqual(baseInput.currentEvent);
    expect(parsed.image_references).toHaveLength(2);
    expect(parsed.image_references[1]).toMatchObject({ index: 1, clientId: "c2", isCurrentCover: false });
    expect(parsed.required_output_shape.scope).toContain("series");
    expect(parsed.required_output_shape.scope).toContain("occurrence");
    expect(parsed.required_output_shape.scope).toContain("ambiguous");
  });

  it("for edit modes attaches an edit_contract describing patch-only and ambiguity", () => {
    const json = buildAiPromptUserEnvelope({ ...baseInput, mode: "edit_occurrence", dateKey: "2026-05-07" });
    const parsed = JSON.parse(json);
    expect(parsed.edit_contract).toBeDefined();
    expect(parsed.edit_contract.rule).toBe("patch_only");
    expect(parsed.edit_contract.scope_field.required).toBe(true);
    expect(parsed.edit_contract.scope_field.server_behavior.toLowerCase()).toContain(
      "ambiguous",
    );
  });

  it("for create mode does not attach edit_contract", () => {
    const json = buildAiPromptUserEnvelope({
      ...baseInput,
      mode: "create",
      currentEvent: null,
    });
    const parsed = JSON.parse(json);
    expect(parsed.edit_contract).toBeUndefined();
  });

  it("always includes image_references key (possibly empty)", () => {
    const json = buildAiPromptUserEnvelope(baseInput);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.image_references)).toBe(true);
    expect(parsed.image_references).toHaveLength(0);
  });

  it("preserves locked_draft, google_maps_hint, and web_search_verification when supplied", () => {
    const json = buildAiPromptUserEnvelope({
      ...baseInput,
      lockedDraft: { title: "Locked title" },
      googleMapsHint: { source_url: "https://maps.example/abc" },
      webSearchVerification: { status: "searched", summary: "ok", facts: [], sources: [] },
    });
    const parsed = JSON.parse(json);
    expect(parsed.locked_draft).toEqual({ title: "Locked title" });
    expect(parsed.google_maps_hint).toEqual({ source_url: "https://maps.example/abc" });
    expect(parsed.web_search_verification).toEqual({
      status: "searched",
      summary: "ok",
      facts: [],
      sources: [],
    });
    expect(parsed.image_extraction_note).toBeUndefined();
  });
});

describe("aiPromptContract — server-side scope ambiguity decision", () => {
  it("forces clarification when scope is ambiguous on edit_occurrence even with a model patch", () => {
    const decision = decideScopeAmbiguity({
      mode: "edit_occurrence",
      scope: "ambiguous",
      modelNextAction: "show_preview",
      modelClarificationQuestion: null,
      modelBlockingFields: [],
    });
    expect(decision.forced).toBe(true);
    expect(decision.nextAction).toBe("ask_clarification");
    expect(decision.patchSuppressed).toBe(true);
    expect(decision.clarificationQuestion).toMatch(/series|occurrence/i);
    expect(decision.blockingFields).toContain("scope");
    expect(decision.reason).toBe("ambiguous_scope");
  });

  it("forces clarification on edit_series too", () => {
    const decision = decideScopeAmbiguity({
      mode: "edit_series",
      scope: "ambiguous",
      modelNextAction: "show_preview",
      modelClarificationQuestion: "Did you mean just this Thursday or every Thursday?",
      modelBlockingFields: [],
    });
    expect(decision.forced).toBe(true);
    expect(decision.clarificationQuestion).toBe(
      "Did you mean just this Thursday or every Thursday?",
    );
  });

  it("does not force clarification when scope is not ambiguous", () => {
    const decision = decideScopeAmbiguity({
      mode: "edit_series",
      scope: "series",
      modelNextAction: "show_preview",
      modelClarificationQuestion: null,
      modelBlockingFields: [],
    });
    expect(decision.forced).toBe(false);
    expect(decision.nextAction).toBe("show_preview");
    expect(decision.patchSuppressed).toBe(false);
  });

  it("does not force clarification on create mode (ambiguity downgrades to series)", () => {
    const decision = decideScopeAmbiguity({
      mode: "create",
      scope: "ambiguous",
      modelNextAction: "show_preview",
      modelClarificationQuestion: null,
      modelBlockingFields: [],
    });
    expect(decision.forced).toBe(false);
    expect(decision.nextAction).toBe("show_preview");
  });

  it("preserves model clarification when already asking, no scope-forcing churn", () => {
    const decision = decideScopeAmbiguity({
      mode: "edit_occurrence",
      scope: "ambiguous",
      modelNextAction: "ask_clarification",
      modelClarificationQuestion: "Just this date or every Thursday?",
      modelBlockingFields: ["scope"],
    });
    expect(decision.forced).toBe(true);
    expect(decision.patchSuppressed).toBe(false);
    expect(decision.blockingFields).toEqual(["scope"]);
  });
});

describe("aiPromptContract — current event projection", () => {
  it("uses field names that match the patch field registry exactly", () => {
    // Sample the high-risk patch fields and confirm each is in the projection.
    for (const field of [
      "event_date",
      "start_time",
      "end_time",
      "recurrence_rule",
      "venue_id",
      "venue_name",
      "cover_image_url",
      "is_published",
      "status",
    ]) {
      expect(AI_PROMPT_CURRENT_EVENT_FIELDS).toContain(field);
    }
  });

  it("drops unknown columns and undefined values while preserving null", () => {
    const projected = projectCurrentEventForPrompt({
      id: "e1",
      title: "T",
      host_id: "leak-me-not",
      region_id: "leak-me-not",
      verified_by: "leak-me-not",
      end_time: undefined,
      cover_image_url: null,
    });
    expect(projected.id).toBe("e1");
    expect(projected.title).toBe("T");
    expect(projected.host_id).toBeUndefined();
    expect(projected.region_id).toBeUndefined();
    expect(projected.verified_by).toBeUndefined();
    expect(projected.end_time).toBeUndefined();
    expect("cover_image_url" in projected).toBe(true);
    expect(projected.cover_image_url).toBeNull();
  });
});

describe("aiPromptContract — eval harness validation (PR 4 fixtures)", () => {
  /**
   * Drive the merged eval harness against representative outputs that the
   * new prompt contract is designed to elicit. This is the PR-body
   * pass/total summary input — every fixture should pass when the model
   * follows the §13.2 contract.
   */
  it("passes all PR 4 fixtures with contract-compliant outputs", () => {
    const outputsById: Record<string, Track1EvalScenarioOutput> = {
      "scope-ambiguous-next-thursday": {
        scope: "ambiguous",
        followUpQuestion:
          "Did you want to change just this one occurrence, or the whole recurring series?",
      },
      "scope-series-whole-series": {
        scope: "series",
      },
      "image-switch-other-image": {
        scope: "occurrence",
        selectedImageIndex: 1,
      },
      "event-type-inferred-from-source": {
        scope: "series",
        inferredEventTypes: ["workshop", "open mic", "showcase"],
      },
      "venue-change-resolves-existing": {
        scope: "series",
        venueResolutionHint: "Matched venue: Lost Lake",
      },
      "missing-event-type-no-hard-block": {
        scope: "series",
        assistantText: "I can apply those updates without blocking on event type.",
      },
    };

    const results = evaluateTrack1Outputs(outputsById);
    const passed = results.filter((r) => r.passed).length;
    expect(passed).toBe(TRACK1_EVAL_CASES.length);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
