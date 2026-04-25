const YOUTUBE_CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{20,}$/;

type YouTubeProfileReference =
  | { type: "channel"; value: string }
  | { type: "handle"; value: string }
  | { type: "username"; value: string };

interface YouTubeChannelsListResponse {
  items?: Array<{
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
}

function getYouTubeDataApiKey(): string | null {
  return (
    process.env.YOUTUBE_DATA_API_KEY ||
    process.env.GOOGLE_YOUTUBE_API_KEY ||
    process.env.YOUTUBE_API_KEY ||
    null
  );
}

function toUploadsEmbedUrl(uploadsPlaylistId: string): string {
  return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(uploadsPlaylistId)}`;
}

function parseYouTubeProfileReference(raw: string | null | undefined): YouTubeProfileReference | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "youtube.com" && host !== "music.youtube.com") return null;

  const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments[0] === "channel" && YOUTUBE_CHANNEL_ID_RE.test(segments[1] ?? "")) {
    return { type: "channel", value: segments[1] };
  }

  if (segments[0]?.startsWith("@")) {
    return { type: "handle", value: segments[0] };
  }

  if (segments[0] === "user" && segments[1]) {
    return { type: "username", value: segments[1] };
  }

  return null;
}

async function fetchUploadsPlaylistId(reference: YouTubeProfileReference, apiKey: string): Promise<string | null> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("key", apiKey);

  if (reference.type === "channel") {
    url.searchParams.set("id", reference.value);
  } else if (reference.type === "handle") {
    url.searchParams.set("forHandle", reference.value);
  } else {
    url.searchParams.set("forUsername", reference.value);
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as YouTubeChannelsListResponse;
    return payload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  } catch {
    return null;
  }
}

export async function resolveYouTubeProfileEmbedUrl(raw: string | null | undefined): Promise<string | null> {
  const reference = parseYouTubeProfileReference(raw);
  if (!reference) return null;

  if (reference.type === "channel") {
    return toUploadsEmbedUrl(`UU${reference.value.slice(2)}`);
  }

  const apiKey = getYouTubeDataApiKey();
  if (!apiKey) return null;

  const uploadsPlaylistId = await fetchUploadsPlaylistId(reference, apiKey);
  return uploadsPlaylistId ? toUploadsEmbedUrl(uploadsPlaylistId) : null;
}
