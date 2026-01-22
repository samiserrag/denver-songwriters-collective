import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_TYPE_CONFIG, type EventType } from "@/types/events";

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
        .select("title, event_type, event_date, start_time, venue_name, cover_image_url")
        .eq("id", id)
        .single()
    : await supabase
        .from("events")
        .select("title, event_type, event_date, start_time, venue_name, cover_image_url")
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

  // DSC brand colors
  const goldAccent = "#d4a853";
  const darkBg = "#0f172a";
  const textPrimary = "#f8fafc";
  const textSecondary = "#94a3b8";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: darkBg,
          padding: "60px",
        }}
      >
        {/* Top bar with DSC branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "40px",
          }}
        >
          {/* DSC Logo badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                backgroundColor: goldAccent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: "bold",
                color: darkBg,
              }}
            >
              DSC
            </div>
            <span
              style={{
                fontSize: "18px",
                color: textSecondary,
              }}
            >
              Denver Songwriters Collective
            </span>
          </div>

          {/* Event type badge */}
          <div
            style={{
              backgroundColor: `${goldAccent}20`,
              border: `2px solid ${goldAccent}`,
              borderRadius: "20px",
              padding: "8px 20px",
              fontSize: "18px",
              color: goldAccent,
              fontWeight: "600",
            }}
          >
            {typeLabel}
          </div>
        </div>

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: "40px",
          }}
        >
          {/* Cover image */}
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img element
            <img
              src={coverImage}
              width={280}
              height={280}
              alt=""
              style={{
                borderRadius: "16px",
                objectFit: "cover",
                border: `2px solid ${goldAccent}40`,
              }}
            />
          ) : (
            <div
              style={{
                width: "280px",
                height: "280px",
                borderRadius: "16px",
                backgroundColor: `${goldAccent}20`,
                border: `2px solid ${goldAccent}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "80px",
              }}
            >
              🎵
            </div>
          )}

          {/* Text content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
            }}
          >
            {/* Title */}
            <h1
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: textPrimary,
                margin: "0 0 20px 0",
                lineHeight: 1.1,
                maxWidth: "700px",
              }}
            >
              {title.length > 60 ? title.slice(0, 60) + "..." : title}
            </h1>

            {/* Date and time */}
            {(dateStr || timeStr) && (
              <p
                style={{
                  fontSize: "28px",
                  color: goldAccent,
                  margin: "0 0 12px 0",
                  fontWeight: "600",
                }}
              >
                {[dateStr, timeStr].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* Venue */}
            {venue && (
              <p
                style={{
                  fontSize: "24px",
                  color: textSecondary,
                  margin: "0",
                }}
              >
                📍 {venue}
              </p>
            )}
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            width: "100%",
            height: "4px",
            backgroundColor: goldAccent,
            marginTop: "40px",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
