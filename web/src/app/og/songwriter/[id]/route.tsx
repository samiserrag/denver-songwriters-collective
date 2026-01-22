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

  // Query profile by slug or UUID
  const { data: profile } = isUUID(id)
    ? await supabase
        .from("profiles")
        .select("full_name, bio, avatar_url, city, state, genres")
        .eq("id", id)
        .single()
    : await supabase
        .from("profiles")
        .select("full_name, bio, avatar_url, city, state, genres")
        .eq("slug", id)
        .single();

  const name = profile?.full_name ?? "Songwriter";
  const location = profile ? [profile.city, profile.state].filter(Boolean).join(", ") : "";
  const genres = profile?.genres?.slice(0, 3).join(" · ") ?? "";
  const avatarUrl = profile?.avatar_url;

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
        </div>

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: "40px",
          }}
        >
          {/* Avatar */}
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img element
            <img
              src={avatarUrl}
              width={200}
              height={200}
              alt=""
              style={{
                borderRadius: "100px",
                objectFit: "cover",
                border: `4px solid ${goldAccent}`,
              }}
            />
          ) : (
            <div
              style={{
                width: "200px",
                height: "200px",
                borderRadius: "100px",
                backgroundColor: goldAccent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "80px",
                fontWeight: "bold",
                color: darkBg,
              }}
            >
              {name.charAt(0).toUpperCase()}
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
            {/* Name with gold accent */}
            <h1
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                color: textPrimary,
                margin: "0 0 16px 0",
                lineHeight: 1.1,
              }}
            >
              {name}
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

            {/* Genres */}
            {genres && (
              <p
                style={{
                  fontSize: "24px",
                  color: goldAccent,
                  margin: "0",
                }}
              >
                {genres}
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
