import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EDIT_TURN_TELEMETRY_LOG_PREFIX,
  buildEditTurnTelemetryEvent,
  emitEditTurnTelemetry,
  hashPriorState,
  type BuildEditTurnTelemetryInput,
  type EditTurnTelemetryEvent,
} from "@/lib/events/editTurnTelemetry";
import type {
  EnforcementMode,
  RiskTier,
} from "@/lib/events/patchFieldRegistry";

const FIXED_OCCURRED_AT = "2026-04-30T12:34:56.000Z";

function minimalInput(
  overrides: Partial<BuildEditTurnTelemetryInput> = {},
): BuildEditTurnTelemetryInput {
  return {
    mode: "edit_series",
    riskTier: "high",
    enforcementMode: "enforced",
    latencyMs: 250,
    occurredAt: FIXED_OCCURRED_AT,
    ...overrides,
  };
}

describe("buildEditTurnTelemetryEvent", () => {
  it("produces a fully-populated event from a minimal input set", () => {
    const event = buildEditTurnTelemetryEvent(minimalInput());

    expect(event).toEqual<EditTurnTelemetryEvent>({
      mode: "edit_series",
      currentEventId: null,
      priorStateHash: null,
      scopeDecision: null,
      proposedChangedFields: [],
      verifierAutoPatchedFields: [],
      riskTier: "high",
      enforcementMode: "enforced",
      blockedFields: [],
      userOutcome: "unknown",
      modelId: null,
      latencyMs: 250,
      occurredAt: FIXED_OCCURRED_AT,
    });
  });

  it("coerces userOutcome default to 'unknown' when omitted", () => {
    const event = buildEditTurnTelemetryEvent(minimalInput());
    expect(event.userOutcome).toBe("unknown");
  });

  it("preserves explicitly-provided userOutcome values", () => {
    const accepted = buildEditTurnTelemetryEvent(
      minimalInput({ userOutcome: "accepted" }),
    );
    const rejected = buildEditTurnTelemetryEvent(
      minimalInput({ userOutcome: "rejected" }),
    );

    expect(accepted.userOutcome).toBe("accepted");
    expect(rejected.userOutcome).toBe("rejected");
  });

  it("copies array inputs so caller mutation cannot leak into the event", () => {
    const proposed = ["title", "description"];
    const event = buildEditTurnTelemetryEvent(
      minimalInput({ proposedChangedFields: proposed }),
    );
    proposed.push("start_time");

    expect(event.proposedChangedFields).toEqual(["title", "description"]);
  });

  it("rejects events with bad enum values for mode", () => {
    expect(() =>
      buildEditTurnTelemetryEvent(
        minimalInput({ mode: "edit_everything" as unknown as BuildEditTurnTelemetryInput["mode"] }),
      ),
    ).toThrow(/invalid mode/);
  });

  it("rejects events with bad enum values for scopeDecision", () => {
    expect(() =>
      buildEditTurnTelemetryEvent(
        minimalInput({
          scopeDecision: "all" as unknown as BuildEditTurnTelemetryInput["scopeDecision"],
        }),
      ),
    ).toThrow(/invalid scopeDecision/);
  });

  it("rejects events with bad enum values for riskTier", () => {
    expect(() =>
      buildEditTurnTelemetryEvent(
        minimalInput({
          riskTier: "critical" as unknown as RiskTier,
        }),
      ),
    ).toThrow(/invalid riskTier/);
  });

  it("rejects events with bad enum values for enforcementMode", () => {
    expect(() =>
      buildEditTurnTelemetryEvent(
        minimalInput({
          enforcementMode: "audit" as unknown as EnforcementMode,
        }),
      ),
    ).toThrow(/invalid enforcementMode/);
  });

  it("rejects events with bad enum values for userOutcome", () => {
    expect(() =>
      buildEditTurnTelemetryEvent(
        minimalInput({
          userOutcome: "maybe" as unknown as BuildEditTurnTelemetryInput["userOutcome"],
        }),
      ),
    ).toThrow(/invalid userOutcome/);
  });

  it("rejects events with negative latencyMs", () => {
    expect(() =>
      buildEditTurnTelemetryEvent(minimalInput({ latencyMs: -1 })),
    ).toThrow(/latencyMs/);
  });
});

