import {
  canonicalizeMediaReference,
  classifyUrl,
  getMediaEmbedIframeMeta,
  getMusicProfileLinkMeta,
  normalizeMediaEmbedUrl,
} from "@/lib/mediaEmbeds";
import { MusicProfileCard } from "./MusicProfileCard";

interface MediaEmbedsSectionProps {
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  bandcampUrl?: string | null;
  heading?: string;
  className?: string;
}

function safeFallbackHref(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function MediaEmbedsSection({
  youtubeUrl,
  spotifyUrl,
  bandcampUrl,
  heading = "Media",
  className,
}: MediaEmbedsSectionProps) {
  const seen = new Set<string>();

  const entries: Array<{
    key: "youtube" | "spotify" | "bandcamp";
    meta?: ReturnType<typeof getMediaEmbedIframeMeta>;
    profileMeta?: ReturnType<typeof getMusicProfileLinkMeta>;
    fallbackHref?: string;
  }> = [];

  function pushDeduped(entry: {
    key: "youtube" | "spotify" | "bandcamp";
    meta?: ReturnType<typeof getMediaEmbedIframeMeta>;
    profileMeta?: ReturnType<typeof getMusicProfileLinkMeta>;
    fallbackHref?: string;
  }) {
    const candidate =
      entry.meta?.src ?? entry.profileMeta?.href ?? entry.fallbackHref ?? null;
    if (!candidate) return;
    const key = canonicalizeMediaReference(candidate);
    if (!key || seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  }

  if (youtubeUrl?.trim()) {
    try {
      const normalized = normalizeMediaEmbedUrl(youtubeUrl, { expectedProvider: "youtube" });
      if (normalized) {
        pushDeduped({
          key: "youtube",
          meta: getMediaEmbedIframeMeta(normalized.normalized_url),
        });
      }
    } catch {
      const profileMeta = getMusicProfileLinkMeta(youtubeUrl);
      if (profileMeta) {
        pushDeduped({ key: "youtube", profileMeta });
      } else {
        const fallbackHref = safeFallbackHref(youtubeUrl);
        if (fallbackHref) pushDeduped({ key: "youtube", fallbackHref });
      }
    }
  }

  if (spotifyUrl?.trim()) {
    try {
      const normalized = normalizeMediaEmbedUrl(spotifyUrl, { expectedProvider: "spotify" });
      if (normalized) {
        pushDeduped({
          key: "spotify",
          meta: getMediaEmbedIframeMeta(normalized.normalized_url),
        });
      }
    } catch {
      const profileMeta = getMusicProfileLinkMeta(spotifyUrl);
      if (profileMeta) {
        pushDeduped({ key: "spotify", profileMeta });
      } else {
        const fallbackHref = safeFallbackHref(spotifyUrl);
        if (fallbackHref) pushDeduped({ key: "spotify", fallbackHref });
      }
    }
  }

  if (bandcampUrl?.trim()) {
    try {
      const classified = classifyUrl(bandcampUrl);
      if (classified.provider === "bandcamp" && classified.embed_url) {
        pushDeduped({
          key: "bandcamp",
          fallbackHref: classified.embed_url,
        });
      } else {
        const profileMeta = getMusicProfileLinkMeta(bandcampUrl);
        if (profileMeta) {
          pushDeduped({ key: "bandcamp", profileMeta });
        } else {
          const fallbackHref = safeFallbackHref(bandcampUrl);
          if (fallbackHref) pushDeduped({ key: "bandcamp", fallbackHref });
        }
      }
    } catch {
      const profileMeta = getMusicProfileLinkMeta(bandcampUrl);
      if (profileMeta) {
        pushDeduped({ key: "bandcamp", profileMeta });
      } else {
        const fallbackHref = safeFallbackHref(bandcampUrl);
        if (fallbackHref) pushDeduped({ key: "bandcamp", fallbackHref });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
        {heading}
      </h2>
      <div className="space-y-4">
        {entries.map((entry) => {
          if (entry.profileMeta) {
            return (
              <MusicProfileCard
                key={`${entry.key}-profile`}
                meta={entry.profileMeta}
              />
            );
          }

          if (entry.key === "bandcamp" && entry.fallbackHref?.includes("bandcamp.com/EmbeddedPlayer")) {
            return (
              <div
                key={`${entry.key}-embed`}
                className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
              >
                <iframe
                  src={entry.fallbackHref}
                  title="Bandcamp player"
                  loading="lazy"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="block w-full border-0"
                  height={120}
                />
              </div>
            );
          }

          if (!entry.meta) {
            return (
              <a
                key={`${entry.key}-fallback`}
                href={entry.fallbackHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-link)] hover:border-[var(--color-border-accent)]/50"
              >
                <span>
                  Open{" "}
                  {entry.key === "youtube"
                    ? "YouTube"
                    : entry.key === "spotify"
                      ? "Spotify"
                      : "Bandcamp"}
                </span>
                <span aria-hidden>↗</span>
              </a>
            );
          }

          const isYouTube = entry.meta.provider === "youtube";
          const spotifyHeight = entry.meta.kind === "track" ? 152 : 352;

          return (
            <div
              key={`${entry.key}-embed`}
              className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
            >
              {isYouTube ? (
                <div className="relative w-full pt-[56.25%]">
                  <iframe
                    src={entry.meta.src}
                    title={entry.meta.title}
                    loading="lazy"
                    allow={entry.meta.allow}
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              ) : (
                <iframe
                  src={entry.meta.src}
                  title={entry.meta.title}
                  loading="lazy"
                  allow={entry.meta.allow}
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="block w-full border-0"
                  height={spotifyHeight}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
