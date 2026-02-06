# STOP-GATE Investigation — GTM-3.1 Weekly Happenings Featured Ordering + Intro Formatting

**Status:** Investigation (Step A) + Critique (Step B)
**Date:** 2026-02-06
**Owner:** Repo agent

## Problem Statement
Weekly Happenings Digest email must render all featured editorial items at the top in this exact order, each as a baseball card:
1) Featured Member
2) Featured Event (featured happening)
3) Featured Blog
4) Featured Gallery

Additionally, Intro Note must preserve admin-entered formatting (paragraph breaks and line breaks).

Constraints: No DB schema changes, no payload/validation changes, no cron changes. Must affect Preview + Send Test equally (same template path).

---

## Evidence (Step A)

### 1) Template insertion order puts featured events at top, but all spotlights after events
**File:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/email/templates/weeklyHappeningsDigest.ts`

**Current HTML order (excerpt):**
```ts
const introNoteHtml = editorial?.introNote
  ? formatIntroNoteHtml(editorial.introNote)
  : "";

const featuredHtml = editorial?.featuredHappenings?.length
  ? formatFeaturedHappeningsHtml(editorial.featuredHappenings)
  : "";

let spotlightsHtml = "";
if (editorial?.memberSpotlight) {
  spotlightsHtml += formatMemberSpotlightHtml(editorial.memberSpotlight);
}
if (editorial?.venueSpotlight) {
  spotlightsHtml += formatVenueSpotlightHtml(editorial.venueSpotlight);
}
if (editorial?.blogFeature) {
  spotlightsHtml += formatBlogFeatureHtml(editorial.blogFeature);
}
if (editorial?.galleryFeature) {
  spotlightsHtml += formatGalleryFeatureHtml(editorial.galleryFeature);
}

const htmlContent = `
  ...
  ${introNoteHtml ? `<table>...</table>` : ""}
  ${featuredHtml ? `<table>...</table>` : ""}
  <table> ${eventsHtml} </table>
  ${summaryLine ? `...` : ""}
  ${spotlightsHtml ? `<table>...</table>` : ""}
  ...
`;
```
**Implication:** Member/Blog/Gallery are rendered after the main events list + summary, not at the top. Featured happenings (events) are the only editorial block at top. This explains why the member spotlight appears at the end and why blog/gallery aren’t in the top featured block.

### 2) Blog/Gallery HTML uses baseball cards, but only in the “spotlights” block
**File:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/email/templates/weeklyHappeningsDigest.ts`

```ts
function formatBlogFeatureHtml(feature) {
  return `...${renderEmailBaseballCard({ title: feature.title, ... })}`;
}

function formatGalleryFeatureHtml(feature) {
  return `...${renderEmailBaseballCard({ coverUrl: feature.coverUrl, ... })}`;
}
```
**Implication:** Blog/Gallery *do* use baseball cards, but only inside `spotlightsHtml`. If the user sees a “link-only” version, it’s likely the **text** version (`formatBlogFeatureText`) or because the HTML block is placed after the main list (easy to miss), not because the renderer lacks card support.

### 3) Baseball card renderer supports cover + title + subtitle, no forced crop
**File:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/email/render.ts`

```ts
export function renderEmailBaseballCard(opts) {
  const coverHtml = opts.coverUrl
    ? `<img ... style="width: 100%; height: auto; ..." />`
    : "";
  ...
}
```
**Implication:** Cards are already “letterbox” (`height: auto`), not cropped. We must keep this renderer as-is and only re-order usage.

### 4) Resolver returns all editorial objects expected by template
**File:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/digest/digestEditorial.ts`

Relevant resolved output:
- `resolved.memberSpotlight` (profiles)
- `resolved.featuredHappenings` (events)
- `resolved.blogFeature` (blog_posts)
- `resolved.galleryFeature` (gallery_albums, published only)

**Key constraint:** Gallery/blog are only present if `is_published = true` and slug resolves. If not published or slug mismatch, they will be omitted (and appear “missing”).

### 5) Intro note formatting currently collapses newlines
**File:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/email/templates/weeklyHappeningsDigest.ts`

```ts
function formatIntroNoteHtml(introNote: string): string {
  return `...<p> ${escapeHtml(introNote)} </p>...`;
}
```
**Implication:** HTML whitespace/newlines are collapsed in a single `<p>` — paragraph breaks and line breaks are lost.

### 6) Preview and Send Test use same template
Preview: `/app/api/admin/digest/preview/route.ts` uses `getWeeklyHappeningsDigestEmail`.
Send Test: `/app/api/admin/digest/send/route.ts` also uses `getWeeklyHappeningsDigestEmail`.
**Implication:** Fixes in the template apply to both Preview and Send Test.

---

## Root Cause Summary

a) **Member appears at end** — Member spotlight is appended in `spotlightsHtml` after the main events list and summary line, not in a top featured block.

b) **Blog renders as link** — Blog HTML uses baseball cards, but only inside the late “spotlights” block; the plain-text version is link-only. If a client falls back to text or user scans only top, it appears as a link.

c) **Gallery missing** — Gallery is only rendered if `editorial.galleryFeature` resolves. Resolver filters on `is_published = true`, so unpublished or mismatched slugs yield no gallery card. Additionally, it’s rendered after the main list (easy to miss).

d) **Intro note collapses formatting** — Intro HTML just escapes and inserts the full string into a single `<p>`, so newlines/paragraphs are lost.

---

## Proposed Fix Plan (Step B — Minimal, Rendering-Only)

### A) Featured ordering block at top
- Create a single **Featured** block rendered **above** the normal happenings list.
- Order must be:
  1. Featured Member
  2. Featured Event (use the first item from `featuredHappenings`)
  3. Featured Blog
  4. Featured Gallery
- Use existing `renderEmailBaseballCard` for each item.
- If multiple featured happenings exist, keep the rest in the existing featured section or document any change; but the first featured event must appear in the top featured block.

### B) Intro note formatting preservation (XSS-safe)
- Introduce helper (e.g., `formatEditorialTextForEmail`) that:
  - Escapes HTML first
  - Splits on blank lines into paragraphs
  - Converts single newlines to `<br>`
  - Wraps paragraphs in `<p>` with consistent spacing
- Text version should preserve raw newlines as-is.

### C) Keep Preview/Send Test in sync
- No route changes needed; both already use the same template. Changes are confined to the template helper and order composition.

---

## Safety / XSS Plan
- Escape text first, then transform newlines into `<br>` and paragraphs. This keeps formatting while remaining safe.

---

## Test Plan (for execution phase)
1) **Ordering test**: With all four editorial items present, verify HTML order by checking index positions for member card, featured event card, blog card, gallery card.
2) **Blog/Gallery card check**: Assert card HTML structure exists (table wrapper + CTA), not just links.
3) **Intro note formatting**: Provide intro with paragraph + line breaks and assert HTML contains `<p>` and `<br>` in correct places.
4) **Regression**: If only featured event exists, it still renders correctly in featured block.

---

## Rollback Plan
- Revert template changes in `weeklyHappeningsDigest.ts` and restore previous order/intro handling.
- No DB changes, so rollback is a simple code revert.

---

## Awaiting Approval
Execution will not begin until Sami explicitly approves in chat.
