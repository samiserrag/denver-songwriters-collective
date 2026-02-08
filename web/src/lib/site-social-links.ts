export interface SiteSocialLink {
  label: string;
  url: string;
  platform: string;
}

const KNOWN_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "x",
  "spotify",
  "bandcamp",
  "website",
]);

export const DEFAULT_SITE_SOCIAL_LINKS: SiteSocialLink[] = [
  {
    label: "Instagram",
    url: "https://www.instagram.com/denver_songwriters_collective",
    platform: "instagram",
  },
  {
    label: "Facebook",
    url: "https://www.facebook.com/groups/denversongwriterscollective",
    platform: "facebook",
  },
  {
    label: "YouTube",
    url: "https://www.youtube.com/@DenverSongwritersCollective",
    platform: "youtube",
  },
];

function inferPlatformFromUrl(url: URL): string {
  const host = url.hostname.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("facebook.com")) return "facebook";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("x.com") || host.includes("twitter.com")) return "x";
  if (host.includes("spotify.com")) return "spotify";
  if (host.includes("bandcamp.com")) return "bandcamp";
  return "website";
}

function sanitizeLinkEntry(input: unknown): SiteSocialLink | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  const rawPlatform = typeof raw.platform === "string" ? raw.platform.trim().toLowerCase() : "";

  if (!label || !rawUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    const platform = KNOWN_PLATFORMS.has(rawPlatform)
      ? rawPlatform
      : inferPlatformFromUrl(parsedUrl);

    return {
      label,
      url: parsedUrl.toString(),
      platform,
    };
  } catch {
    return null;
  }
}

export function sanitizeSiteSocialLinks(input: unknown): SiteSocialLink[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();
  const sanitized: SiteSocialLink[] = [];

  for (const item of input) {
    const link = sanitizeLinkEntry(item);
    if (!link) continue;

    const key = `${link.platform}|${link.url}|${link.label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sanitized.push(link);

    if (sanitized.length >= 12) {
      break;
    }
  }

  return sanitized;
}
