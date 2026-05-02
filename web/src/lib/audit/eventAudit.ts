/**
 * Event Audit Logger (Lane 5 PR A)
 *
 * Server-side helper that writes an immutable per-write row to
 * `event_audit_log` for every successful event mutation. Mirrors the
 * pattern in moderationAudit.ts / opsAudit.ts (service-role insert,
 * fire-and-forget on error).
 *
 * Approved scope (decision memo §2.1, PR A only):
 *   - Schema + RLS in 20260502190000_create_event_audit_log.sql.
 *   - This helper.
 *   - Hooks in event POST / PATCH / DELETE / overrides POST routes.
 *   - Axiom mirror via console.info("[event-audit]", payload) — Vercel
 *     runtime logs already drain to Axiom.
 *
 * Out of scope (PR B / PR C):
 *   - Suspicion scorer + admin email (PR B).
 *   - Admin browser UI / public transparency line (PR C).
 *   - Retention cleanup function (PR B).
 *
 * Feature flag default-off per Sami's §7 #9 answer:
 *   - Helper short-circuits when EVENT_AUDIT_LOG_ENABLED !== "true".
 *   - Routes always call the helper; flag check lives here.
 *   - Enable manually after migration apply + RLS smoke + production
 *     spot-check.
 *
 * Insert error handling per investigation §4.1:
 *   - Wrapped in try/catch; never throws to the caller.
 *   - Failure emits console.error("[event-audit-failed]", ...) so the
 *     gap itself is logged to Axiom.
 *   - PATCH/POST/DELETE responses are NOT blocked by audit failures.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  computePatchDiff,
  type FieldChange,
  type PatchDiffResult,
} from "@/lib/events/computePatchDiff";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type EventAuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish"
  | "cancel"
  | "restore"
  | "cover_update";

export type EventAuditSource =
  | "manual_form"
  | "ai_chat"
  | "ai_edit"
  | "api"
  | "admin_console"
  | "import"
  | "service_role";

export type EventAuditActorRole =
  | "host"
  | "cohost"
  | "admin"
  | "service"
  | "import"
  | "anon"
  | "unknown";

export interface EventAuditEventSnapshot {
  /** Original event id at audit-write time. Always required (denormalized). */
  eventId: string;
  title?: string | null;
  slug?: string | null;
  /** YYYY-MM-DD; falls back to event_date for non-recurring rows. */
  startDate?: string | null;
  venueName?: string | null;
}

export interface EventAuditRequestContext {
  /** Vercel request id (`x-vercel-id` header) or other correlator. */
  requestId?: string | null;
  /** Plaintext remote IP. Helper hashes it with a daily salt before write. */
  remoteIp?: string | null;
  /** Raw user-agent string. Helper buckets it before write. */
  userAgent?: string | null;
}

