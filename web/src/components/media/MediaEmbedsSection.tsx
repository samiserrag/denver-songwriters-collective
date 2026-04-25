import {
  canonicalizeMediaReference,
  classifyUrl,
  getMediaEmbedIframeMeta,
  normalizeMediaEmbedUrl,
} from "@/lib/mediaEmbeds";

interface MediaEmbedsSectionProps {
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  bandcampUrl?: string | null;
  heading?: string | null;
  description?: string;
  hideHeadingWhenOnlyEmbeds?: boolean;
  className?: string;
  excludedReferences?: string[];
}

export function MediaEmbedsSection({
  youtubeUrl,
  spotifyUrl,
  bandcampUrl,
  heading = "Media",
  description,
  hideHeadingWhenOnlyEmbeds = false,
  className,
  excludedReferences = [],
}: MediaEmbedsSectionProps) {
  const seen = new Set<string>();

  for (const reference of excludedReferences) {
    const key = canonicalizeMediaReference(reference);
    if (key) seen.add(key);
  }

  const entries: Array<{
    key: "youtube" | "spotify" | "bandcamp";
    meta?: ReturnType<typeof getMediaEmbedIframeMeta>;
    fallbackHref?: string;
  }> = [];

  function pushDeduped(entry: {
    key: "youtube" | "spotify" | "bandcamp";
    meta?: ReturnType<typeof getMediaEmbedIframeMeta>;
    fallbackHref?: string;
  }) {
    const candidate =
      entry.meta?.src ?? entry.fallbackHref ?? null;
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
      // Unresolved YouTube handles/channels intentionally do not render as cards.
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
      // Unsupported Spotify URLs, such as user profiles, do not have native embeds.
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
      }
    } catch {
      // Plain Bandcamp artist pages do not expose a native iframe URL.
    }
  }

  if (entries.length === 0) return null;

  const hasEmbeds = entries.some(
    (entry) =>
      Boolean(entry.meta) ||
      Boolean(entry.key === "bandcamp" && entry.fallbackHref?.includes("bandcamp.com/EmbeddedPlayer"))
  );
  const showHeading = Boolean(
    heading &&
    heading.trim().length > 0 &&
    !(hideHeadingWhenOnlyEmbeds && hasEmbeds)
  );
  const showDescription = Boolean(description && showHeading);

  return (
    <section className={className}>
      {showHeading ? (
        <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-2">
          {heading}
        </h2>
      ) : null}
      {showDescription ? (
        <p className="mb-3 text-sm text-[var(--color-text-tertiary)]">{description}</p>
      ) : null}
      <div className="space-y-4">
        {entries.map((entry) => {
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

          if (!entry.meta) return null;

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
