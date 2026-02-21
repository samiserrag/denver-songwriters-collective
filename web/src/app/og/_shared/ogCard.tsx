/**
 * Shared OG Card Component — Image-Dominant Vertical Poster + Content Bar (v2)
 *
 * Layout (1200x630):
 *   Image Zone (top 400px): entity image fills top ~63%
 *   Content Bar (bottom 230px): brighter card-spotlight gradient with title/subtitle/chips
 *
 * Design:
 *   - Kind badge overlaid top-left on image zone (48px bold)
 *   - Date/time overlay bottom-left on image zone (44px bold)
 *   - City label bottom-right on image zone (22px)
 *   - "The Colorado Songwriters Collective" wordmark top-right (24px gold, dark scrim)
 *   - Bottom gradient on image blends into content bar
 *   - All chips use single gold pill style
 *   - Title is large and dominant (52px default)
 *   - Fallback: branded gradient + emoji (never blank)
 *   - No outer rounded corners (social platforms crop)
 *
 * Colors derived from site Night theme tokens:
 *   bg-primary: #0B0F1A
 *   bg-secondary: #11162B
 *   accent-gold: #FFD86A
 *   text-primary: #FAF9F7
 *   text-secondary: rgba(250, 249, 247, 0.70)
 *   card-spotlight: radial-gradient with gold accent muted
 */

import * as React from "react";

// Colors matching Night theme tokens (brighter than pure #060F2C)
const COLORS = {
  background: "#0B0F1A", // bg-primary (Night theme)
  backgroundSecondary: "#11162B", // bg-secondary
  backgroundTertiary: "#191F3A", // bg-tertiary
  goldAccent: "#FFD86A", // --color-gold
  goldMuted: "rgba(255, 216, 106, 0.15)", // --color-accent-muted
  textPrimary: "#FAF9F7", // --color-warm-white
  textSecondary: "rgba(250, 249, 247, 0.70)", // --color-text-secondary
  textTertiary: "rgba(250, 249, 247, 0.55)", // --color-text-tertiary
  contentBarBorder: "rgba(248, 250, 252, 0.14)", // --color-border-default (Night)
  pillBg: "rgba(255, 216, 106, 0.20)",
  pillBorder: "rgba(255, 216, 106, 0.35)",
  pillText: "#FFD86A",
  kindBadgeBg: "rgba(0, 0, 0, 0.55)",
} as const;

export type OgChip = {
  label: string;
  variant?: "gold" | "emerald" | "blue" | "purple" | "default";
};

export interface OgCardProps {
  /** Main title (entity name, event title, etc.) */
  title: string;
  /** Secondary line (location, date/time, etc.) */
  subtitle?: string;
  /** Chips to display (genres, type, status, etc.) - max 4 recommended */
  chips?: OgChip[];
  /** Entity image URL (avatar, cover, etc.) */
  imageUrl?: string | null;
  /** Fallback emoji when no image */
  fallbackEmoji?: string;
  /** Kind label shown in top-left badge on image */
  kindLabel: string;
  /** Kind badge variant (kept for compat, all render same) */
  kindVariant?: "gold" | "emerald" | "blue" | "purple";
  /** Optional author info for blog posts */
  author?: {
    name: string;
    avatarUrl?: string | null;
  };
  /** Image fit mode: "cover" (default), "contain" (letterbox for venues), or "avatar" (centered circle for profiles) */
  imageFit?: "cover" | "contain" | "avatar";
  /** Date overlay badge on image zone (events only) */
  dateOverlay?: string;
  /** City label shown bottom-right on image zone */
  cityLabel?: string;
}

/**
 * Normalize a Supabase storage URL to use the image transformation endpoint.
 * This strips EXIF orientation data so images render right-side-up in Satori/OG.
 * e.g. .../object/public/avatars/... → .../render/image/public/avatars/...
 */
function normalizeImageUrl(url: string): string {
  if (!url) return url;
  // Supabase storage public URLs contain /object/public/
  // The render endpoint at /render/image/public/ applies transforms and strips EXIF
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
  }
  return url;
}

