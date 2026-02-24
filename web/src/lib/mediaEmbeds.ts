export type MediaEmbedProvider = "youtube" | "spotify" | "bandcamp" | "external";

export type MediaEmbedKind =
  | "video"
  | "playlist"
  | "track"
  | "album"
  | "episode"
  | "show";

export interface NormalizedMediaEmbed {
  provider: MediaEmbedProvider;
  kind: MediaEmbedKind;
  normalized_url: string;
}

type MediaFieldName = "youtube_url" | "spotify_url";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
]);

const SPOTIFY_HOSTS = new Set(["open.spotify.com", "www.open.spotify.com"]);

const BANDCAMP_HOSTS = new Set(["bandcamp.com", "www.bandcamp.com"]);

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,}$/;
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{8,}$/;

/**
 * Hosts from which we accept iframe embed `src` values.
 * If a user pastes an `<iframe>` snippet, we extract `src` and only accept
 * it when the hostname is in this set.
 */
const IFRAME_EMBED_ALLOWLIST = new Set([
  "youtube.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "open.spotify.com",
  "bandcamp.com",
  "www.bandcamp.com",
]);

/**
 * Accept either a URL string or an `<iframe>` embed snippet.
 * If the input contains `<iframe`, extracts the `src` attribute and validates
 * its hostname against the allowlist. Returns the extracted URL or an error.
 */
export function parseEmbedInput(input: string): { url: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Input is required." };

  // Bandcamp WordPress shortcode: [bandcamp width=N height=N album=N]
  const bcShortcode = trimmed.match(
    /^\[bandcamp\s[^\]]*\balbum=(\d+)[^\]]*\]/i
  );
  if (bcShortcode) {
    const albumId = bcShortcode[1];
    return {
      url: `https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/tracklist=false/artwork=small/transparent=true/`,
    };
  }

  // Not an iframe snippet — treat as plain URL
  if (!trimmed.includes("<iframe")) {
    // Reject raw HTML that isn't an iframe
    if (trimmed.includes("<") && trimmed.includes(">")) {
      return { error: "Only URLs or <iframe> embed snippets are accepted." };
    }
    return { url: trimmed };
  }

  // Extract src="..." from the iframe
  const srcMatch = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch || !srcMatch[1]) {
    return { error: "Could not find src attribute in the iframe snippet." };
  }

  const src = srcMatch[1].trim();

  // Validate protocol
  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return { error: "The iframe src is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { error: "Only https iframe embeds are accepted." };
  }

  // Validate hostname against allowlist
  const host = parsed.hostname.toLowerCase();
  if (!IFRAME_EMBED_ALLOWLIST.has(host)) {
    return { error: `Iframe embeds from ${host} are not allowed. Supported: YouTube, Spotify, Bandcamp.` };
  }

  return { url: src };
}

export class MediaEmbedValidationError extends Error {
  field?: MediaFieldName;
  status: number;

  constructor(message: string, field?: MediaFieldName) {
    super(message);
    this.name = "MediaEmbedValidationError";
    this.field = field;
    this.status = 400;
  }
}

function assertId(id: string, re: RegExp, label: string, field?: MediaFieldName): string {
  if (!re.test(id)) {
    throw new MediaEmbedValidationError(`Invalid ${label} URL format.`, field);
  }
  return id;
}

