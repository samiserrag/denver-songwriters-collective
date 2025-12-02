export function escapeHtml(unsafe?: string | null): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
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
  return escaped.replace(re, (m) => `<mark class="bg-teal-400/40 text-white px-1 rounded-sm">${m}</mark>`);
}