describe("hashPriorState", () => {
  it("returns null for null input (not a hash of \"null\")", () => {
    expect(hashPriorState(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(hashPriorState(undefined)).toBeNull();
  });

  it("produces a 16-char lowercase hex string for a non-null input", () => {
    const hash = hashPriorState({ title: "Open mic", venue_id: "abc" });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable across object key reordering", () => {
    const a = hashPriorState({ title: "Open mic", venue_id: "abc", capacity: 12 });
    const b = hashPriorState({ capacity: 12, venue_id: "abc", title: "Open mic" });
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("normalizes nested object key order recursively", () => {
    const a = hashPriorState({
      meta: { rev: 3, slug: "x" },
      tags: ["jazz", "open-mic"],
    });
    const b = hashPriorState({
      tags: ["jazz", "open-mic"],
      meta: { slug: "x", rev: 3 },
    });
    expect(a).toBe(b);
  });

  it("preserves array order (different orders hash differently)", () => {
    const a = hashPriorState({ tags: ["jazz", "open-mic"] });
    const b = hashPriorState({ tags: ["open-mic", "jazz"] });
    expect(a).not.toBe(b);
  });

  it("differs between distinct payloads", () => {
    const a = hashPriorState({ title: "A" });
    const b = hashPriorState({ title: "B" });
    expect(a).not.toBe(b);
  });
});

describe("emitEditTurnTelemetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes one structured line to console.info with the expected prefix and event JSON", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = buildEditTurnTelemetryEvent(
      minimalInput({
        currentEventId: "evt-123",
        scopeDecision: "series",
        proposedChangedFields: ["title"],
        modelId: "claude-opus-4-7",
      }),
    );

    emitEditTurnTelemetry(event);

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line.startsWith(`${EDIT_TURN_TELEMETRY_LOG_PREFIX} `)).toBe(true);
    const payload = JSON.parse(line.slice(EDIT_TURN_TELEMETRY_LOG_PREFIX.length + 1));
    expect(payload).toEqual(event);
  });

  it("throws on a malformed event without writing to console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const malformed = {
      mode: "edit_series",
      currentEventId: null,
      priorStateHash: null,
      scopeDecision: null,
      proposedChangedFields: [],
      verifierAutoPatchedFields: [],
      riskTier: "high",
      enforcementMode: "enforced",
      blockedFields: [],
      userOutcome: "unknown",
      modelId: null,
      latencyMs: 100,
      occurredAt: "not-an-iso-timestamp",
    } as unknown as EditTurnTelemetryEvent;

    expect(() => emitEditTurnTelemetry(malformed)).toThrow(/occurredAt/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("round-trips: emit(build(input)) produces the expected serialized line", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const input = minimalInput({
      mode: "edit_occurrence",
      currentEventId: "evt-rt-1",
      priorStateHash: "abcdef0123456789",
      scopeDecision: "occurrence",
      proposedChangedFields: ["start_time"],
      verifierAutoPatchedFields: ["event_type"],
      blockedFields: [],
      userOutcome: "accepted",
      riskTier: "high",
      enforcementMode: "enforced",
      modelId: "claude-opus-4-7",
      latencyMs: 875,
    });

    emitEditTurnTelemetry(buildEditTurnTelemetryEvent(input));

    const expected = {
      mode: "edit_occurrence",
      currentEventId: "evt-rt-1",
      priorStateHash: "abcdef0123456789",
      scopeDecision: "occurrence",
      proposedChangedFields: ["start_time"],
      verifierAutoPatchedFields: ["event_type"],
      riskTier: "high",
      enforcementMode: "enforced",
      blockedFields: [],
      userOutcome: "accepted",
      modelId: "claude-opus-4-7",
      latencyMs: 875,
      occurredAt: FIXED_OCCURRED_AT,
    } satisfies EditTurnTelemetryEvent;

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(
      `${EDIT_TURN_TELEMETRY_LOG_PREFIX} ${JSON.stringify(expected)}`,
    );
  });
});

describe("riskTier / enforcementMode type alignment with patchFieldRegistry", () => {
  // Compile-time check: the schema's riskTier / enforcementMode must be the
  // exact unions exported from patchFieldRegistry. Any drift in either union
  // would fail TypeScript here without changing runtime behavior.
  it("uses the same RiskTier and EnforcementMode unions as the registry", () => {
    const tiers: RiskTier[] = ["low", "medium", "high"];
    const modes: EnforcementMode[] = ["enforced", "shadow"];

    for (const riskTier of tiers) {
      for (const enforcementMode of modes) {
        const event = buildEditTurnTelemetryEvent(
          minimalInput({ riskTier, enforcementMode }),
        );
        expect(event.riskTier).toBe(riskTier);
        expect(event.enforcementMode).toBe(enforcementMode);
      }
    }
  });
});
