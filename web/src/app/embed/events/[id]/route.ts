import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMissingDetails } from "@/lib/events/missingDetails";
import { getPublicVerificationState } from "@/lib/events/verification";
import { computeNextOccurrence, getTodayDenver } from "@/lib/events/nextOccurrence";
import { interpretRecurrence, labelFromRecurrence } from "@/lib/events/recurrenceContract";
import { EVENT_TYPE_CONFIG, getPrimaryEventType, type EventType } from "@/types/events";
import { isExternalEmbedsEnabled } from "@/lib/featureFlags";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type EmbedTheme = "light" | "dark" | "auto";
type EmbedView = "card" | "compact";

type VenueJoin = {
  name?: string | null;
  city?: string | null;
  state?: string | null;
};

type EmbedEvent = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  event_type: string | null;
  is_published: boolean | null;
  is_dsc_event: boolean | null;
  status: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
  source: string | null;
  host_id: string | null;
  event_date: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence_rule: string | null;
  custom_dates: unknown;
  venue_id: string | null;
  venue_name: string | null;
  venue_address: string | null;
  location_mode: "venue" | "online" | "hybrid" | null;
  online_url: string | null;
  custom_location_name: string | null;
  custom_city: string | null;
  custom_state: string | null;
  is_free: boolean | null;
  cost_label: string | null;
  age_policy: string | null;
  cover_image_url: string | null;
  venue: VenueJoin | VenueJoin[] | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCustomDates(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const dates = value.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item));
  return dates.length > 0 ? dates : null;
}

function parseTheme(value: string | null): EmbedTheme {
  if (value === "light" || value === "dark" || value === "auto") return value;
  return "auto";
}

function parseView(value: string | null): EmbedView {
  return value === "compact" ? "compact" : "card";
}

function parseShow(value: string | null): Set<string> {
  if (!value) return new Set(["badges", "meta", "cta"]);
  const allowed = new Set(["badges", "meta", "cta"]);
  const parsed = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => allowed.has(token));
  return new Set(parsed.length > 0 ? parsed : ["badges", "meta", "cta"]);
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

function getVenue(venue: VenueJoin | VenueJoin[] | null): VenueJoin | null {
  if (!venue) return null;
  if (Array.isArray(venue)) return venue[0] ?? null;
  return venue;
}

