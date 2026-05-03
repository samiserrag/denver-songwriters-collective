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
        searchPrompt.search_category === "venue"
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

    const venuePrompt = capturedSearchPrompts.find((prompt) => prompt.search_category === "venue");
    const eventPrompt = capturedSearchPrompts.find((prompt) => prompt.search_category === "event");
    const searchPlan = venuePrompt?.search_query_plan as {
      venue_queries: string[];
      event_queries: string[];
    };
    expect(searchPlan.venue_queries).toEqual(
      expect.arrayContaining(["RMU Breck", "RMU Breckenridge", "@rmubreck", "RMU Breckenridge address"])
    );
    expect(searchPlan.event_queries).toEqual([]);
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
  });

  it("reports venue and event query attempts separately on search timeout", async () => {
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
    const webSearch = capturedInterpreterPrompt?.web_search_verification as {
      summary: string;
      venue_search: { status: string; attempted_queries: string[] };
      event_search: { status: string; attempted_queries: string[] };
    };
    expect(webSearch.summary).toContain("Venue search tried");
    expect(webSearch.summary).toContain("Exact-event search tried");
    expect(webSearch.venue_search.status).toBe("timeout");
    expect(webSearch.venue_search.attempted_queries).toEqual(expect.arrayContaining(["RMU Breck", "RMU Breckenridge", "@rmubreck", "RMU Breckenridge address"]));
    expect(webSearch.event_search.status).toBe("timeout");
    expect(webSearch.event_search.attempted_queries).toContain("RMU Breckenridge open mic");
  });
});
