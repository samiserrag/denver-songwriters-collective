/**
 * Shared OG Card Component
 *
 * Renders a consistent, DSC-branded Open Graph image that matches
 * the site's card styling with improved readability for social sharing.
 *
 * Design targets:
 * - Strong DSC branding (larger logo + full wordmark)
 * - Opaque pill backgrounds for readability (matching site card contrast issues fix)
 * - Navy gradient background matching site vibe
 * - Entity image in rounded panel (right side)
 * - Chips row for tags/genres/type info
 */

import * as React from "react";

// DSC brand colors - consistent across all OG images
export const OG_COLORS = {
  // Primary backgrounds
  darkBg: "#0f172a", // Navy base
  darkBgGradientStart: "#0f172a",
  darkBgGradientEnd: "#1e293b", // Slightly lighter navy for subtle gradient

  // Accent
  goldAccent: "#d4a853",
  goldAccentDark: "#b8942f", // Darker gold for borders

  // Text
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",

  // Pill backgrounds - MORE OPAQUE for readability (fix from feedback)
  pillBgGold: "rgba(212, 168, 83, 0.35)", // Was 0.2, now 0.35
  pillBgEmerald: "rgba(16, 185, 129, 0.35)",
  pillBgBlue: "rgba(59, 130, 246, 0.35)",
  pillBgPurple: "rgba(147, 51, 234, 0.35)",

  // Pill text - HIGHER CONTRAST
  pillTextGold: "#fcd34d", // Brighter gold for text on dark bg
  pillTextEmerald: "#6ee7b7",
  pillTextBlue: "#93c5fd",
  pillTextPurple: "#c4b5fd",
} as const;

export interface OgChip {
  label: string;
  variant?: "gold" | "emerald" | "blue" | "purple" | "default";
}

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
  /** Kind label shown in top-right badge */
  kindLabel: string;
  /** Kind badge variant */
  kindVariant?: "gold" | "emerald" | "blue" | "purple";
  /** Optional author info for blog posts */
  author?: {
    name: string;
    avatarUrl?: string | null;
  };
}

/**
 * Get pill styles based on variant
 */
function getPillStyles(variant: OgChip["variant"] = "default") {
  switch (variant) {
    case "emerald":
      return {
        bg: OG_COLORS.pillBgEmerald,
        text: OG_COLORS.pillTextEmerald,
        border: "rgba(16, 185, 129, 0.5)",
      };
    case "blue":
      return {
        bg: OG_COLORS.pillBgBlue,
        text: OG_COLORS.pillTextBlue,
        border: "rgba(59, 130, 246, 0.5)",
      };
    case "purple":
      return {
        bg: OG_COLORS.pillBgPurple,
        text: OG_COLORS.pillTextPurple,
        border: "rgba(147, 51, 234, 0.5)",
      };
    case "gold":
    default:
      return {
        bg: OG_COLORS.pillBgGold,
        text: OG_COLORS.pillTextGold,
        border: "rgba(212, 168, 83, 0.5)",
      };
  }
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
  kindVariant = "gold",
  author,
}: OgCardProps): React.ReactElement {
  const kindStyles = getPillStyles(kindVariant);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, ${OG_COLORS.darkBgGradientStart} 0%, ${OG_COLORS.darkBgGradientEnd} 100%)`,
        padding: "48px",
        position: "relative",
      }}
    >
      {/* Subtle vignette overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Top bar with DSC branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* DSC Logo + Wordmark - LARGER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* Logo badge */}
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              backgroundColor: OG_COLORS.goldAccent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "bold",
              color: OG_COLORS.darkBg,
              boxShadow: "0 4px 12px rgba(212, 168, 83, 0.3)",
            }}
          >
            DSC
          </div>
          {/* Wordmark */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: "600",
                color: OG_COLORS.textPrimary,
                lineHeight: 1.2,
              }}
            >
              Denver Songwriters
            </span>
            <span
              style={{
                fontSize: "22px",
                fontWeight: "600",
                color: OG_COLORS.goldAccent,
                lineHeight: 1.2,
              }}
            >
              Collective
            </span>
          </div>
        </div>

        {/* Kind badge (e.g., "Songwriter", "Open Mic", "Venue") */}
        <div
          style={{
            backgroundColor: kindStyles.bg,
            border: `2px solid ${kindStyles.border}`,
            borderRadius: "24px",
            padding: "10px 24px",
            fontSize: "20px",
            color: kindStyles.text,
            fontWeight: "600",
          }}
        >
          {kindLabel}
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: "40px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left side: Text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Title */}
          <h1
            style={{
              fontSize: title.length > 40 ? "44px" : "52px",
              fontWeight: "bold",
              color: OG_COLORS.textPrimary,
              margin: "0 0 16px 0",
              lineHeight: 1.15,
              maxWidth: "650px",
            }}
          >
            {title.length > 55 ? title.slice(0, 55) + "..." : title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p
              style={{
                fontSize: "26px",
                color: OG_COLORS.textSecondary,
                margin: "0 0 20px 0",
                lineHeight: 1.3,
                maxWidth: "600px",
              }}
            >
              {subtitle.length > 80 ? subtitle.slice(0, 80) + "..." : subtitle}
            </p>
          )}

          {/* Chips row */}
          {chips.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "8px",
              }}
            >
              {chips.slice(0, 4).map((chip, idx) => {
                const styles = getPillStyles(chip.variant);
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: styles.bg,
                      border: `2px solid ${styles.border}`,
                      borderRadius: "20px",
                      padding: "8px 18px",
                      fontSize: "18px",
                      color: styles.text,
                      fontWeight: "500",
                    }}
                  >
                    {chip.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Author (for blog posts) */}
          {author && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginTop: "24px",
              }}
            >
              {author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img
                <img
                  src={author.avatarUrl}
                  width={48}
                  height={48}
                  alt=""
                  style={{
                    borderRadius: "24px",
                    objectFit: "cover",
                    border: `2px solid ${OG_COLORS.goldAccent}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "24px",
                    backgroundColor: OG_COLORS.goldAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: OG_COLORS.darkBg,
                  }}
                >
                  {author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  fontSize: "22px",
                  color: OG_COLORS.goldAccent,
                  fontWeight: "500",
                }}
              >
                {author.name}
              </span>
            </div>
          )}
        </div>

        {/* Right side: Entity image */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires raw img
            <img
              src={imageUrl}
              width={320}
              height={320}
              alt=""
              style={{
                borderRadius: "24px",
                objectFit: "cover",
                border: `3px solid rgba(212, 168, 83, 0.4)`,
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              }}
            />
          ) : (
            <div
              style={{
                width: "320px",
                height: "320px",
                borderRadius: "24px",
                backgroundColor: "rgba(212, 168, 83, 0.15)",
                border: `3px solid rgba(212, 168, 83, 0.3)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "100px",
              }}
            >
              {fallbackEmoji}
            </div>
          )}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          width: "100%",
          height: "5px",
          backgroundColor: OG_COLORS.goldAccent,
          marginTop: "32px",
          borderRadius: "3px",
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}