function normalizeYouTubeUrl(inputUrl: URL, field?: MediaFieldName): NormalizedMediaEmbed {
  const host = inputUrl.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    throw new MediaEmbedValidationError("YouTube URL must use youtube.com, youtu.be, or music.youtube.com.", field);
  }

  const path = inputUrl.pathname.replace(/\/+$/, "");
  let kind: MediaEmbedKind;
  let normalized_url: string;

  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = assertId(path.replace(/^\//, ""), YOUTUBE_ID_RE, "YouTube video", field);
    kind = "video";
    normalized_url = `https://www.youtube-nocookie.com/embed/${id}`;
  } else if (path === "/watch") {
    const videoId = inputUrl.searchParams.get("v");
    const playlistId = inputUrl.searchParams.get("list");
    if (videoId) {
      const id = assertId(videoId, YOUTUBE_ID_RE, "YouTube video", field);
      kind = "video";
      normalized_url = `https://www.youtube-nocookie.com/embed/${id}`;
    } else if (playlistId) {
      const listId = assertId(playlistId, YOUTUBE_ID_RE, "YouTube playlist", field);
      kind = "playlist";
      normalized_url = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
    } else {
      throw new MediaEmbedValidationError("YouTube URL must include a video (v=) or playlist (list=).", field);
    }
  } else if (path === "/playlist") {
    const playlistId = inputUrl.searchParams.get("list");
    if (!playlistId) {
      throw new MediaEmbedValidationError("YouTube playlist URL is missing list= parameter.", field);
    }
    const listId = assertId(playlistId, YOUTUBE_ID_RE, "YouTube playlist", field);
    kind = "playlist";
    normalized_url = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
  } else if (path.startsWith("/embed/videoseries")) {
    const playlistId = inputUrl.searchParams.get("list");
    if (!playlistId) {
      throw new MediaEmbedValidationError("YouTube playlist embed URL is missing list= parameter.", field);
    }
    const listId = assertId(playlistId, YOUTUBE_ID_RE, "YouTube playlist", field);
    kind = "playlist";
    normalized_url = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
  } else if (path.startsWith("/embed/")) {
    const id = assertId(path.replace("/embed/", ""), YOUTUBE_ID_RE, "YouTube video", field);
    kind = "video";
    normalized_url = `https://www.youtube-nocookie.com/embed/${id}`;
  } else {
    throw new MediaEmbedValidationError(
      "Unsupported YouTube URL. Use youtu.be, youtube.com/watch, youtube.com/playlist, or youtube.com/embed links.",
      field
    );
  }

  return { provider: "youtube", kind, normalized_url };
}

function normalizeSpotifyUrl(inputUrl: URL, field?: MediaFieldName): NormalizedMediaEmbed {
  const host = inputUrl.hostname.toLowerCase();
  if (!SPOTIFY_HOSTS.has(host)) {
    throw new MediaEmbedValidationError("Spotify URL must use open.spotify.com.", field);
  }

  const segments = inputUrl.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new MediaEmbedValidationError("Unsupported Spotify URL format.", field);
  }

  const [first, second, third] = segments;
  let kind: MediaEmbedKind;
  let id: string;

  if (first === "embed") {
    if (!second || !third) {
      throw new MediaEmbedValidationError("Spotify embed URL is missing resource type or id.", field);
    }
    kind = second as MediaEmbedKind;
    id = third;
  } else {
    kind = first as MediaEmbedKind;
    id = second;
  }

  if (!["track", "playlist", "album", "show", "episode"].includes(kind)) {
    throw new MediaEmbedValidationError("Spotify URL must be a track, playlist, album, show, or episode.", field);
  }

  const resourceId = assertId(id, SPOTIFY_ID_RE, `Spotify ${kind}`, field);
  return {
    provider: "spotify",
    kind,
    normalized_url: `https://open.spotify.com/embed/${kind}/${resourceId}`,
  };
}

export function normalizeMediaEmbedUrl(
  input: string | null | undefined,
  options?: { expectedProvider?: MediaEmbedProvider; field?: MediaFieldName }
): NormalizedMediaEmbed | null {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return null;

  let inputUrl: URL;
  try {
    inputUrl = new URL(trimmed);
  } catch {
    throw new MediaEmbedValidationError("Please provide a valid full URL.", options?.field);
  }

  if (inputUrl.protocol !== "https:" && inputUrl.protocol !== "http:") {
    throw new MediaEmbedValidationError("Only http(s) URLs are allowed.", options?.field);
  }

  const host = inputUrl.hostname.toLowerCase();
  const normalized = YOUTUBE_HOSTS.has(host)
    ? normalizeYouTubeUrl(inputUrl, options?.field)
    : SPOTIFY_HOSTS.has(host)
      ? normalizeSpotifyUrl(inputUrl, options?.field)
      : null;

  if (!normalized) {
    throw new MediaEmbedValidationError("Only YouTube and Spotify URLs are supported.", options?.field);
  }

  if (options?.expectedProvider && normalized.provider !== options.expectedProvider) {
    throw new MediaEmbedValidationError(
      options.expectedProvider === "youtube" ? "Please provide a YouTube URL." : "Please provide a Spotify URL.",
      options.field
    );
  }

  return normalized;
}