/**
 * Renders the OG card JSX for use with ImageResponse.
 */
export function renderOgCard({
  title,
  subtitle,
  chips = [],
  imageUrl,
  fallbackEmoji = "🎵",
  kindLabel,
  author,
  imageFit = "cover",
  dateOverlay,
  cityLabel,
}: OgCardProps): React.ReactElement {
  // Normalize avatar images to strip EXIF orientation
  const resolvedImageUrl = imageUrl && imageFit === "avatar"
    ? normalizeImageUrl(imageUrl)
    : imageUrl;

  // Avatar mode uses a taller image zone and minimal content bar
  const imageZoneHeight = imageFit === "avatar" ? 530 : 400;
  const contentBarHeight = imageFit === "avatar" ? 100 : 230;

  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.background,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ===== IMAGE ZONE ===== */}
      <div
        style={{
          width: "1200px",
          height: `${imageZoneHeight}px`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Entity image or branded fallback */}
        {resolvedImageUrl && imageFit === "avatar" ? (
          /* Centered circular avatar for profile OG cards — large & dominant */
          <div
            style={{
              width: "1200px",
              height: `${imageZoneHeight}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${COLORS.backgroundSecondary} 0%, ${COLORS.backgroundTertiary} 50%, ${COLORS.backgroundSecondary} 100%)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img */}
            <img
              src={resolvedImageUrl}
              width={460}
              height={460}
              alt=""
              style={{
                width: "460px",
                height: "460px",
                borderRadius: "230px",
                objectFit: "cover",
                objectPosition: "center",
                border: `4px solid ${COLORS.goldAccent}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img
          <img
            src={imageUrl}
            width={1200}
            height={400}
            alt=""
            style={{
              width: "1200px",
              height: "400px",
              objectFit: imageFit === "contain" ? "contain" : "cover",
              objectPosition: imageFit === "contain" ? "center" : "top",
              backgroundColor: COLORS.backgroundSecondary,
            }}
          />
        ) : (
          /* Branded fallback: gradient + large emoji */
          <div
            style={{
              width: "1200px",
              height: "400px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${COLORS.backgroundSecondary} 0%, ${COLORS.backgroundTertiary} 50%, ${COLORS.backgroundSecondary} 100%)`,
            }}
          >
            <div
              style={{
                fontSize: "140px",
                opacity: 0.9,
              }}
            >
              {fallbackEmoji}
            </div>
          </div>
        )}

        {/* Bottom gradient fade into content bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "140px",
            background: `linear-gradient(to bottom, transparent, ${COLORS.background})`,
          }}
        />

        {/* Kind badge — top-left (hidden for avatar mode, shown in content bar instead) */}
        {imageFit !== "avatar" && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "24px",
              backgroundColor: COLORS.kindBadgeBg,
              borderRadius: "18px",
              padding: "16px 32px",
              fontSize: "48px",
              fontWeight: "700",
              color: COLORS.textPrimary,
              letterSpacing: "0.5px",
            }}
          >
            {kindLabel}
          </div>
        )}

        {/* CSC Wordmark — top-right with dark scrim for readability */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            borderRadius: "12px",
            padding: "12px 20px",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: COLORS.goldAccent,
              lineHeight: 1.25,
              letterSpacing: "0.5px",
            }}
          >
            The Colorado Songwriters
          </span>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: COLORS.goldAccent,
              lineHeight: 1.25,
              letterSpacing: "0.5px",
            }}
          >
            Collective
          </span>
        </div>

        {/* Date overlay badge (events) — bottom-left above gradient */}
        {dateOverlay && (
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "24px",
              backgroundColor: COLORS.kindBadgeBg,
              borderRadius: "14px",
              padding: "14px 28px",
              fontSize: "44px",
              fontWeight: "700",
              color: COLORS.textPrimary,
            }}
          >
            {dateOverlay}
          </div>
        )}

        {/* City label — bottom-right */}
        {cityLabel && (
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              right: "24px",
              backgroundColor: COLORS.kindBadgeBg,
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "22px",
              fontWeight: "600",
              color: COLORS.textPrimary,
            }}
          >
            {cityLabel}
          </div>
        )}
      </div>

      {/* ===== CONTENT BAR ===== */}
      <div
        style={{
          width: "1200px",
          height: `${contentBarHeight}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: imageFit === "avatar" ? "center" : "flex-start",
          padding: imageFit === "avatar" ? "0 24px" : "0 48px",
          position: "relative",
          borderTop: `1px solid ${COLORS.contentBarBorder}`,
          background: imageFit === "avatar"
            ? COLORS.backgroundSecondary
            : `radial-gradient(ellipse at top, rgba(255, 216, 106, 0.14), ${COLORS.backgroundSecondary} 70%)`,
        }}
      >
        {imageFit === "avatar" ? (
          /* Compact centered layout: Row 1 = name, Row 2 = kind + location + chips */
          <>
            {/* Row 1: Name */}
            <div
              style={{
                fontSize: title.length > 30 ? "32px" : "38px",
                fontWeight: "bold",
                color: COLORS.textPrimary,
                lineHeight: 1.1,
              }}
            >
              {title.length > 40 ? title.slice(0, 40) + "…" : title}
            </div>

            {/* Row 2: Kind label + location + chips */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  color: COLORS.textSecondary,
                  whiteSpace: "nowrap",
                }}
              >
                {kindLabel}
              </div>
              {subtitle && (
                <>
                  <div
                    style={{
                      width: "1px",
                      height: "14px",
                      backgroundColor: COLORS.contentBarBorder,
                    }}
                  />
                  <div
                    style={{
                      fontSize: "18px",
                      color: COLORS.textSecondary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {subtitle}
                  </div>
                </>
              )}
              {chips.length > 0 && (
                <div
                  style={{
                    width: "1px",
                    height: "14px",
                    backgroundColor: COLORS.contentBarBorder,
                  }}
                />
              )}
              {chips.slice(0, 4).map((chip, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: COLORS.pillBg,
                    border: `1.5px solid ${COLORS.pillBorder}`,
                    borderRadius: "12px",
                    padding: "3px 12px",
                    fontSize: "14px",
                    color: COLORS.pillText,
                    fontWeight: "600",
                  }}
                >
                  {chip.label}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Standard layout for non-avatar cards */
          <>
        {/* Title — large and dominant */}
        <div
          style={{
            fontSize: title.length > 35 ? "40px" : title.length > 25 ? "46px" : "52px",
            fontWeight: "bold",
            color: COLORS.textPrimary,
            lineHeight: 1.15,
            maxWidth: "1050px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title.length > 55 ? title.slice(0, 55) + "…" : title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: "24px",
              color: COLORS.textSecondary,
              marginTop: "8px",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "900px",
            }}
          >
            {subtitle.length > 70 ? subtitle.slice(0, 70) + "…" : subtitle}
          </div>
        )}

        {/* Bottom row: chips + author */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "14px",
          }}
        >
          {/* Chips */}
          {chips.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: "10px",
              }}
            >
              {chips.slice(0, 4).map((chip, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: COLORS.pillBg,
                    border: `1.5px solid ${COLORS.pillBorder}`,
                    borderRadius: "16px",
                    padding: "6px 16px",
                    fontSize: "18px",
                    color: COLORS.pillText,
                    fontWeight: "600",
                  }}
                >
                  {chip.label}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}

          {/* Author avatar + name (blog posts) */}
          {author && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img
                <img
                  src={author.avatarUrl}
                  width={40}
                  height={40}
                  alt=""
                  style={{
                    borderRadius: "20px",
                    objectFit: "cover",
                    border: `2px solid ${COLORS.goldAccent}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "20px",
                    backgroundColor: COLORS.goldAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: COLORS.background,
                  }}
                >
                  {author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  fontSize: "20px",
                  color: COLORS.goldAccent,
                  fontWeight: "600",
                }}
              >
                {author.name}
              </span>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
