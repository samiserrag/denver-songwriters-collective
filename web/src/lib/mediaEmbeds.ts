export type MediaEmbedProvider = "youtube" | "spotify" | "external";

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

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,}$/;
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{8,}$/;

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

export type MediaEmbedTargetType = "event" | "event_override" | "profile";

export interface ClassifiedUrl {
  url: string;
  provider: MediaEmbedProvider;
  kind: "video" | "audio" | "external";
  embed_url: string | null; // null for external providers
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

/**
 * Build ordered rows from a list of user-submitted URLs.
 * Validates and classifies each URL; strips empty entries.
 */
export function buildEmbedRows(
  urls: string[],
  target: { type: MediaEmbedTargetType; id: string; date_key?: string | null },
  createdBy: string
): MediaEmbedRow[] {
  return urls
    .map((u) => u.trim())
    .filter(Boolean)
    .map((url, index) => {
      const classified = classifyUrl(url);
      return {
        target_type: target.type,
        target_id: target.id,
        date_key: target.date_key ?? null,
        position: index,
        url: classified.url,
        provider: classified.provider,
        kind: classified.kind,
        created_by: createdBy,
      };
    });
}
