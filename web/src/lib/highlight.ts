export function escapeHtml(unsafe?: string | null): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * linkifyUrls
 * - Converts URLs in text to clickable anchor tags
 * - Should be called on already-escaped HTML text
 * - URLs become clickable links that open in new tabs
 */
export function linkifyUrls(escapedText: string): string {
  // Match URLs (http, https) - works on already-escaped HTML
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  return escapedText.replace(urlRegex, (url) => {
    // Truncate display URL if too long
    const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[var(--color-text-accent)] hover:text-[var(--color-gold-400)] underline break-all">${displayUrl}</a>`;
  });
}

/**
 * highlight
 * - Returns an HTML string where occurrences of `query` in `text` are wrapped
 *   with a <mark> element (styled via Tailwind classes).
 * - Case-insensitive.
 * - Escapes HTML in the original text before wrapping.
 * - If query is empty or whitespace, returns escaped text unchanged.
 */
export function highlight(text?: string | null, query?: string | null): string {
  const raw = text ?? '';
  const escaped = escapeHtml(raw);
  const q = (query ?? '').trim();
  if (!q) return escaped;

  // Escape special regex chars in the query
  const escapedQuery = q.replace(/[.*+?^${}()|[\\\]\\]/g, '\\$&');

  // Create a case-insensitive global regex
  const re = new RegExp(escapedQuery, 'ig');

  // Wrap matched (escaped) text in a <mark> for highlighting.
  return escaped.replace(re, (m) => `<mark class="bg-[var(--color-accent-primary)]/40 text-[var(--color-text-on-accent)] px-1 rounded-sm">${m}</mark>`);
}
