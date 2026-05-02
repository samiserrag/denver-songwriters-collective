/**
 * Lane 5 PR A — unit tests for the event audit helper module.
 *
 * Covers the pure surface (payload building, flag check, helpers) so we
 * don't need to mock Supabase. The actual insert path is exercised by
 * the source-text contract tests in event-audit-route-hooks.test.ts —
 * the routes call `logEventAudit({...}).catch(...)` and the helper
 * short-circuits on the flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEventAuditRowPayload,
  isEventAuditLogEnabled,
  resolveEventAuditActorRole,
  resolveEventAuditSource,
  snapshotFromEventRow,
  type LogEventAuditInput,
} from "../lib/audit/eventAudit";

describe("event audit helper — feature flag", () => {
  const originalFlag = process.env.EVENT_AUDIT_LOG_ENABLED;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EVENT_AUDIT_LOG_ENABLED;
    else process.env.EVENT_AUDIT_LOG_ENABLED = originalFlag;
  });

  it("returns false when EVENT_AUDIT_LOG_ENABLED is unset (default-off per Sami's §7 #9)", () => {
    delete process.env.EVENT_AUDIT_LOG_ENABLED;
    expect(isEventAuditLogEnabled()).toBe(false);
  });

  it("returns false for any value other than the literal string 'true'", () => {
    for (const v of ["false", "0", "1", "TRUE", "True", "yes", ""]) {
      process.env.EVENT_AUDIT_LOG_ENABLED = v;
      expect(isEventAuditLogEnabled()).toBe(false);
    }
  });

  it("returns true only when EVENT_AUDIT_LOG_ENABLED === 'true'", () => {
    process.env.EVENT_AUDIT_LOG_ENABLED = "true";
    expect(isEventAuditLogEnabled()).toBe(true);
  });
});

describe("event audit helper — snapshotFromEventRow", () => {
  it("returns just the eventId when row is null/undefined (event already gone)", () => {
    expect(snapshotFromEventRow("abc", null)).toEqual({ eventId: "abc" });
    expect(snapshotFromEventRow("abc", undefined)).toEqual({ eventId: "abc" });
  });

  it("extracts title/slug/event_date/venue_name when present", () => {
    const snap = snapshotFromEventRow("evt-1", {
      title: "Tuesday Open Mic",
      slug: "tuesday-open-mic",
      event_date: "2026-06-04",
      venue_name: "Lost Lake",
    });
    expect(snap).toEqual({
      eventId: "evt-1",
      title: "Tuesday Open Mic",
      slug: "tuesday-open-mic",
      startDate: "2026-06-04",
      venueName: "Lost Lake",
    });
  });

  it("falls back to start_date when event_date is missing", () => {
    const snap = snapshotFromEventRow("evt-2", { start_date: "2026-07-01" });
    expect(snap.startDate).toBe("2026-07-01");
  });

  it("falls back to custom_location_name when venue_name is missing", () => {
    const snap = snapshotFromEventRow("evt-3", {
      custom_location_name: "Some backyard",
    });
    expect(snap.venueName).toBe("Some backyard");
  });

  it("ignores non-string fields without throwing", () => {
    const snap = snapshotFromEventRow("evt-4", {
      title: 123 as unknown as string,
      slug: null,
    });
    expect(snap.title).toBeNull();
    expect(snap.slug).toBeNull();
  });
});

describe("event audit helper — resolveEventAuditSource", () => {
  it("maps the conversational AI write source family to ai_edit", () => {
    expect(
      resolveEventAuditSource({ aiWriteSource: "conversational_create_ui_auto_apply" })
    ).toBe("ai_edit");
    expect(
      resolveEventAuditSource({ aiWriteSource: "conversational_create_ui_chat_v2" })
    ).toBe("ai_edit");
  });

  it("maps any non-empty aiWriteSource string to ai_edit (forward compatible)", () => {
    expect(resolveEventAuditSource({ aiWriteSource: "future_ai_origin" })).toBe("ai_edit");
  });

  it("respects body.audit_source when set to a known enum value", () => {
    expect(
      resolveEventAuditSource({ body: { audit_source: "import" } })
    ).toBe("import");
    expect(
      resolveEventAuditSource({ body: { audit_source: "admin_console" } })
    ).toBe("admin_console");
  });

  it("falls back to manual_form when no source signals are present", () => {
    expect(resolveEventAuditSource({})).toBe("manual_form");
    expect(resolveEventAuditSource({ aiWriteSource: null, body: null })).toBe(
      "manual_form"
    );
  });

  it("ignores body.audit_source when the value is not a known enum", () => {
    expect(
      resolveEventAuditSource({ body: { audit_source: "made_up_source" } })
    ).toBe("manual_form");
  });
});

describe("event audit helper — resolveEventAuditActorRole", () => {
  it("returns admin when isAdmin even if isHost is true", () => {
    expect(
      resolveEventAuditActorRole({ isAdmin: true, isHost: true, isCohost: false })
    ).toBe("admin");
  });

  it("returns host before cohost", () => {
    expect(
      resolveEventAuditActorRole({ isAdmin: false, isHost: true, isCohost: true })
    ).toBe("host");
  });

  it("returns cohost when only cohost is true", () => {
    expect(
      resolveEventAuditActorRole({ isAdmin: false, isHost: false, isCohost: true })
    ).toBe("cohost");
  });

  it("falls back to unknown when no role flag is set", () => {
    expect(
      resolveEventAuditActorRole({ isAdmin: false, isHost: false, isCohost: false })
    ).toBe("unknown");
  });
});

describe("event audit helper — buildEventAuditRowPayload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T18:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function baseInput(overrides: Partial<LogEventAuditInput> = {}): LogEventAuditInput {
    return {
      eventId: "evt-1",
      eventSnapshot: {
        eventId: "evt-1",
        title: "Tuesday Open Mic",
        slug: "tuesday-open-mic",
        startDate: "2026-06-04",
        venueName: "Lost Lake",
      },
      actorId: "user-1",
      actorRole: "host",
      action: "update",
      source: "manual_form",
      ...overrides,
    };
  }

  it("populates the denormalized snapshot fields verbatim", () => {
    const row = buildEventAuditRowPayload(baseInput());
    expect(row.event_id).toBe("evt-1");
    expect(row.event_id_at_observation).toBe("evt-1");
    expect(row.event_title_at_observation).toBe("Tuesday Open Mic");
    expect(row.event_slug_at_observation).toBe("tuesday-open-mic");
    expect(row.event_start_date_at_observation).toBe("2026-06-04");
    expect(row.event_venue_name_at_observation).toBe("Lost Lake");
  });

  it("survives a deleted event by accepting null event_id while keeping the snapshot", () => {
    const row = buildEventAuditRowPayload(baseInput({ eventId: null, action: "delete" }));
    expect(row.event_id).toBeNull();
    expect(row.event_id_at_observation).toBe("evt-1");
    expect(row.event_title_at_observation).toBe("Tuesday Open Mic");
  });

  it("returns an empty changed_fields array when no prevEvent / nextEvent are passed", () => {
    const row = buildEventAuditRowPayload(baseInput({ action: "create" }));
    expect(row.changed_fields).toEqual([]);
  });

  it("computes changed_fields via computePatchDiff when both prev and next are provided", () => {
    const row = buildEventAuditRowPayload(
      baseInput({
        prevEvent: { title: "Old title", description: "x" },
        nextEvent: { title: "New title", description: "x" },
      })
    );
    expect(Array.isArray(row.changed_fields)).toBe(true);
    const fields = row.changed_fields as Array<{ field: string }>;
    expect(fields.some((f) => f.field === "title")).toBe(true);
    expect(fields.some((f) => f.field === "description")).toBe(false);
  });

  it("hashes the IP with a daily salt — same IP same day → same hash", () => {
    const a = buildEventAuditRowPayload(
      baseInput({ request: { remoteIp: "1.2.3.4" } })
    );
    const b = buildEventAuditRowPayload(
      baseInput({ request: { remoteIp: "1.2.3.4" } })
    );
    expect(a.ip_hash).not.toBeNull();
    expect(a.ip_hash).toBe(b.ip_hash);
  });

  it("never stores the plaintext IP in any field (privacy invariant)", () => {
    const row = buildEventAuditRowPayload(
      baseInput({ request: { remoteIp: "9.9.9.9" } })
    );
    expect(JSON.stringify(row)).not.toContain("9.9.9.9");
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("classifies user-agent strings into bucket: bot / mobile / browser / unknown", () => {
    const cases: Array<[string | null, string]> = [
      ["curl/7.79.1", "bot"],
      ["python-requests/2.28.1", "bot"],
      ["Mozilla/5.0 (iPhone; CPU iPhone OS 16_4)", "mobile"],
      ["Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0", "browser"],
      [null, "unknown"],
      ["", "unknown"],
    ];
    for (const [ua, expected] of cases) {
      const row = buildEventAuditRowPayload(
        baseInput({ request: { userAgent: ua ?? undefined } })
      );
      expect(row.user_agent_class).toBe(expected);
    }
  });

  it("uses caller-provided summary when set (never overrides explicit text)", () => {
    const row = buildEventAuditRowPayload(
      baseInput({ summary: "Custom one-liner from the route" })
    );
    expect(row.summary).toBe("Custom one-liner from the route");
  });

  it("auto-generates an action-aware summary when caller omits it", () => {
    expect(buildEventAuditRowPayload(baseInput({ action: "create" })).summary).toBe(
      "Event created"
    );
    expect(buildEventAuditRowPayload(baseInput({ action: "delete" })).summary).toBe(
      "Event deleted"
    );
    expect(buildEventAuditRowPayload(baseInput({ action: "cancel" })).summary).toBe(
      "Event cancelled"
    );
    expect(buildEventAuditRowPayload(baseInput({ action: "publish" })).summary).toBe(
      "Event published"
    );
    expect(
      buildEventAuditRowPayload(baseInput({ action: "cover_update" })).summary
    ).toBe("Cover image updated");
  });

  it("passes the actor + action + source through verbatim", () => {
    const row = buildEventAuditRowPayload(
      baseInput({ actorId: null, actorRole: "service", action: "publish", source: "service_role" })
    );
    expect(row.actor_id).toBeNull();
    expect(row.actor_role).toBe("service");
    expect(row.action).toBe("publish");
    expect(row.source).toBe("service_role");
  });

  it("passes through caller-provided priorHash and requestId", () => {
    const row = buildEventAuditRowPayload(
      baseInput({
        priorHash: "abc123",
        request: { requestId: "vercel-id-xyz" },
      })
    );
    expect(row.prior_hash).toBe("abc123");
    expect(row.request_id).toBe("vercel-id-xyz");
  });

  it("nulls out optional fields when not provided", () => {
    const row = buildEventAuditRowPayload(
      baseInput({
        priorHash: undefined,
        request: undefined,
      })
    );
    expect(row.prior_hash).toBeNull();
    expect(row.request_id).toBeNull();
    expect(row.ip_hash).toBeNull();
    expect(row.user_agent_class).toBe("unknown");
  });
});