function renderHtml(args: {
  title: string;
  body: string;
  status?: number;
  cacheControl?: string;
}): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(args.title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #08122b;
      --card: #0d1b3d;
      --text: #e8ecf8;
      --muted: #b7c0d8;
      --accent: #f1cf67;
      --border: rgba(241, 207, 103, 0.32);
      --chip: rgba(255, 255, 255, 0.08);
      --danger: #ff9a9a;
      --ok: #d6f5d1;
      --ok-bg: rgba(63, 126, 58, 0.22);
      --warn: #fff3bf;
      --warn-bg: rgba(112, 99, 15, 0.27);
    }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif;
    }
    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      background: linear-gradient(180deg, #071128 0%, #0a1a45 100%);
      box-sizing: border-box;
    }
    .wrap[data-theme="light"] {
      --bg: #f4f7ff;
      --card: #ffffff;
      --text: #122048;
      --muted: #3b4b78;
      --accent: #f1cf67;
      --border: rgba(19, 35, 77, 0.2);
      --chip: rgba(15, 31, 78, 0.06);
      --danger: #a31515;
      --ok: #1f6f1a;
      --ok-bg: rgba(47, 127, 44, 0.12);
      --warn: #6b5505;
      --warn-bg: rgba(164, 120, 10, 0.16);
      background: linear-gradient(180deg, #f4f7ff 0%, #ecf2ff 100%);
    }
    .card {
      width: min(100%, 420px);
      background: linear-gradient(160deg, rgba(16, 31, 72, 0.96), rgba(6, 15, 40, 0.95));
      border: 1px solid var(--border);
      border-radius: 18px;
      color: var(--text);
      overflow: hidden;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
    }
    .wrap[data-theme="light"] .card {
      background: linear-gradient(160deg, #ffffff, #f1f5ff);
      box-shadow: 0 14px 35px rgba(12, 26, 62, 0.12);
    }
    .hero {
      width: 100%;
      aspect-ratio: 3 / 2;
      background: #0d1b3d;
      object-fit: cover;
      display: block;
    }
    .body {
      padding: 14px;
    }
    .title {
      font-size: 1.35rem;
      line-height: 1.2;
      margin: 0 0 8px;
      font-weight: 700;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 10px;
    }
    .chip {
      font-size: 0.85rem;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: var(--chip);
      color: var(--text);
      white-space: nowrap;
    }
    .chip-ok {
      border-color: rgba(76, 183, 73, 0.35);
      background: var(--ok-bg);
      color: var(--ok);
    }
    .chip-warn {
      border-color: rgba(255, 222, 89, 0.35);
      background: var(--warn-bg);
      color: var(--warn);
    }
    .chip-danger {
      border-color: rgba(255, 154, 154, 0.4);
      background: rgba(147, 37, 37, 0.22);
      color: var(--danger);
    }
    .meta {
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.45;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }
    .summary {
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.45;
      margin-bottom: 12px;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      text-decoration: none;
      border-radius: 12px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #111b3d;
      font-size: 1rem;
      font-weight: 700;
      min-height: 44px;
      box-sizing: border-box;
    }
    .hint {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.75rem;
      text-align: center;
    }
    .compact .body {
      padding: 12px;
    }
    .compact .title {
      font-size: 1.1rem;
      margin-bottom: 6px;
    }
    .compact .summary {
      display: none;
    }
    @media (max-width: 380px) {
      .wrap { padding: 8px; }
      .body { padding: 12px; }
      .title { font-size: 1.2rem; }
      .meta { font-size: 0.95rem; }
    }
  </style>
</head>
<body>
${args.body}
</body>
</html>`;

  return new Response(html, {
    status: args.status ?? 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": args.cacheControl ?? "no-store",
    },
  });
}

function renderStatusCard(title: string, message: string, status = 404): Response {
  return renderHtml({
    title,
    status,
    body: `<div class="wrap"><article class="card"><div class="body"><h1 class="title">${escapeHtml(title)}</h1><p class="summary">${escapeHtml(message)}</p></div></article></div>`,
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!isExternalEmbedsEnabled()) {
    return renderStatusCard("Embeds temporarily unavailable", "External embeds are currently disabled.", 503);
  }

  const { id: rawId } = await context.params;
  const identifier = decodeURIComponent(rawId);
  const url = new URL(request.url);

  const theme = parseTheme(url.searchParams.get("theme"));
  const view = parseView(url.searchParams.get("view"));
  const show = parseShow(url.searchParams.get("show"));
  const selectedDate = url.searchParams.get("date");

  const supabase = await createSupabaseServerClient();
  const { data: event, error } = isUuid(identifier)
    ? await supabase
        .from("events")
        .select(`
          id, slug, title, description, event_type, is_published, visibility,
          is_dsc_event, status, last_verified_at, verified_by, source, host_id,
          event_date, day_of_week, start_time, end_time, recurrence_rule, custom_dates,
          venue_id, venue_name, venue_address, location_mode, online_url,
          custom_location_name, custom_city, custom_state,
          is_free, cost_label, age_policy,
          cover_image_url,
          venue:venues!left(name, city, state)
        `)
        .eq("id", identifier)
        .single()
    : await supabase
        .from("events")
        .select(`
          id, slug, title, description, event_type, is_published, visibility,
          is_dsc_event, status, last_verified_at, verified_by, source, host_id,
          event_date, day_of_week, start_time, end_time, recurrence_rule, custom_dates,
          venue_id, venue_name, venue_address, location_mode, online_url,
          custom_location_name, custom_city, custom_state,
          is_free, cost_label, age_policy,
          cover_image_url,
          venue:venues!left(name, city, state)
        `)
        .eq("slug", identifier)
        .single();

  if (error || !event) {
    return renderStatusCard("Event not found", "This event is unavailable or no longer public.", 404);
  }

  const embedEvent = event as unknown as EmbedEvent;
  // PR4: Block unpublished AND invite-only events from external embeds (404-not-403)
  if (!embedEvent.is_published || (event.visibility !== "public")) {
    return renderStatusCard("Event not found", "This event is unavailable or no longer public.", 404);
  }

  const venue = getVenue(embedEvent.venue);
  const customDates = parseCustomDates(embedEvent.custom_dates);
  const canonicalToday = getTodayDenver();
  const dateForOccurrence = isDateKey(selectedDate) ? selectedDate : canonicalToday;

  const nextOccurrence = computeNextOccurrence(
    {
      event_date: embedEvent.event_date,
      day_of_week: embedEvent.day_of_week,
      recurrence_rule: embedEvent.recurrence_rule,
      start_time: embedEvent.start_time,
      custom_dates: customDates,
    },
    { todayKey: dateForOccurrence }
  );

  const occurrenceDate = isDateKey(selectedDate) ? selectedDate : nextOccurrence.date;
  const dateLabel = nextOccurrence.isConfident ? formatDate(occurrenceDate) : "Schedule unknown";
  const timeStart = formatTime(embedEvent.start_time);
  const timeEnd = formatTime(embedEvent.end_time);
  const timeLabel = timeStart && timeEnd ? `${timeStart} - ${timeEnd}` : timeStart || "Time TBD";

  const venueName =
    venue?.name ||
    embedEvent.venue_name ||
    embedEvent.custom_location_name ||
    (embedEvent.location_mode === "online" ? "Online" : "Location TBD");

  const cityState = venue?.city && venue?.state
    ? `${venue.city}, ${venue.state}`
    : embedEvent.custom_city && embedEvent.custom_state
      ? `${embedEvent.custom_city}, ${embedEvent.custom_state}`
      : embedEvent.custom_city || null;

  const verification = getPublicVerificationState({
    status: embedEvent.status,
    last_verified_at: embedEvent.last_verified_at,
    verified_by: embedEvent.verified_by,
    source: embedEvent.source,
    host_id: embedEvent.host_id,
  });

  const missing = hasMissingDetails({
    location_mode: embedEvent.location_mode,
    venue_id: embedEvent.venue_id,
    venue_name: embedEvent.venue_name,
    custom_location_name: embedEvent.custom_location_name,
    online_url: embedEvent.online_url,
    age_policy: embedEvent.age_policy,
    is_dsc_event: embedEvent.is_dsc_event,
  });

  const recurrence = interpretRecurrence({
    recurrence_rule: embedEvent.recurrence_rule,
    day_of_week: embedEvent.day_of_week,
    event_date: embedEvent.event_date,
  });
  const scheduleLabel = labelFromRecurrence(recurrence);

  const embedTypes = Array.isArray(embedEvent.event_type) ? embedEvent.event_type : [embedEvent.event_type].filter(Boolean);
  const eventType = getPrimaryEventType(embedTypes as EventType[]);
  const eventTypeLabel = EVENT_TYPE_CONFIG[eventType]?.label ?? "Event";
  const siteUrl = getSiteUrl();
  const imageUrl = embedEvent.cover_image_url || `${siteUrl}/images/hero-bg.jpg`;
  const canonicalPath = embedTypes.includes("open_mic") ? `/open-mics/${embedEvent.slug || embedEvent.id}` : `/events/${embedEvent.slug || embedEvent.id}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const detailUrl = isDateKey(selectedDate) ? `${canonicalUrl}?date=${selectedDate}` : canonicalUrl;

  const chips: string[] = [];
  chips.push(`<span class="chip">${escapeHtml(scheduleLabel)}</span>`);
  chips.push(`<span class="chip">${escapeHtml(eventTypeLabel)}</span>`);

  if (show.has("badges")) {
    if (verification.state === "confirmed") {
      chips.push('<span class="chip chip-ok">Confirmed</span>');
    } else if (verification.state === "cancelled") {
      chips.push('<span class="chip chip-danger">Cancelled</span>');
    } else {
      chips.push('<span class="chip chip-warn">Unconfirmed</span>');
    }

    if (missing) {
      chips.push('<span class="chip chip-warn">Missing details</span>');
    }
  }

  const compactClass = view === "compact" ? " compact" : "";
  const summary = embedEvent.description
    ? escapeHtml(embedEvent.description.slice(0, 220) + (embedEvent.description.length > 220 ? "..." : ""))
    : "";

  const themeAttr = `data-theme="${theme}"`;

  const body = `<div class="wrap" ${themeAttr}>
  <article class="card${compactClass}">
    <img class="hero" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(embedEvent.title)}" loading="lazy" />
    <div class="body">
      <h1 class="title">${escapeHtml(embedEvent.title)}</h1>
      <div class="chips">${chips.join("")}</div>
      ${show.has("meta") ? `<div class="meta">${escapeHtml(`${dateLabel} • ${timeLabel} • ${venueName}${cityState ? ` (${cityState})` : ""}`)}</div>` : ""}
      ${summary ? `<p class="summary">${summary}</p>` : ""}
      ${show.has("cta") ? `<a class="cta" href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer">View full event details</a>` : ""}
      <div class="hint">Powered by The Colorado Songwriters Collective</div>
    </div>
  </article>
</div>`;

  return renderHtml({ title: `${embedEvent.title} - Embed`, body });
}
