export type EmbedTheme = "light" | "dark" | "auto";
export type EmbedView = "card" | "compact";
export type EmbedShowOption = "badges" | "meta" | "cta";

const DEFAULT_SHOW: EmbedShowOption[] = ["badges", "meta", "cta"];

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function parseTheme(value: string | null): EmbedTheme {
  if (value === "light" || value === "dark" || value === "auto") return value;
  return "auto";
}

export function parseView(value: string | null): EmbedView {
  return value === "compact" ? "compact" : "card";
}

export function parseShow(value: string | null): Set<EmbedShowOption> {
  if (!value) return new Set(DEFAULT_SHOW);
  const allowed = new Set<EmbedShowOption>(DEFAULT_SHOW);
  const parsed = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token): token is EmbedShowOption => allowed.has(token as EmbedShowOption));
  return new Set(parsed.length > 0 ? parsed : DEFAULT_SHOW);
}

export function formatDenverDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

interface EmbedPageArgs {
  title: string;
  body: string;
  status?: number;
  cacheControl?: string;
}

export function renderEmbedPage(args: EmbedPageArgs): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(args.title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #08122b;
      --bg-grad-top: #071128;
      --bg-grad-bottom: #0a1a45;
      --card-bg: #0d1b3d;
      --text: #e8ecf8;
      --muted: #b7c0d8;
      --accent: #f1cf67;
      --border: rgba(241, 207, 103, 0.32);
      --chip-bg: rgba(255, 255, 255, 0.08);
      --placeholder-bg: rgba(255, 255, 255, 0.08);
      --placeholder-text: #d7e0fa;
      --link: #f7d978;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif;
    }
    .wrap {
      min-height: 100vh;
      box-sizing: border-box;
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, var(--bg-grad-top) 0%, var(--bg-grad-bottom) 100%);
    }
    .wrap[data-theme="light"] {
      --bg: #f4f7ff;
      --bg-grad-top: #f4f7ff;
      --bg-grad-bottom: #ebf1ff;
      --card-bg: #ffffff;
      --text: #122048;
      --muted: #3b4b78;
      --accent: #f1cf67;
      --border: rgba(19, 35, 77, 0.2);
      --chip-bg: rgba(15, 31, 78, 0.06);
      --placeholder-bg: rgba(15, 31, 78, 0.08);
      --placeholder-text: #334579;
      --link: #223f9b;
    }
    .card {
      width: min(100%, 430px);
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      color: var(--text);
      overflow: hidden;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
    }
    .wrap[data-theme="light"] .card {
      box-shadow: 0 14px 35px rgba(12, 26, 62, 0.12);
    }
    .image-shell {
      width: 100%;
      aspect-ratio: 3 / 2;
      background: linear-gradient(180deg, rgba(8, 18, 43, 0.55), rgba(8, 18, 43, 0.85));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      box-sizing: border-box;
    }
    .image-shell img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: rgba(0, 0, 0, 0.14);
      border-radius: 12px;
    }
    .placeholder {
      width: 100%;
      height: 100%;
      border-radius: 12px;
      background: var(--placeholder-bg);
      color: var(--placeholder-text);
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 8px;
      box-sizing: border-box;
    }
    .body {
      padding: 14px;
    }
    .kicker {
      margin: 0 0 6px;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .title {
      margin: 0 0 8px;
      font-size: 1.28rem;
      line-height: 1.2;
      font-weight: 700;
    }
    .title-link {
      color: inherit;
      text-decoration: underline;
      text-decoration-color: rgba(255, 255, 255, 0.25);
      text-underline-offset: 2px;
    }
    .wrap[data-theme="light"] .title-link {
      text-decoration-color: rgba(18, 32, 72, 0.25);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 10px;
    }
    .chip {
      font-size: 0.8rem;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: var(--chip-bg);
      color: var(--text);
      white-space: nowrap;
    }
    .meta {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.4;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .summary {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.45;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 42px;
      box-sizing: border-box;
      border-radius: 12px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #111b3d;
      text-decoration: none;
      font-size: 0.96rem;
      font-weight: 700;
    }
    .sub-links {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 0.82rem;
    }
    .sub-links a {
      color: var(--link);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .hint {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.74rem;
      text-align: center;
    }
    .compact .body {
      padding: 11px;
    }
    .compact .title {
      font-size: 1.08rem;
      margin-bottom: 6px;
    }
    .compact .summary {
      margin-bottom: 8px;
      font-size: 0.86rem;
      line-height: 1.35;
    }
    .compact .chip {
      font-size: 0.74rem;
      padding: 3px 8px;
    }
    .compact .image-shell {
      aspect-ratio: 12 / 7;
      padding: 8px;
    }
    .compact .hint {
      margin-top: 8px;
    }
  </style>
</head>
<body>
${args.body}
</body>
</html>`;

  return new Response(html, {
    status: args.status ?? 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": args.cacheControl ?? "no-store",
    },
  });
}

export function renderStatusCard(
  title: string,
  message: string,
  status = 404
): Response {
  return renderEmbedPage({
    title,
    status,
    cacheControl: "no-store",
    body: `<div class="wrap" data-theme="auto"><article class="card"><div class="body"><h1 class="title">${escapeHtml(title)}</h1><p class="summary">${escapeHtml(message)}</p></div></article></div>`,
  });
}

interface RenderEmbedCardArgs {
  title: string;
  theme: EmbedTheme;
  view: EmbedView;
  imageUrl?: string | null;
  imageAlt: string;
  imagePlaceholder: string;
  kicker?: string | null;
  titleHref?: string | null;
  titleHrefExternal?: boolean;
  badges?: string[];
  meta?: string[];
  summary?: string | null;
  extraBodyHtml?: string;
  ctaHref?: string | null;
  ctaLabel?: string;
  extraLinks?: Array<{ label: string; href: string; external?: boolean }>;
}

export function renderEmbedCard(args: RenderEmbedCardArgs): string {
  const cardClass = args.view === "compact" ? "card compact" : "card";
  const badges = (args.badges ?? [])
    .filter(Boolean)
    .map((badge) => `<span class="chip">${escapeHtml(badge)}</span>`)
    .join("");
  const meta = (args.meta ?? []).filter(Boolean).join(" • ");
  const summary = args.summary ? escapeHtml(args.summary) : "";
  const safeTitle = escapeHtml(args.title);
  const title = args.titleHref
    ? `<a class="title-link" href="${escapeHtml(args.titleHref)}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>`
    : safeTitle;
  const imageHtml = args.imageUrl
    ? `<img src="${escapeHtml(args.imageUrl)}" alt="${escapeHtml(args.imageAlt)}" loading="lazy" />`
    : `<div class="placeholder">${escapeHtml(args.imagePlaceholder)}</div>`;
  const cta = args.ctaHref && args.ctaLabel
    ? `<a class="cta" href="${escapeHtml(args.ctaHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(args.ctaLabel)}</a>`
    : "";
  const links = (args.extraLinks ?? [])
    .filter((item) => item.label && item.href)
    .map((item) => `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`)
    .join("");
  const linksHtml = links ? `<div class="sub-links">${links}</div>` : "";

  return `<div class="wrap" data-theme="${args.theme}">
  <article class="${cardClass}">
    <div class="image-shell">${imageHtml}</div>
    <div class="body">
      ${args.kicker ? `<p class="kicker">${escapeHtml(args.kicker)}</p>` : ""}
      <h1 class="title">${title}</h1>
      ${badges ? `<div class="chips">${badges}</div>` : ""}
      ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}
      ${summary ? `<p class="summary">${summary}</p>` : ""}
      ${args.extraBodyHtml || ""}
      ${cta}
      ${linksHtml}
      <div class="hint">Powered by The Colorado Songwriters Collective</div>
    </div>
  </article>
</div>`;
}
