import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_TYPE_CONFIG, type EventType } from "@/types/events";
import { renderOgCard, type OgChip } from "../../_shared/ogCard";

export const runtime = "edge";

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Day abbreviation map for series labels
const DAY_ABBREVS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const selectFields = `
    title, event_type, event_date, start_time,
    venue_name, cover_image_url, status, last_verified_at,
    is_published, visibility,
    recurrence_rule, day_of_week,
    venue:venues!events_venue_id_fkey(name, city, state)
  `;

  // Query event by slug or UUID — only published PUBLIC events expose OG metadata
  // PR4: Added visibility='public' filter (defense-in-depth; RLS also blocks invite-only for anon)
  const { data: event } = isUUID(id)
    ? await supabase
        .from("events")
        .select(selectFields)
        .eq("id", id)
        .eq("is_published", true)
        .eq("visibility", "public")
        .single()
    : await supabase
        .from("events")
        .select(selectFields)
        .eq("slug", id)
        .eq("is_published", true)
        .eq("visibility", "public")
        .single();

  // Return generic fallback OG for unpublished/missing events (no metadata leak)
  if (!event) {
    return new ImageResponse(
      renderOgCard({
        title: "Happening",
        chips: [{ label: "Event", variant: "gold" }],
        fallbackEmoji: "🎵",
        kindLabel: "Event",
        kindVariant: "gold",
      }),
      { width: 1200, height: 630 }
    );
  }

  const title = event?.title ?? "Happening";
  const eventType = event?.event_type as EventType | undefined;
  const typeConfig = eventType ? EVENT_TYPE_CONFIG[eventType] : null;
  const typeLabel = typeConfig?.label ?? "Event";
  const coverImage = event?.cover_image_url;

  // Extract venue info (prefer joined venue data, fall back to venue_name)
  const venueData = event?.venue as { name?: string; city?: string; state?: string } | null;
  const venueName = venueData?.name ?? event?.venue_name ?? "";
  const venueCity = venueData?.city ?? "";
  const venueState = venueData?.state ?? "";

  // Build subtitle: venue name + city
  const locationParts = [venueName, [venueCity, venueState].filter(Boolean).join(", ")].filter(Boolean);
  const subtitle = locationParts.length > 0
    ? `📍 ${locationParts.join(" · ")}`
    : undefined;

  // Format date overlay
  const recurrenceRule = event?.recurrence_rule;
  const dayOfWeek = event?.day_of_week;
  let dateOverlay: string | undefined;

  if (recurrenceRule || dayOfWeek) {
    // Series event: show "Every Thu" or "1st & 3rd Sat" pattern
    const dayAbbr = dayOfWeek
      ? DAY_ABBREVS[dayOfWeek.toLowerCase().trim()] ?? dayOfWeek
      : "";

    if (recurrenceRule && recurrenceRule.includes("/")) {
      // Monthly ordinal: "1st/3rd" → "1st & 3rd Thu"
      const ordinals = recurrenceRule.split("/").map((o: string) => o.trim());
      dateOverlay = `${ordinals.join(" & ")} ${dayAbbr}`;
    } else if (recurrenceRule === "weekly" || (!recurrenceRule && dayOfWeek)) {
      dateOverlay = dayAbbr ? `Every ${dayAbbr}` : undefined;
    } else if (recurrenceRule === "biweekly") {
      dateOverlay = dayAbbr ? `Every Other ${dayAbbr}` : undefined;
    } else {
      dateOverlay = dayAbbr ? `Every ${dayAbbr}` : undefined;
    }

    // Append time if available
    if (dateOverlay && event?.start_time) {
      const timeStr = formatTime(event.start_time);
      if (timeStr) dateOverlay += ` · ${timeStr}`;
    }
  } else if (event?.event_date) {
    // One-time event: "Sat Feb 14 · 9 PM"
    let dateStr = "";
    try {
      const date = new Date(event.event_date + "T12:00:00Z");
      dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Denver",
      });
    } catch {
      // Ignore date parsing errors
    }
    const timeStr = event?.start_time ? formatTime(event.start_time) : "";
    dateOverlay = [dateStr, timeStr].filter(Boolean).join(" · ") || undefined;
  }

  // Build chips
  const chips: OgChip[] = [];

  // Type chip
  chips.push({
    label: typeLabel,
    variant: "gold",
  });

  // Verification status
  const isConfirmed = event?.last_verified_at !== null;
  const isCancelled = event?.status === "cancelled";

  if (isCancelled) {
    chips.push({
      label: "Cancelled",
      variant: "purple",
    });
  } else if (isConfirmed) {
    chips.push({
      label: "Confirmed",
      variant: "emerald",
    });
  }

  // Build city label for bottom-right of image zone
  const cityLabel = [venueCity, venueState].filter(Boolean).join(", ") || undefined;

  return new ImageResponse(
    renderOgCard({
      title,
      subtitle,
      chips,
      imageUrl: coverImage,
      fallbackEmoji: "🎵",
      kindLabel: typeLabel,
      kindVariant: "gold",
      dateOverlay,
      cityLabel,
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}

function formatTime(startTime: string): string {
  try {
    const [hours, minutes] = startTime.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return minutes === "00"
      ? `${displayHour} ${ampm}`
      : `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return "";
  }
}
