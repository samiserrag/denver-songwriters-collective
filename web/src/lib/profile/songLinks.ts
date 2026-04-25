import {
  canonicalizeMediaReference,
  classifyUrl,
  getMediaEmbedIframeMeta,
  normalizeMediaEmbedUrl,
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

export type UnsupportedMusicLink = {
  url: string;
  label: string;
  guidance: string;
};

export type SongLinkEmbedMeta =
  | {
      provider: "youtube" | "spotify";
      iframe: ReturnType<typeof getMediaEmbedIframeMeta>;
    }
  | {
      provider: "bandcamp";
      src: string;
    }
  | {
      provider: "reverbnation";
      src: string;
      title: string;
      height: number;
    };

export function getSongPlatformInfo(url: string): SongPlatformInfo {
  const value = url.toLowerCase();
  if (value.includes("spotify")) return { name: "Spotify", color: "bg-[#1DB954]" };
  if (value.includes("soundcloud")) return { name: "SoundCloud", color: "bg-[#FF5500]" };
  if (value.includes("youtube") || value.includes("youtu.be")) return { name: "YouTube", color: "bg-[#FF0000]" };
  if (value.includes("bandcamp")) return { name: "Bandcamp", color: "bg-[#1DA0C3]" };
  if (value.includes("reverbnation")) return { name: "ReverbNation", color: "bg-[#E35B1F]" };
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

export function getUnsupportedMusicLink(url: string): UnsupportedMusicLink {
  const platform = getSongPlatformInfo(url);
  const value = url.toLowerCase();

  if (value.includes("bandcamp")) {
    return {
      url,
      label: platform.name,
      guidance: "Use a Bandcamp track or album URL so the native player can load.",
    };
  }

  if (value.includes("reverbnation")) {
    return {
      url,
      label: platform.name,
      guidance: "Use a ReverbNation song or player URL.",
    };
  }

  if (value.includes("spotify")) {
    return {
      url,
      label: platform.name,
      guidance: "Use a Spotify artist, track, album, or playlist URL instead of a user profile.",
    };
  }

  if (value.includes("youtube") || value.includes("youtu.be")) {
    return {
      url,
      label: platform.name,
      guidance: "Use a YouTube video, playlist, or channel URL that can resolve to uploads.",
    };
  }

  return {
    url,
    label: platform.name,
    guidance: "Use a supported track, album, playlist, video, or artist URL.",
  };
}

export function getUnsupportedSongLinks(
  display: SongLinksDisplay,
  embedMap: Map<string, SongLinkEmbedMeta>
): UnsupportedMusicLink[] {
  const urls = [display.featuredSongUrl, ...display.additionalSongLinks].filter(
    (value): value is string => Boolean(value)
  );

  return urls
    .filter((url) => !embedMap.has(url))
    .map((url) => getUnsupportedMusicLink(url));
}

export function getUnsupportedMusicProfileLinks({
  youtubeUrl,
  spotifyUrl,
  bandcampUrl,
}: {
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  bandcampUrl?: string | null;
}): UnsupportedMusicLink[] {
  const unsupported: UnsupportedMusicLink[] = [];

  if (youtubeUrl?.trim()) {
    try {
      if (!normalizeMediaEmbedUrl(youtubeUrl, { expectedProvider: "youtube" })) {
        unsupported.push(getUnsupportedMusicLink(youtubeUrl));
      }
    } catch {
      unsupported.push(getUnsupportedMusicLink(youtubeUrl));
    }
  }

  if (spotifyUrl?.trim()) {
    try {
      if (!normalizeMediaEmbedUrl(spotifyUrl, { expectedProvider: "spotify" })) {
        unsupported.push(getUnsupportedMusicLink(spotifyUrl));
      }
    } catch {
      unsupported.push(getUnsupportedMusicLink(spotifyUrl));
    }
  }

  if (bandcampUrl?.trim()) {
    try {
      const classified = classifyUrl(bandcampUrl);
      if (!(classified.provider === "bandcamp" && classified.embed_url)) {
        unsupported.push(getUnsupportedMusicLink(bandcampUrl));
      }
    } catch {
      unsupported.push(getUnsupportedMusicLink(bandcampUrl));
    }
  }

  return unsupported;
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

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readAttribute(html: string, attr: string): string | null {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1].trim()) : null;
}

function isHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isBandcampHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  return normalized === "bandcamp.com" || normalized.endsWith(".bandcamp.com");
}

function isReverbNationHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  return normalized === "reverbnation.com" || normalized.endsWith(".reverbnation.com");
}

function getBandcampEmbedUrlFromHtml(html: string): string | null {
  const meta = html.match(/<meta[^>]+name=["']bc-page-properties["'][^>]*>/i)?.[0];
  const content = meta ? readAttribute(meta, "content") : null;
  if (!content) return null;

  try {
    const props = JSON.parse(content) as { item_type?: string; item_id?: number | string };
    const type = props.item_type === "track" ? "track" : props.item_type === "album" ? "album" : null;
    const id = props.item_id ? String(props.item_id) : null;
    if (!type || !id || !/^\d+$/.test(id)) return null;
    return `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/tracklist=false/artwork=small/transparent=true/`;
  } catch {
    return null;
  }
}

async function resolveBandcampPageEmbed(url: string): Promise<SongLinkEmbedMeta | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!isBandcampHost(parsed.hostname) || parsed.pathname.startsWith("/EmbeddedPlayer")) return null;

  try {
    const response = await fetch(parsed.toString(), { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) return null;
    const embedUrl = getBandcampEmbedUrlFromHtml(await response.text());
    return embedUrl ? { provider: "bandcamp", src: embedUrl } : null;
  } catch {
    return null;
  }
}

function extractTrustedIframe(html: string, allowed: (host: string) => boolean): { src: string; height: number } | null {
  const iframe = html.match(/<iframe\b[^>]*>/i)?.[0];
  if (!iframe) return null;

  const src = readAttribute(iframe, "src");
  if (!src || !isHttpUrl(src)) return null;

  const parsed = new URL(src);
  if (!allowed(parsed.hostname)) return null;

  const rawHeight = readAttribute(iframe, "height");
  const parsedHeight = rawHeight ? Number.parseInt(rawHeight, 10) : 300;
  const height = Number.isFinite(parsedHeight) ? Math.min(Math.max(parsedHeight, 120), 640) : 300;
  return { src: parsed.toString(), height };
}

async function resolveReverbNationEmbed(url: string): Promise<SongLinkEmbedMeta | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!isReverbNationHost(parsed.hostname)) return null;

  const oembedUrl = new URL("https://www.reverbnation.com/oembed");
  oembedUrl.searchParams.set("format", "json");
  oembedUrl.searchParams.set("url", parsed.toString());

  try {
    const response = await fetch(oembedUrl.toString(), { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { html?: string; title?: string; height?: number };
    if (!payload.html) return null;
    const iframe = extractTrustedIframe(payload.html, isReverbNationHost);
    if (!iframe) return null;
    return {
      provider: "reverbnation",
      src: iframe.src,
      title: payload.title || "ReverbNation player",
      height: payload.height ? Math.min(Math.max(payload.height, 120), 640) : iframe.height,
    };
  } catch {
    return null;
  }
}

export async function resolveSongLinkEmbedMeta(url: string): Promise<SongLinkEmbedMeta | null> {
  const direct = getSongLinkEmbedMeta(url);
  if (direct) return direct;

  const trimmed = url.trim();
  if (!trimmed) return null;

  return (await resolveBandcampPageEmbed(trimmed)) ?? (await resolveReverbNationEmbed(trimmed));
}

export async function buildSongLinkEmbedMap(
  featuredSongUrl: string | null | undefined,
  songLinks: string[] | null | undefined
): Promise<Map<string, SongLinkEmbedMeta>> {
  const { featuredSongUrl: featured, additionalSongLinks } = buildSongLinksDisplay(featuredSongUrl, songLinks);
  const urls = [featured, ...additionalSongLinks].filter((value): value is string => Boolean(value));
  const entries = await Promise.all(
    urls.map(async (url) => {
      const meta = await resolveSongLinkEmbedMeta(url);
      return meta ? ([url, meta] as const) : null;
    })
  );
  return new Map(entries.filter((entry): entry is readonly [string, SongLinkEmbedMeta] => Boolean(entry)));
}
