import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_TYPE_CONFIG, type EventType } from "@/types/events";
import { renderOgCard, type OgChip } from "../../_shared/ogCard";

export const runtime = "edge";

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Query event by slug or UUID
  const { data: event } = isUUID(id)
    ? await supabase
        .from("events")
        .select("title, event_type, event_date, start_time, venue_name, cover_image_url, status, last_verified_at")
        .eq("id", id)
        .single()
    : await supabase
        .from("events")
        .select("title, event_type, event_date, start_time, venue_name, cover_image_url, status, last_verified_at")
        .eq("slug", id)
        .single();

  const title = event?.title ?? "Happening";
  const eventType = event?.event_type as EventType | undefined;
  const typeConfig = eventType ? EVENT_TYPE_CONFIG[eventType] : null;
  const typeLabel = typeConfig?.label ?? "Event";
  const venue = event?.venue_name ?? "";
  const coverImage = event?.cover_image_url;

  // Format date if available
  let dateStr = "";
  if (event?.event_date) {
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
  }

  // Format time if available
  let timeStr = "";
  if (event?.start_time) {
    try {
      const [hours, minutes] = event.start_time.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      timeStr = `${displayHour}:${minutes} ${ampm}`;
    } catch {
      // Ignore time parsing errors
    }
  }

  // Build subtitle from date, time, venue
  const dateLine = [dateStr, timeStr].filter(Boolean).join(" · ");
  const subtitle = [dateLine, venue ? `📍 ${venue}` : ""].filter(Boolean).join(" — ");

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

  return new ImageResponse(
    renderOgCard({
      title,
      subtitle: subtitle || undefined,
      chips,
      imageUrl: coverImage,
      fallbackEmoji: "🎵",
      kindLabel: typeLabel,
      kindVariant: "gold",
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}
