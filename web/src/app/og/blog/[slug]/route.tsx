import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  // Query blog post by slug
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image_url, author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)")
    .eq("slug", slug)
    .single();

  const title = post?.title ?? "Blog Post";
  const excerpt = post?.excerpt ?? "";
  const coverImage = post?.cover_image_url;
  const author = post?.author as { full_name?: string; avatar_url?: string } | null;
  const authorName = author?.full_name ?? "Denver Songwriters Collective";
  const authorAvatar = author?.avatar_url;

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

          {/* Blog badge */}
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
            Blog
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
              📝
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
                fontSize: "44px",
                fontWeight: "bold",
                color: textPrimary,
                margin: "0 0 20px 0",
                lineHeight: 1.2,
                maxWidth: "700px",
              }}
            >
              {title.length > 80 ? title.slice(0, 80) + "..." : title}
            </h1>

            {/* Excerpt */}
            {excerpt && (
              <p
                style={{
                  fontSize: "22px",
                  color: textSecondary,
                  margin: "0 0 20px 0",
                  lineHeight: 1.4,
                  maxWidth: "700px",
                }}
              >
                {excerpt.length > 120 ? excerpt.slice(0, 120) + "..." : excerpt}
              </p>
            )}

            {/* Author */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img element
                <img
                  src={authorAvatar}
                  width={40}
                  height={40}
                  alt=""
                  style={{
                    borderRadius: "20px",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "20px",
                    backgroundColor: goldAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: darkBg,
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  fontSize: "20px",
                  color: goldAccent,
                }}
              >
                {authorName}
              </span>
            </div>
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