export interface LogEventAuditInput {
  /** Live event id; null for already-deleted events. */
  eventId: string | null;
  /** Required denormalized snapshot. Survives event delete. */
  eventSnapshot: EventAuditEventSnapshot;
  /** Auth.users.id of the actor; null for service / anon writes. */
  actorId: string | null;
  actorRole: EventAuditActorRole;
  action: EventAuditAction;
  source: EventAuditSource;
  /** Pre-update event row for diff. Omit for create/delete. */
  prevEvent?: Record<string, unknown> | null;
  /** Post-update event row for diff. Omit for delete. */
  nextEvent?: Record<string, unknown> | null;
  /** Optional human-readable summary. Helper auto-generates if omitted. */
  summary?: string | null;
  /** Hash of the prior state (caller passes hashPriorState if available). */
  priorHash?: string | null;
  request?: EventAuditRequestContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default-off per Sami's §7 #9 answer. Routes always call the helper;
 * this returns true only when ops has manually flipped the flag after
 * migration apply + RLS smoke check.
 */
export function isEventAuditLogEnabled(): boolean {
  return process.env.EVENT_AUDIT_LOG_ENABLED === "true";
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hash IP with a per-day salt so velocity scoring (PR B) works without
 * retaining the plaintext IP across days. Salt is the UTC date in
 * YYYY-MM-DD form — rotates daily without any external state.
 */
function hashIp(remoteIp: string): string {
  const dailySalt = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${remoteIp}|${dailySalt}`).digest("hex");
}

/**
 * Coarse user-agent classification. Intentionally crude; PR B uses this
 * as one signal among many. Fine-grained UA parsing is not in scope.
 */
function classifyUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (
    ua.includes("curl/") ||
    ua.includes("python-requests") ||
    ua.includes("node-fetch") ||
    ua.includes("axios/") ||
    ua.includes("phantom") ||
    ua.includes("headlesschrome") ||
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider")
  ) {
    return "bot";
  }
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }
  if (ua.includes("mozilla") || ua.includes("safari") || ua.includes("chrome")) {
    return "browser";
  }
  return "unknown";
}

/**
 * Build a one-line human-readable summary from a diff. Tops out at the
 * three most-impactful fields by risk tier so the admin browser row
 * stays readable.
 */
function buildSummary(diff: PatchDiffResult | null, action: EventAuditAction): string | null {
  if (action === "create") return "Event created";
  if (action === "delete") return "Event deleted";
  if (action === "cancel") return "Event cancelled";
  if (action === "restore") return "Event restored";
  if (action === "publish") return "Event published";
  if (action === "unpublish") return "Event unpublished";
  if (action === "cover_update") return "Cover image updated";

  if (!diff || diff.changedFields.length === 0) return "No field-level change";

  const riskOrder: Record<FieldChange["risk_tier"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const sorted = [...diff.changedFields].sort(
    (a, b) => riskOrder[a.risk_tier] - riskOrder[b.risk_tier]
  );
  const top = sorted.slice(0, 3).map((change) => {
    if (change.kind === "scalar") {
      return `${change.field}: ${formatScalar(change.before)} → ${formatScalar(change.after)}`;
    }
    const added = change.added.length > 0 ? `+${change.added.join(",")}` : "";
    const removed = change.removed.length > 0 ? `-${change.removed.join(",")}` : "";
    return `${change.field}: ${[added, removed].filter(Boolean).join(" ")}`;
  });
  const tail = sorted.length > 3 ? ` (+${sorted.length - 3} more)` : "";
  return top.join("; ") + tail;
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return "∅";
    return trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed;
  }
  return String(value);
}

interface AuditRowPayload {
  event_id: string | null;
  event_id_at_observation: string;
  event_title_at_observation: string | null;
  event_slug_at_observation: string | null;
  event_start_date_at_observation: string | null;
  event_venue_name_at_observation: string | null;
  actor_id: string | null;
  actor_role: EventAuditActorRole;
  action: EventAuditAction;
  source: EventAuditSource;
  changed_fields: unknown;
  prior_hash: string | null;
  summary: string | null;
  request_id: string | null;
  ip_hash: string | null;
  user_agent_class: string;
}

/**
 * Build the row payload. Pure — no I/O, easy to unit-test.
 */
export function buildEventAuditRowPayload(input: LogEventAuditInput): AuditRowPayload {
  const diff =
    input.prevEvent && input.nextEvent
      ? computePatchDiff(
          input.prevEvent as Parameters<typeof computePatchDiff>[0],
          input.nextEvent as Parameters<typeof computePatchDiff>[1]
        )
      : null;

  const summary = input.summary ?? buildSummary(diff, input.action);

  const ipHash = input.request?.remoteIp ? hashIp(input.request.remoteIp) : null;

  return {
    event_id: input.eventId,
    event_id_at_observation: input.eventSnapshot.eventId,
    event_title_at_observation: input.eventSnapshot.title ?? null,
    event_slug_at_observation: input.eventSnapshot.slug ?? null,
    event_start_date_at_observation: input.eventSnapshot.startDate ?? null,
    event_venue_name_at_observation: input.eventSnapshot.venueName ?? null,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    source: input.source,
    changed_fields: diff ? diff.changedFields : [],
    prior_hash: input.priorHash ?? null,
    summary,
    request_id: input.request?.requestId ?? null,
    ip_hash: ipHash,
    user_agent_class: classifyUserAgent(input.request?.userAgent),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write one audit row. Fire-and-forget — never throws to the caller.
 * Caller pattern (see `web/src/lib/audit/moderationAudit.ts`):
 *
 *   void logEventAudit({ ... }).catch(() => {});
 *
 * The .catch is defensive; this function already swallows internally.
 */
export async function logEventAudit(input: LogEventAuditInput): Promise<void> {
  if (!isEventAuditLogEnabled()) return;

  // Server-side only. Mirrors moderationAudit.ts guard.
  if (typeof window !== "undefined") {
    console.warn("[event-audit] should only be called server-side");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[event-audit] missing Supabase env vars; audit row dropped", {
      eventId: input.eventId,
      action: input.action,
    });
    return;
  }

  let payload: AuditRowPayload;
  try {
    payload = buildEventAuditRowPayload(input);
  } catch (buildErr) {
    console.error("[event-audit-failed] payload build error", {
      err: buildErr instanceof Error ? buildErr.message : String(buildErr),
      eventId: input.eventId,
      action: input.action,
    });
    return;
  }

  // Mirror to Axiom via Vercel runtime drain. Always emit, even when
  // the DB insert later fails — Axiom is the secondary forensic
  // surface and should not lose events to DB outages.
  console.info("[event-audit]", payload);

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.from("event_audit_log").insert(payload);
    if (error) {
      console.error("[event-audit-failed] insert error", {
        message: error.message,
        code: error.code,
        eventId: input.eventId,
        action: input.action,
      });
    }
  } catch (insertErr) {
    console.error("[event-audit-failed] insert exception", {
      err: insertErr instanceof Error ? insertErr.message : String(insertErr),
      eventId: input.eventId,
      action: input.action,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience helpers used by route hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map an event row (POST/PATCH return value) to the snapshot fields the
 * audit row needs. Tolerates partial rows.
 */
export function snapshotFromEventRow(
  eventId: string,
  row: Record<string, unknown> | null | undefined
): EventAuditEventSnapshot {
  if (!row) return { eventId };
  const title = typeof row.title === "string" ? row.title : null;
  const slug = typeof row.slug === "string" ? row.slug : null;
  const startDate =
    typeof row.event_date === "string"
      ? row.event_date
      : typeof row.start_date === "string"
        ? row.start_date
        : null;
  const venueName =
    typeof row.venue_name === "string"
      ? row.venue_name
      : typeof row.custom_location_name === "string"
        ? row.custom_location_name
        : null;
  return { eventId, title, slug, startDate, venueName };
}

/**
 * Resolve an audit source from the request body / metadata. The AI write
 * convention from PR #182 / #139 sets `ai_write_source =
 * "conversational_create_ui_auto_apply"` — anything matching that family
 * gets `ai_edit`. Other recognized origins map to their canonical
 * source. Fallback is `manual_form` (the human form path).
 */
export function resolveEventAuditSource(input: {
  aiWriteSource?: string | null;
  body?: Record<string, unknown> | null;
}): EventAuditSource {
  if (input.aiWriteSource) {
    if (input.aiWriteSource.startsWith("conversational_create_ui_")) return "ai_edit";
    if (input.aiWriteSource.startsWith("conversational_create_ui_chat")) return "ai_chat";
    return "ai_edit";
  }
  const explicit = input.body?.audit_source;
  if (typeof explicit === "string") {
    if (
      explicit === "ai_chat" ||
      explicit === "ai_edit" ||
      explicit === "manual_form" ||
      explicit === "api" ||
      explicit === "admin_console" ||
      explicit === "import" ||
      explicit === "service_role"
    ) {
      return explicit;
    }
  }
  return "manual_form";
}

/**
 * Map a profile role + host status to the audit `actor_role` enum.
 * Admin trumps all; otherwise host > cohost; falls back to `unknown`.
 */
export function resolveEventAuditActorRole(input: {
  isAdmin: boolean;
  isHost: boolean;
  isCohost: boolean;
}): EventAuditActorRole {
  if (input.isAdmin) return "admin";
  if (input.isHost) return "host";
  if (input.isCohost) return "cohost";
  return "unknown";
}

/**
 * Pull request-context fields from a fetch-style Request without
 * pulling in any node-only types at the call site.
 */
export function readEventAuditRequestContext(request: Request): EventAuditRequestContext {
  const headers = request.headers;
  const requestId =
    headers.get("x-vercel-id") ??
    headers.get("x-request-id") ??
    null;
  const userAgent = headers.get("user-agent");
  const remoteIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;
  return { requestId, userAgent, remoteIp };
}
