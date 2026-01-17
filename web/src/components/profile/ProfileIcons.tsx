import React from "react";

// Social link icons as inline SVGs
export const SocialIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    instagram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    facebook: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    twitter: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    youtube: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    spotify: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    ),
    tiktok: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
    website: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  };
  return <>{icons[type] || null}</>;
};

// Tip platform icons
export const TipIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    venmo: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.5 2h-15A2.5 2.5 0 002 4.5v15A2.5 2.5 0 004.5 22h15a2.5 2.5 0 002.5-2.5v-15A2.5 2.5 0 0019.5 2zM17.2 8.2c0 2.5-2.1 6.1-3.8 8.5H9.3L7.5 6.3l3.4-.3.9 7.2c.9-1.4 1.9-3.6 1.9-5.1 0-.8-.1-1.3-.3-1.8l3.1-.6c.4.6.7 1.5.7 2.5z"/>
      </svg>
    ),
    cashapp: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.59 3.47A5.1 5.1 0 0020.53.41C19.86.14 19.1 0 18.25 0H5.75C4.9 0 4.14.14 3.47.41a5.1 5.1 0 00-3.06 3.06C.14 4.14 0 4.9 0 5.75v12.5c0 .85.14 1.61.41 2.28a5.1 5.1 0 003.06 3.06c.67.27 1.43.41 2.28.41h12.5c.85 0 1.61-.14 2.28-.41a5.1 5.1 0 003.06-3.06c.27-.67.41-1.43.41-2.28V5.75c0-.85-.14-1.61-.41-2.28zM17.46 14.7l-1.37 1.47c-.17.18-.43.28-.72.28h-.02c-.29 0-.56-.1-.73-.28l-1.73-1.81-.65.69c-.15.17-.37.26-.6.26-.46 0-.85-.37-.85-.84v-.02l.02-1.08h-1.2c-.47 0-.85-.38-.85-.85s.38-.85.85-.85h1.2l-.02-1.05c0-.47.38-.85.85-.85.23 0 .44.09.6.25l.65.68 1.73-1.81c.17-.18.44-.28.73-.28h.02c.29 0 .55.1.72.28l1.37 1.47c.19.2.19.52 0 .72l-1.87 2-.87.93.87.93 1.87 2c.19.2.19.52 0 .72z"/>
      </svg>
    ),
    paypal: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.14c-.528 0-.986.396-1.062.93l-.02.144-1.067 6.757-.015.094a.462.462 0 0 1-.456.4l-.443-.02z"/>
      </svg>
    ),
  };
  return <>{icons[type] || null}</>;
};

// Helper types for building link arrays
export interface SocialLink {
  type: string;
  url: string | null;
  label: string;
}

export interface TipLink {
  type: string;
  handle: string | null;
  url: string | null;
  label: string;
  color: string;
}

/**
 * Normalize a social link value to a full URL.
 * Handles both full URLs and bare handles.
 */
export function normalizeSocialUrl(
  value: string | null | undefined,
  platform: "instagram" | "youtube" | "tiktok" | "twitter" | "website" | "spotify"
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already a full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Platform-specific handle normalization
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${trimmed.replace(/^@/, "")}`;
    case "youtube":
      // Could be @handle or channel name
      return `https://youtube.com/@${trimmed.replace(/^@/, "")}`;
    case "tiktok":
      return `https://tiktok.com/@${trimmed.replace(/^@/, "")}`;
    case "twitter":
      return `https://x.com/${trimmed.replace(/^@/, "")}`;
    case "spotify":
      // Spotify URLs are typically full URLs; if bare, assume artist page
      if (trimmed.includes("spotify")) {
        return `https://${trimmed}`;
      }
      return `https://open.spotify.com/artist/${trimmed}`;
    case "website":
      // Bare domain - add https
      return `https://${trimmed}`;
    default:
      return trimmed;
  }
}

// Helper to build social links array from profile data
// Order: Musician-centric priority (Spotify → YouTube → Instagram → TikTok → Website → Twitter/X)
export function buildSocialLinks(profile: {
  instagram_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  tiktok_url?: string | null;
  website_url?: string | null;
}): SocialLink[] {
  return [
    // Musician-centric priority order
    { type: "spotify", url: normalizeSocialUrl(profile.spotify_url, "spotify"), label: "Spotify" },
    { type: "youtube", url: normalizeSocialUrl(profile.youtube_url, "youtube"), label: "YouTube" },
    { type: "instagram", url: normalizeSocialUrl(profile.instagram_url, "instagram"), label: "Instagram" },
    { type: "tiktok", url: normalizeSocialUrl(profile.tiktok_url, "tiktok"), label: "TikTok" },
    { type: "website", url: normalizeSocialUrl(profile.website_url, "website"), label: "Website" },
    { type: "twitter", url: normalizeSocialUrl(profile.twitter_url, "twitter"), label: "X" },
  ].filter((link) => link.url) as SocialLink[];
}

// Helper to build tip links array from profile data
export function buildTipLinks(profile: {
  venmo_handle?: string | null;
  cashapp_handle?: string | null;
  paypal_url?: string | null;
}): TipLink[] {
  return [
    {
      type: "venmo",
      handle: profile.venmo_handle ?? null,
      url: profile.venmo_handle ? `https://venmo.com/${profile.venmo_handle.replace("@", "")}` : null,
      label: "Venmo",
      color: "bg-[#3D95CE]",
    },
    {
      type: "cashapp",
      handle: profile.cashapp_handle ?? null,
      url: profile.cashapp_handle ? `https://cash.app/${profile.cashapp_handle}` : null,
      label: "Cash App",
      color: "bg-[#00D632]",
    },
    {
      type: "paypal",
      handle: null,
      url: profile.paypal_url ?? null,
      label: "PayPal",
      color: "bg-[#003087]",
    },
  ].filter((link) => link.url || link.handle);
}