export interface MediaEmbedIframeMeta {
  provider: MediaEmbedProvider;
  kind: MediaEmbedKind;
  src: string;
  title: string;
  providerLabel: string;
  allow: string;
}

export function getMediaEmbedIframeMeta(normalizedUrl: string): MediaEmbedIframeMeta {
  const normalized = normalizeMediaEmbedUrl(normalizedUrl);
  if (!normalized) {
    throw new MediaEmbedValidationError("Embed URL is empty.");
  }

  if (normalized.provider === "youtube") {
    return {
      provider: "youtube",
      kind: normalized.kind,
      src: normalized.normalized_url,
      title: normalized.kind === "playlist" ? "YouTube playlist player" : "YouTube video player",
      providerLabel: "YouTube",
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    };
  }

  return {
    provider: "spotify",
    kind: normalized.kind,
    src: normalized.normalized_url,
    title: `Spotify ${normalized.kind} player`,
    providerLabel: "Spotify",
    allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
  };
}

export function getFieldErrorObject(error: unknown): Record<string, string> | null {
  if (error instanceof MediaEmbedValidationError && error.field) {
    return { [error.field]: error.message };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Multi-embed support (Phase 1.5)
// ---------------------------------------------------------------------------

export type MediaEmbedTargetType = "event" | "event_override" | "profile" | "blog_post" | "gallery_album" | "venue";

export interface ClassifiedUrl {
  url: string;
  provider: MediaEmbedProvider;
  kind: "video" | "audio" | "external";
  embed_url: string | null; // null for external providers
}

export type MusicProfileProvider = "youtube" | "spotify" | "bandcamp";

export interface MusicProfileLinkMeta {
  provider: MusicProfileProvider;
  href: string;
  dedupe_key: string;
  headline: string;
  supportingText: string;
  ctaLabel: string;
}

function canonicalizeHttpUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");

    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "si") {
        params.delete(key);
      }
    }
    const sorted = new URLSearchParams();
    for (const key of Array.from(params.keys()).sort()) {
      const values = params.getAll(key);
      for (const value of values) sorted.append(key, value);
    }
    const query = sorted.toString();

    return `https://${host}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

export function canonicalizeMediaReference(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  try {
    const normalized = normalizeMediaEmbedUrl(trimmed);
    if (normalized) {
      return canonicalizeHttpUrl(normalized.normalized_url);
    }
  } catch {
    // Fall through to raw URL canonicalization.
  }

  return canonicalizeHttpUrl(trimmed);
}

export function getMusicProfileLinkMeta(raw: string | null | undefined): MusicProfileLinkMeta | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const canonicalHref = canonicalizeHttpUrl(trimmed);
  if (!canonicalHref) return null;

  if (YOUTUBE_HOSTS.has(host)) {
    // Embeddable/media-specific URLs are handled separately via normalizeMediaEmbedUrl.
    if (
      host === "youtu.be" ||
      host === "www.youtu.be" ||
      path === "/watch" ||
      path === "/playlist" ||
      path.startsWith("/embed/") ||
      path.startsWith("/shorts/")
    ) {
      return null;
    }

    let handleOrChannel = "";
    if (segments[0]?.startsWith("@")) {
      handleOrChannel = segments[0];
    } else if (["channel", "c", "user"].includes(segments[0] ?? "") && segments[1]) {
      handleOrChannel = segments[1];
    } else {
      return null;
    }

    return {
      provider: "youtube",
      href: canonicalHref,
      dedupe_key: canonicalHref.toLowerCase(),
      headline: handleOrChannel,
      supportingText: "YouTube channel",
      ctaLabel: "Open on YouTube",
    };
  }

  if (SPOTIFY_HOSTS.has(host)) {
    if (!segments[0] || !segments[1]) return null;
    if (segments[0] !== "artist" && segments[0] !== "user") return null;

    const isArtist = segments[0] === "artist";
    return {
      provider: "spotify",
      href: canonicalHref,
      dedupe_key: canonicalHref.toLowerCase(),
      headline: segments[1],
      supportingText: isArtist ? "Spotify artist profile" : "Spotify user profile",
      ctaLabel: "Open on Spotify",
    };
  }

  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) {
    if (path.startsWith("/EmbeddedPlayer")) return null;

    const subdomain = host.replace(/\.bandcamp\.com$/, "");
    const isRootDomain = host === "bandcamp.com";
    const headline = isRootDomain
      ? segments[0] || "Bandcamp"
      : subdomain;

    return {
      provider: "bandcamp",
      href: canonicalHref,
      dedupe_key: canonicalHref.toLowerCase(),
      headline,
      supportingText: "Bandcamp profile",
      ctaLabel: "Open on Bandcamp",
    };
  }

  return null;
}

/**
 * Classify any URL into provider/kind. YouTube and Spotify get inline embeds;
 * everything else is classified as "external" with a safe outbound card.
 */
export function classifyUrl(input: string): ClassifiedUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new MediaEmbedValidationError("URL is required.");
  }

  let inputUrl: URL;
  try {
    inputUrl = new URL(trimmed);
  } catch {
    throw new MediaEmbedValidationError("Please provide a valid full URL.");
  }

  if (inputUrl.protocol !== "https:" && inputUrl.protocol !== "http:") {
    throw new MediaEmbedValidationError("Only http(s) URLs are allowed.");
  }

  const host = inputUrl.hostname.toLowerCase();

  // YouTube
  if (YOUTUBE_HOSTS.has(host)) {
    const result = normalizeYouTubeUrl(inputUrl);
    return {
      url: trimmed,
      provider: "youtube",
      kind: "video",
      embed_url: result.normalized_url,
    };
  }

  // Spotify
  if (SPOTIFY_HOSTS.has(host)) {
    const result = normalizeSpotifyUrl(inputUrl);
    return {
      url: trimmed,
      provider: "spotify",
      kind: "audio",
      embed_url: result.normalized_url,
    };
  }

  // Bandcamp EmbeddedPlayer
  if (BANDCAMP_HOSTS.has(host) && inputUrl.pathname.startsWith("/EmbeddedPlayer")) {
    return {
      url: trimmed,
      provider: "bandcamp",
      kind: "audio",
      embed_url: trimmed, // already an embed URL; store as-is
    };
  }

  // Everything else is external
  return {
    url: trimmed,
    provider: "external",
    kind: "external",
    embed_url: null,
  };
}

export interface MediaEmbedRow {
  id?: string;
  target_type: MediaEmbedTargetType;
  target_id: string;
  date_key?: string | null;
  position: number;
  url: string;
  provider: string;
  kind: string;
  created_by: string;
}

export interface BuildEmbedRowsError {
  index: number;
  url: string;
  message: string;
}

export interface BuildEmbedRowsResult {
  rows: MediaEmbedRow[];
  errors: BuildEmbedRowsError[];
}

/**
 * Build ordered rows from a list of user-submitted URLs or iframe snippets.
 * Validates and classifies each input; strips empty entries.
 * Invalid inputs are collected in `errors` instead of failing the whole batch.
 */
export function buildEmbedRows(
  urls: string[],
  target: { type: MediaEmbedTargetType; id: string; date_key?: string | null },
  createdBy: string
): MediaEmbedRow[] {
  const result = buildEmbedRowsSafe(urls, target, createdBy);
  return result.rows;
}

/**
 * Same as buildEmbedRows but also returns per-row errors.
 */
export function buildEmbedRowsSafe(
  urls: string[],
  target: { type: MediaEmbedTargetType; id: string; date_key?: string | null },
  createdBy: string
): BuildEmbedRowsResult {
  const rows: MediaEmbedRow[] = [];
  const errors: BuildEmbedRowsError[] = [];
  let position = 0;

  for (let i = 0; i < urls.length; i++) {
    const raw = urls[i].trim();
    if (!raw) continue;

    // Step 1: Parse iframe snippets into URLs
    const parsed = parseEmbedInput(raw);
    if ("error" in parsed) {
      errors.push({ index: i, url: raw, message: parsed.error });
      continue;
    }

    // Step 2: Classify the URL
    try {
      const classified = classifyUrl(parsed.url);
      rows.push({
        target_type: target.type,
        target_id: target.id,
        date_key: target.date_key ?? null,
        position: position++,
        url: classified.url,
        provider: classified.provider,
        kind: classified.kind,
        created_by: createdBy,
      });
    } catch (err) {
      const message = err instanceof MediaEmbedValidationError ? err.message : "Invalid URL.";
      errors.push({ index: i, url: raw, message });
    }
  }

  return { rows, errors };
}
