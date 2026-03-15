import { getSiteUrl } from "@/lib/siteUrl";

type WarmEventSharePreviewOptions = {
  eventIdentifier: string;
  updatedAt?: string | null;
};

/**
 * Build the OG image URL for an event with a deterministic version parameter.
 * The version tracks event.updated_at so social scrapers pick up updates.
 */
export function buildEventOgImageUrl(
  eventIdentifier: string,
  updatedAt?: string | null
): string {
  const siteUrl = getSiteUrl();
  const url = new URL(`/og/event/${eventIdentifier}`, siteUrl);
  const version = typeof updatedAt === "string" ? updatedAt.trim() : "";
  if (version) {
    url.searchParams.set("v", version);
  }
  return url.toString();
}

/**
 * Warm event page + OG image endpoints after create/update so social crawlers
 * are less likely to hit cold paths on first share.
 */
export async function warmEventSharePreview(
  options: WarmEventSharePreviewOptions
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  if (!options.eventIdentifier) return;

  const siteUrl = getSiteUrl();
  const eventUrl = new URL(`/events/${options.eventIdentifier}`, siteUrl).toString();
  const ogImageUrl = buildEventOgImageUrl(options.eventIdentifier, options.updatedAt);
  const init: RequestInit = {
    cache: "no-store",
    headers: {
      "user-agent": "CSC-Share-Warmup/1.0",
    },
  };

  await Promise.allSettled([fetch(eventUrl, init), fetch(ogImageUrl, init)]);
}

