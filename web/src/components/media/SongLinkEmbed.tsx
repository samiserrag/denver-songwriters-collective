import type { SongLinkEmbedMeta } from "@/lib/profile/songLinks";

interface SongLinkEmbedProps {
  embed: SongLinkEmbedMeta;
}

export function SongLinkEmbed({ embed }: SongLinkEmbedProps) {
  if (embed.provider === "bandcamp") {
    return (
      <div className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
        <iframe
          src={embed.src}
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

  if (embed.provider === "reverbnation") {
    return (
      <div className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
        <iframe
          src={embed.src}
          title={embed.title}
          loading="lazy"
          sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          className="block w-full border-0"
          height={embed.height}
        />
      </div>
    );
  }

  if (embed.provider === "youtube") {
    return (
      <div className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
        <div className="relative w-full pt-[56.25%]">
          <iframe
            src={embed.iframe.src}
            title={embed.iframe.title}
            loading="lazy"
            allow={embed.iframe.allow}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  const spotifyHeight = embed.iframe.kind === "track" ? 152 : 352;
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
      <iframe
        src={embed.iframe.src}
        title={embed.iframe.title}
        loading="lazy"
        allow={embed.iframe.allow}
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full border-0"
        height={spotifyHeight}
      />
    </div>
  );
}
