import {
  canonicalizeMediaReference,
  classifyUrl,
  getMediaEmbedIframeMeta,
} from "@/lib/mediaEmbeds";

export type SongPlatformInfo = {
  name: string;
  color: string;
};

export type SongLinksDisplay = {
  featuredSongUrl: string | null;
  additionalSongLinks: string[];
  hasAnySongLinks: boolean;
};

export type SongLinkEmbedMeta =
  | {
      provider: "youtube" | "spotify";
      iframe: ReturnType<typeof getMediaEmbedIframeMeta>;
    }
  | {
      provider: "bandcamp";
      src: string;
    };

export function getSongPlatformInfo(url: string): SongPlatformInfo {
  const value = url.toLowerCase();
  if (value.includes("spotify")) return { name: "Spotify", color: "bg-[#1DB954]" };
  if (value.includes("soundcloud")) return { name: "SoundCloud", color: "bg-[#FF5500]" };
  if (value.includes("youtube") || value.includes("youtu.be")) return { name: "YouTube", color: "bg-[#FF0000]" };
  if (value.includes("bandcamp")) return { name: "Bandcamp", color: "bg-[#1DA0C3]" };
  if (value.includes("apple")) return { name: "Apple Music", color: "bg-[#FA2D48]" };
  return { name: "Listen", color: "bg-[var(--color-accent-muted)]" };
}

function canonicalSongKey(url: string): string {
  return canonicalizeMediaReference(url)?.toLowerCase() ?? url.trim().toLowerCase();
}

export function buildSongLinksDisplay(
  featuredSongUrl: string | null | undefined,
  songLinks: string[] | null | undefined
): SongLinksDisplay {
  const featured = typeof featuredSongUrl === "string" ? featuredSongUrl.trim() : "";
  const normalizedFeatured = featured || null;
  const featuredKey = normalizedFeatured ? canonicalSongKey(normalizedFeatured) : null;

  const additionalSongLinks: string[] = [];
  const seen = new Set<string>();

  for (const rawLink of songLinks ?? []) {
    const trimmed = typeof rawLink === "string" ? rawLink.trim() : "";
    if (!trimmed) continue;

    const key = canonicalSongKey(trimmed);
    if (featuredKey && key === featuredKey) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    additionalSongLinks.push(trimmed);
  }

  return {
    featuredSongUrl: normalizedFeatured,
    additionalSongLinks,
    hasAnySongLinks: Boolean(normalizedFeatured) || additionalSongLinks.length > 0,
  };
}

export function getSongLinkEmbedMeta(url: string): SongLinkEmbedMeta | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const classified = classifyUrl(trimmed);
    if (!classified.embed_url) return null;

    if (classified.provider === "youtube" || classified.provider === "spotify") {
      return {
        provider: classified.provider,
        iframe: getMediaEmbedIframeMeta(classified.embed_url),
      };
    }

    if (
      classified.provider === "bandcamp" &&
      classified.embed_url.includes("bandcamp.com/EmbeddedPlayer")
    ) {
      return {
        provider: "bandcamp",
        src: classified.embed_url,
      };
    }
  } catch {
    return null;
  }

  return null;
}
