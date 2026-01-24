/**
 * Shared OG Card Component — Image-Dominant Vertical Poster + Content Bar
 *
 * Layout (1200x630):
 *   Image Zone (top 420px): entity image fills top ~67%
 *   Content Bar (bottom 210px): card-spotlight gradient with title/subtitle/chips
 *
 * Design:
 *   - Kind badge overlaid top-left on image zone
 *   - "DSC" text top-right in gold
 *   - Bottom gradient on image blends into content bar
 *   - All chips use single gold pill style (no color differentiation)
 *   - No outer rounded corners (social platforms crop to rectangle)
 */

import * as React from "react";

// Colors matching night theme tokens
const COLORS = {
  background: "#060F2C",
  goldAccent: "#FFD86A",
  textPrimary: "#FAF9F7",
  textSecondary: "rgba(250, 249, 247, 0.70)",
  contentBarBorder: "rgba(255, 255, 255, 0.10)",
  pillBg: "rgba(255, 216, 106, 0.20)",
  pillBorder: "rgba(255, 216, 106, 0.35)",
  pillText: "#FFD86A",
  kindBadgeBg: "rgba(0, 0, 0, 0.60)",
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
  /** Kind badge variant (ignored — all render same style) */
  kindVariant?: "gold" | "emerald" | "blue" | "purple";
  /** Optional author info for blog posts */
  author?: {
    name: string;
    avatarUrl?: string | null;
  };
  /** Image fit mode: "cover" (default) or "contain" (letterbox for venues) */
  imageFit?: "cover" | "contain";
  /** Date overlay badge on image zone (events only) */
  dateOverlay?: string;
}

/**
 * Renders the OG card JSX for use with ImageResponse.
 * This is a pure function that returns React elements.
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
}: OgCardProps): React.ReactElement {
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
      {/* ===== IMAGE ZONE (top 420px) ===== */}
      <div
        style={{
          width: "1200px",
          height: "420px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.background,
          overflow: "hidden",
        }}
      >
        {/* Entity image or fallback */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img
          <img
            src={imageUrl}
            width={1200}
            height={420}
            alt=""
            style={{
              width: "1200px",
              height: "420px",
              objectFit: imageFit,
              objectPosition: "top",
            }}
          />
        ) : (
          <div
            style={{
              width: "1200px",
              height: "420px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "120px",
              backgroundColor: COLORS.background,
            }}
          >
            {fallbackEmoji}
          </div>
        )}

        {/* Bottom gradient fade into content bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "120px",
            background: `linear-gradient(to bottom, transparent, ${COLORS.background})`,
          }}
        />

        {/* Kind badge — top-left */}
        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            backgroundColor: COLORS.kindBadgeBg,
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "20px",
            fontWeight: "600",
            color: COLORS.textPrimary,
          }}
        >
          {kindLabel}
        </div>

        {/* DSC mark — top-right */}
        <div
          style={{
            position: "absolute",
            top: "24px",
            right: "24px",
            fontSize: "24px",
            fontWeight: "700",
            color: COLORS.goldAccent,
            letterSpacing: "1px",
          }}
        >
          DSC
        </div>

        {/* Date overlay badge (events) — bottom-left above gradient */}
        {dateOverlay && (
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              left: "24px",
              backgroundColor: COLORS.kindBadgeBg,
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "20px",
              fontWeight: "600",
              color: COLORS.textPrimary,
            }}
          >
            {dateOverlay}
          </div>
        )}
      </div>

      {/* ===== CONTENT BAR (bottom 210px) ===== */}
      <div
        style={{
          width: "1200px",
          height: "210px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 48px",
          position: "relative",
          borderTop: `1px solid ${COLORS.contentBarBorder}`,
          background: `radial-gradient(circle at top, rgba(255, 216, 106, 0.12), #0B0F1A)`,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: title.length > 40 ? "36px" : "42px",
            fontWeight: "bold",
            color: COLORS.textPrimary,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "1000px",
          }}
        >
          {title.length > 50 ? title.slice(0, 50) + "..." : title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: "22px",
              color: COLORS.textSecondary,
              marginTop: "8px",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "900px",
            }}
          >
            {subtitle.length > 70 ? subtitle.slice(0, 70) + "..." : subtitle}
          </div>
        )}

        {/* Bottom row: chips + author */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "12px",
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
                    padding: "6px 14px",
                    fontSize: "16px",
                    color: COLORS.pillText,
                    fontWeight: "500",
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
                gap: "10px",
              }}
            >
              {author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img
                <img
                  src={author.avatarUrl}
                  width={36}
                  height={36}
                  alt=""
                  style={{
                    borderRadius: "18px",
                    objectFit: "cover",
                    border: `2px solid ${COLORS.goldAccent}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "18px",
                    backgroundColor: COLORS.goldAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: COLORS.background,
                  }}
                >
                  {author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  fontSize: "18px",
                  color: COLORS.goldAccent,
                  fontWeight: "500",
                }}
              >
                {author.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
