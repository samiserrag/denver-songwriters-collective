const DEFAULT_SITE_URL = "https://denversongwriterscollective.org";

function isLocalHost(raw: string): boolean {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(raw);
}

/**
 * Normalize a site URL-like value into an absolute origin.
 * - Adds https:// when protocol is missing (http:// for localhost)
 * - Strips paths/query/hash
 * - Falls back to the canonical production URL when invalid
 */
export function normalizeSiteUrl(rawValue?: string | null): string {
  const raw = (rawValue || "").trim();
  if (!raw) return DEFAULT_SITE_URL;

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : `${isLocalHost(raw) ? "http" : "https"}://${raw.replace(/^\/+/, "")}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/**
 * Resolve the canonical site URL from environment values.
 */
export function getSiteUrl(): string {
  return normalizeSiteUrl(
    process.env.PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL ||
      DEFAULT_SITE_URL
  );
}

