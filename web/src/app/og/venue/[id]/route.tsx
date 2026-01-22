import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // Query venue by slug or UUID
  const { data: venue } = isUUID(id)
    ? await supabase
        .from("venues")
        .select("name, city, state, neighborhood, cover_image_url, address")
        .eq("id", id)
        .single()
    : await supabase
        .from("venues")
        .select("name, city, state, neighborhood, cover_image_url, address")
        .eq("slug", id)
        .single();

  const name = venue?.name ?? "Venue";
  const location = venue ? [venue.city, venue.state].filter(Boolean).join(", ") : "";
  const neighborhood = venue?.neighborhood ?? "";
  const coverImage = venue?.cover_image_url;

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

          {/* Venue badge */}
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
            Venue
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
              📍
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
            {/* Venue name */}
            <h1
              style={{
                fontSize: "52px",
                fontWeight: "bold",
                color: textPrimary,
                margin: "0 0 20px 0",
                lineHeight: 1.1,
                maxWidth: "700px",
              }}
            >
              {name.length > 50 ? name.slice(0, 50) + "..." : name}
            </h1>

            {/* Location */}
            {location && (
              <p
                style={{
                  fontSize: "28px",
                  color: textSecondary,
                  margin: "0 0 12px 0",
                }}
              >
                {location}
              </p>
            )}

            {/* Neighborhood */}
            {neighborhood && (
              <p
                style={{
                  fontSize: "24px",
                  color: goldAccent,
                  margin: "0",
                }}
              >
                {neighborhood}
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
