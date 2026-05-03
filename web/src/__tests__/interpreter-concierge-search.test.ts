import { beforeEach, describe, expect, it, vi } from "vitest";

let capturedSearchPrompts: Record<string, unknown>[] = [];
let capturedInterpreterPrompt: Record<string, unknown> | null = null;
let searchMode: "venue-partial" | "event-timeout" | "timeout" = "venue-partial";

const createChainable = (result: Record<string, unknown>) => {
  const chainable: Record<string, unknown> = {
    ...result,
    order: () => chainable,
    limit: () => result,
    eq: () => chainable,
    single: () => result,
    maybeSingle: () => result,
  };
  return chainable;
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null }),
    },
    rpc: async () => ({ data: null, error: { message: "use fallback" } }),
    from: (table: string) => {
      if (table === "venues") {
        return {
          select: () => createChainable({ data: [], error: null }),
        };
      }
      return {
        select: () => createChainable({ data: null, error: null }),
      };
    },
  }),
}));

vi.mock("@/lib/events/nextOccurrence", () => ({
  getTodayDenver: () => "2026-05-02",
  expandOccurrencesForEvent: () => [],
}));

vi.mock("@/lib/events/editTurnTelemetry", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/events/editTurnTelemetry")>();
  return {
    ...original,
    emitEditTurnTelemetry: vi.fn(),
  };
});

import { POST } from "@/app/api/events/interpret/route";

function openAiResponse(payload: Record<string, unknown>) {
  return {
    id: "resp_test",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(payload) }],
      },
    ],
  };
}

function venueSearchPayload(eventStatus: "not_found" | "timeout" | "not_applicable" = "not_applicable") {
  return {
    status: "searched",
    summary: "Official venue page found for RMU Breckenridge.",
    facts: ["Official venue page confirms RMU Breckenridge in Breckenridge, CO 80424."],
    sources: [{ url: "https://example.com/rmu-breckenridge", title: "RMU Breckenridge" }],
    venue_search: {
      status: "verified",
      summary: "Official venue page found for RMU Breckenridge.",
      confidence: "high",
      attempted_queries: ["RMU Breck", "RMU Breckenridge", "@rmubreck", "RMU Breckenridge address"],
      facts: [
        "RMU Breckenridge official page confirms the venue identity and Breckenridge address.",
      ],
      sources: [{ url: "https://example.com/rmu-breckenridge", title: "RMU Breckenridge" }],
    },
    event_search: {
      status: eventStatus,
      summary:
        eventStatus === "timeout"
          ? "Exact-event search timed out before returning a public open mic listing."
          : "This venue-focused pass did not verify an exact open mic listing.",
      confidence: "unknown",
      attempted_queries: [],
      facts: [],
      sources: [],
    },
    fact_buckets: {
      user_provided: ["User asked to search for RMU Breckenridge."],
      extracted: ["Flyer says Open Mic Night, every Wednesday, 7-9pm, @rmubreck."],
      inferred: ["First occurrence date should be confirmed from the next Wednesday."],
      searched_verified: ["RMU Breckenridge official venue page found with high confidence."],
      conflicts: [],
      true_unknowns: ["cost", "signup link", "direct source link"],
    },
    suggested_questions: [
      "Use Wednesday, May 6, 2026 as the first occurrence?",
      "Is it free, or should cost stay blank?",
      "Is signup walk-up, host-managed, or linked?",
    ],
  };
}

function fastVenueSearchPayload() {
  return {
    status: "verified",
    summary: "Official venue page found for RMU Breckenridge.",
    confidence: "high",
    attempted_queries: ["RMU Breckenridge", "RMU Breckenridge address", "@rmubreck"],
    facts: [
      "RMU Breckenridge official page confirms the venue identity and Breckenridge, CO address.",
    ],
    sources: [{ url: "https://example.com/rmu-breckenridge", title: "RMU Breckenridge" }],
  };
}

function eventSearchMissPayload() {
  return {
    status: "no_reliable_sources",
    summary: "No exact public open mic listing was found.",
    facts: [],
    sources: [],
    venue_search: {
      status: "not_applicable",
      summary: "This exact-event pass did not run venue enrichment.",
      confidence: "unknown",
      attempted_queries: [],
      facts: [],
      sources: [],
    },
    event_search: {
      status: "not_found",
      summary: "No exact public open mic listing was found.",
      confidence: "medium",
      attempted_queries: ["RMU Breckenridge open mic"],
      facts: [],
      sources: [],
    },
    fact_buckets: {
      user_provided: ["User asked to search for RMU Breckenridge."],
      extracted: ["Flyer says Open Mic Night, every Wednesday, 7-9pm, @rmubreck."],
      inferred: [],
      searched_verified: [],
      conflicts: [],
      true_unknowns: ["exact public event listing", "cost", "signup link", "direct source link"],
    },
    suggested_questions: [],
  };
}

function installFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string; input?: unknown };

    if (body.model === "test-search-model") {
      const searchPrompt = JSON.parse(String(body.input)) as Record<string, unknown>;
      capturedSearchPrompts.push(searchPrompt);
      if (searchMode === "timeout") {
        const error = new Error("search timeout");
        error.name = "AbortError";
        throw error;
      }
      if (searchMode === "event-timeout" && searchPrompt.search_category === "event") {
        const error = new Error("event search timeout");
        error.name = "AbortError";
        throw error;
      }
      const payload =
        searchPrompt.task === "fast_venue_enrichment_for_event_draft"
          ? fastVenueSearchPayload()
          : searchPrompt.search_category === "venue"
            ? venueSearchPayload()
            : eventSearchMissPayload();
      return new Response(
        JSON.stringify(openAiResponse(payload)),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (body.model === "test-interpreter-model") {
      capturedInterpreterPrompt = JSON.parse(String(body.input)) as Record<string, unknown>;
      return new Response(
        JSON.stringify(
          openAiResponse({
            next_action: "show_preview",
            confidence: 0.86,
            human_summary:
              "I found RMU Breckenridge's official venue page and can use it for the reusable venue record. I did not find a public listing for this exact open mic, so I'll keep event details limited to the flyer: Wednesdays 7-9pm. Cost/signup/source link are still unknown.",
            clarification_question: null,
            blocking_fields: [],
            scope: "series",
            draft_payload: {
              title: "RMU Breckenridge - Open Mic",
              description: "Open mic night at RMU Breckenridge. Every Wednesday from 7-9pm.",
              event_type: ["open_mic"],
              start_date: "2026-05-06",
              start_time: "19:00:00",
              end_time: "21:00:00",
              series_mode: "weekly",
              recurrence_rule: "weekly",
              venue_name: "RMU Breckenridge",
              custom_location_name: "RMU Breckenridge",
              custom_address: "114 S Main St",
              custom_city: "Breckenridge",
              custom_state: "CO",
              custom_zip: "80424",
              location_mode: "venue",
              is_free: null,
              cost_label: null,
              signup_url: null,
              external_url: null,
            },
          })
        ),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (body.model === "test-verifier-model") {
      return new Response(
        JSON.stringify(
          openAiResponse({
            status: "pass",
            summary: "Looks usable.",
            issues: [],
            patches: [],
          })
        ),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected fetch model: ${body.model ?? "unknown"}`);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  capturedSearchPrompts = [];
  capturedInterpreterPrompt = null;
  searchMode = "venue-partial";
  process.env.ENABLE_NL_EVENTS_INTERPRETER = "true";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_EVENT_INTERPRETER_MODEL = "test-interpreter-model";
  process.env.OPENAI_EVENT_WEB_SEARCH_MODEL = "test-search-model";
  process.env.OPENAI_EVENT_DRAFT_VERIFIER_MODEL = "test-verifier-model";
  process.env.OPENAI_EVENT_WEB_SEARCH_ENABLED = "true";
});

describe("POST /api/events/interpret — concierge search enrichment", () => {
  it("uses official venue-page success even when exact event search misses", async () => {
    installFetchMock();

    const response = await POST(
      new Request("http://localhost/api/events/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          message:
            "Flyer OCR: OPEN MIC NIGHT. Every Wednesday 7-9pm. Venue: RMU Breck / @rmubreck. Search for RMU Breckenridge.",
          use_web_search: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.next_action).toBe("show_preview");
    expect(body.clarification_question).toBeNull();
    expect(body.blocking_fields).not.toContain("venue_id");
    expect(body.draft_payload.custom_location_name).toBe("RMU Breckenridge");
    expect(body.draft_payload.custom_address).toBe("114 S Main St");
    expect(body.draft_payload.cost_label).toBeNull();
    expect(body.draft_payload.signup_url).toBeNull();
    expect(body.draft_payload.external_url).toBeNull();
    expect(body.web_search_verification.venue_search.status).toBe("verified");
    expect(body.web_search_verification.event_search.status).toBe("not_found");
    expect(body.human_summary).toContain("official venue page");
    expect(body.human_summary).toContain("Cost/signup/source link are still unknown");

    const venuePrompt = capturedSearchPrompts.find((prompt) => prompt.task === "fast_venue_enrichment_for_event_draft");
    const eventPrompt = capturedSearchPrompts.find((prompt) => prompt.search_category === "event");
    expect(capturedSearchPrompts.some((prompt) => prompt.search_category === "venue")).toBe(false);
    expect(venuePrompt?.venue_queries).toEqual(
      expect.arrayContaining(["RMU Breckenridge", "RMU Breckenridge address", "@rmubreck"])
    );
    expect((venuePrompt?.venue_queries as string[]).length).toBeLessThanOrEqual(3);
    const eventSearchPlan = eventPrompt?.search_query_plan as {
      venue_queries: string[];
      event_queries: string[];
    };
    expect(eventSearchPlan.venue_queries).toEqual([]);
    expect(eventSearchPlan.event_queries).toContain("RMU Breckenridge open mic");
    expect(capturedInterpreterPrompt?.web_search_verification).toMatchObject({
      venue_search: { status: "verified", confidence: "high" },
      event_search: { status: "not_found" },
    });
  });

  it("preserves venue enrichment when exact-event search times out", async () => {
    searchMode = "event-timeout";
    installFetchMock();

    const response = await POST(
      new Request("http://localhost/api/events/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          message:
            "Flyer OCR: OPEN MIC NIGHT. Every Wednesday 7-9pm. Venue: RMU Breck / @rmubreck. Search for RMU Breckenridge.",
          use_web_search: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.web_search_verification.venue_search.status).toBe("verified");
    expect(body.web_search_verification.event_search.status).toBe("timeout");
    expect(body.web_search_verification.summary).toContain("Exact-event search timed out");
    expect(capturedInterpreterPrompt?.web_search_verification).toMatchObject({
      status: "searched",
      venue_search: { status: "verified" },
      event_search: { status: "timeout" },
    });
    expect(capturedSearchPrompts.some((prompt) => prompt.search_category === "venue")).toBe(false);
  });

  it("forces deterministic guidance when all search times out even if the interpreter returns valid JSON", async () => {
    searchMode = "timeout";
    installFetchMock();

    const response = await POST(
      new Request("http://localhost/api/events/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          message:
            "Flyer OCR: OPEN MIC NIGHT. Every Wednesday 7-9pm. Venue: RMU Breck / @rmubreck. Search for RMU Breckenridge.",
          use_web_search: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const webSearch = capturedInterpreterPrompt?.web_search_verification as {
      summary: string;
      venue_search: { status: string; attempted_queries: string[] };
      event_search: { status: string; attempted_queries: string[] };
    };
    expect(webSearch.summary).toContain("Venue search tried");
    expect(webSearch.summary).toContain("Exact-event search tried");
    expect(webSearch.venue_search.status).toBe("timeout");
    expect(webSearch.venue_search.attempted_queries).toEqual(
      expect.arrayContaining(["RMU Breckenridge", "RMU Breckenridge address", "@rmubreck"])
    );
    expect(webSearch.venue_search.attempted_queries).toHaveLength(3);
    expect(webSearch.event_search.status).toBe("timeout");
    expect(webSearch.event_search.attempted_queries).toContain("RMU Breckenridge open mic");
    expect(capturedSearchPrompts.some((prompt) => prompt.search_category === "venue")).toBe(false);
    expect(body.next_action).toBe("ask_clarification");
    expect(body.human_summary).toContain("Venue search and exact-event search both timed out");
    expect(body.human_summary).toContain("Cost, signup link, and direct source link are still unknown");
    expect(body.clarification_question).toContain("retry search");
    expect(body.clarification_question).toContain("custom location");
    expect(body.clarification_question).not.toMatch(/street address|address/i);
    expect(body.draft_payload.title).toContain("RMU");
    expect(body.draft_payload.event_type).toEqual(["open_mic"]);
    expect(body.draft_payload.start_time).toBe("19:00:00");
    expect(body.draft_payload.end_time).toBe("21:00:00");
    expect(body.draft_payload.cost_label).toBeUndefined();
    expect(body.draft_payload.signup_url).toBeUndefined();
    expect(body.draft_payload.external_url).toBeUndefined();
    expect(body.draft_payload.custom_address).toBeUndefined();
    expect(body.web_search_verification.venue_search.status).toBe("timeout");
    expect(body.web_search_verification.event_search.status).toBe("timeout");
  });

  it("recovers with structured fallback JSON when all search times out and the interpreter emits non-json", async () => {
    searchMode = "timeout";
    const fetchMock = installFetchMock();
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string; input?: unknown };
      if (body.model === "test-search-model") {
        const searchPrompt = JSON.parse(String(body.input)) as Record<string, unknown>;
        capturedSearchPrompts.push(searchPrompt);
        const error = new Error("search timeout");
        error.name = "AbortError";
        throw error;
      }
      if (body.model === "test-interpreter-model") {
        capturedInterpreterPrompt = JSON.parse(String(body.input)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            id: "resp_non_json",
            output: [
              {
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: "I drafted this as a weekly RMU Breck open mic, but search timed out.",
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected fetch model: ${body.model ?? "unknown"}`);
    });

    const response = await POST(
      new Request("http://localhost/api/events/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          message:
            "Open mic RMU update. RMU Breck / @rmubreck. Every Wednesday 7-9pm. Search for RMU Breckenridge. I do not know the address, cost, signup link, or source URL.",
          use_web_search: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.next_action).toBe("ask_clarification");
    expect(body.human_summary).toContain("Venue search and exact-event search both timed out");
    expect(body.clarification_question).toContain("retry search");
    expect(body.draft_payload.title).toContain("RMU");
    expect(body.draft_payload.event_type).toEqual(["open_mic"]);
    expect(body.draft_payload.start_time).toBe("19:00:00");
    expect(body.draft_payload.end_time).toBe("21:00:00");
    expect(body.draft_payload.cost_label).toBeUndefined();
    expect(body.draft_payload.signup_url).toBeUndefined();
    expect(body.draft_payload.external_url).toBeUndefined();
    expect(body.web_search_verification.venue_search.status).toBe("timeout");
    expect(body.web_search_verification.event_search.status).toBe("timeout");
  });
});
