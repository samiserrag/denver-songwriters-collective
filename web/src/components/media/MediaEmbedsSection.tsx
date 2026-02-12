import { getMediaEmbedIframeMeta, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";

interface MediaEmbedsSectionProps {
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
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
  heading = "Media",
  className,
}: MediaEmbedsSectionProps) {
  const entries: Array<{
    key: "youtube" | "spotify";
    meta?: ReturnType<typeof getMediaEmbedIframeMeta>;
    fallbackHref?: string;
  }> = [];

  if (youtubeUrl?.trim()) {
    try {
      const normalized = normalizeMediaEmbedUrl(youtubeUrl, { expectedProvider: "youtube" });
      if (normalized) {
        entries.push({
          key: "youtube",
          meta: getMediaEmbedIframeMeta(normalized.normalized_url),
        });
      }
    } catch {
      const fallbackHref = safeFallbackHref(youtubeUrl);
      if (fallbackHref) entries.push({ key: "youtube", fallbackHref });
    }
  }

  if (spotifyUrl?.trim()) {
    try {
      const normalized = normalizeMediaEmbedUrl(spotifyUrl, { expectedProvider: "spotify" });
      if (normalized) {
        entries.push({
          key: "spotify",
          meta: getMediaEmbedIframeMeta(normalized.normalized_url),
        });
      }
    } catch {
      const fallbackHref = safeFallbackHref(spotifyUrl);
      if (fallbackHref) entries.push({ key: "spotify", fallbackHref });
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
          if (!entry.meta) {
            return (
              <a
                key={`${entry.key}-fallback`}
                href={entry.fallbackHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[var(--color-link)] hover:underline"
              >
                Open {entry.key === "youtube" ? "YouTube" : "Spotify"}
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
