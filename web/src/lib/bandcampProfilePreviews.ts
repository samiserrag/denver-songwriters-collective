import { canonicalizeMediaReference, getMusicProfileLinkMeta, type MusicProfileLinkMeta } from "@/lib/mediaEmbeds";

const BANDCAMP_REVALIDATE_SECONDS = 60 * 60 * 24;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }

  return null;
}

function isBandcampProfileUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "bandcamp.com" && !host.endsWith(".bandcamp.com")) return false;
    return !parsed.pathname.startsWith("/EmbeddedPlayer");
  } catch {
    return false;
  }
}

export async function resolveBandcampProfileLinkMeta(
  raw: string | null | undefined
): Promise<MusicProfileLinkMeta | null> {
  const baseMeta = getMusicProfileLinkMeta(raw);
  if (!baseMeta || baseMeta.provider !== "bandcamp" || !isBandcampProfileUrl(baseMeta.href)) {
    return baseMeta;
  }

  try {
    const response = await fetch(baseMeta.href, {
      next: { revalidate: BANDCAMP_REVALIDATE_SECONDS },
    });
    if (!response.ok) return baseMeta;

    const html = await response.text();
    const title = readMetaContent(html, "og:title");
    const image = readMetaContent(html, "og:image");
    const description = readMetaContent(html, "og:description");
    const dedupeKey = canonicalizeMediaReference(baseMeta.href) ?? baseMeta.dedupe_key;

    return {
      ...baseMeta,
      dedupe_key: dedupeKey.toLowerCase(),
      headline: title || baseMeta.headline,
      supportingText: description || baseMeta.supportingText,
      thumbnailUrl: image,
      ctaLabel: "Listen on Bandcamp",
    };
  } catch {
    return baseMeta;
  }
}
