import { getMediaEmbedIframeMeta, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";

interface EmbedRecord {
  id: string;
  url: string;
  provider: string;
  kind: string;
  position: number;
}

interface OrderedMediaEmbedsProps {
  embeds: EmbedRecord[];
  heading?: string | null;
  className?: string;
}

function safeFallbackHref(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getHostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

export function OrderedMediaEmbeds({
  embeds,
  heading = "Media",
  className,
}: OrderedMediaEmbedsProps) {
  if (!embeds || embeds.length === 0) return null;

  return (
    <section className={className}>
      {heading && heading.trim().length > 0 ? (
        <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
          {heading}
        </h2>
      ) : null}
      <div className="space-y-4">
        {embeds.map((embed) => {
          try {
            // Bandcamp: render sandboxed iframe from stored embed URL
            if (embed.provider === "bandcamp") {
              const href = safeFallbackHref(embed.url);
              if (href) {
                return (
                  <div
                    key={embed.id}
                    className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                  >
                    <iframe
                      src={href}
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
            }

            // YouTube or Spotify: render inline iframe
            if (embed.provider === "youtube" || embed.provider === "spotify") {
              const normalized = normalizeMediaEmbedUrl(embed.url);
              if (normalized) {
                const meta = getMediaEmbedIframeMeta(normalized.normalized_url);
                const isYouTube = meta.provider === "youtube";
                const spotifyHeight = meta.kind === "track" ? 152 : 352;

                return (
                  <div
                    key={embed.id}
                    className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                  >
                    {isYouTube ? (
                      <div className="relative w-full pt-[56.25%]">
                        <iframe
                          src={meta.src}
                          title={meta.title}
                          loading="lazy"
                          allow={meta.allow}
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="absolute inset-0 h-full w-full border-0"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={meta.src}
                        title={meta.title}
                        loading="lazy"
                        allow={meta.allow}
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="block w-full border-0"
                        height={spotifyHeight}
                      />
                    )}
                  </div>
                );
              }
            }

            // External or fallback: render safe outbound card
            const href = safeFallbackHref(embed.url);
            if (!href) return null;

            return (
              <a
                key={embed.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-accent)]/50 transition-colors group"
              >
                <svg
                  className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-accent)] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] truncate">
                  {getHostnameLabel(embed.url)}
                </span>
              </a>
            );
          } catch {
            // Per-row resilience: one malformed embed never blocks others
            return null;
          }
        })}
      </div>
    </section>
  );
}
