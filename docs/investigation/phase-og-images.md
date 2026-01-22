# Investigation: OG Images for Social Link Previews

**Status:** COMPLETED
**Date:** January 2026
**Phase:** Implementation Complete

---

## Implementation Summary (January 2026)

### What Was Delivered

1. **Shared OG Card Helper** (`web/src/app/og/_shared/ogCard.tsx`)
   - DSC-branded card layout matching site card styling
   - Improved pill opacity (35% vs 20%) for better readability
   - Brighter text colors for contrast
   - Larger DSC logo (56px) + split wordmark ("Denver Songwriters" / "Collective" in gold)
   - Entity image panel (320x320) with shadow
   - Support for author info (blog posts)

2. **OG Routes Created/Updated**
   - `/og/songwriter/[id]` - Shows name, location, genres, role (Songwriter/Host/both)
   - `/og/event/[id]` - Shows title, date/time/venue, type, confirmed/cancelled status
   - `/og/venue/[id]` - Shows name, location, neighborhood
   - `/og/blog/[slug]` - Shows title, excerpt, author with avatar
   - `/og/gallery/[slug]` - **NEW** Shows album name, event/venue info

3. **Metadata Updated**
   - Gallery page now includes OG image URL pointing to `/og/gallery/[slug]`

### Quality Gates

| Check | Result |
|-------|--------|
| Lint | ✅ 0 warnings |
| Tests | ✅ 2358 passing (24 OG metadata tests) |
| Build | ✅ Success |
| Local Testing | ✅ All 5 routes return 200 with image/png |

### Design Decisions

| Decision | Implementation |
|----------|----------------|
| Pill backgrounds | 35% opacity (was 20%) for readability |
| Pill text colors | Brighter variants (#fcd34d gold, #6ee7b7 emerald, etc.) |
| DSC logo | 56px badge with "DSC" text |
| Wordmark | Split into two lines: "Denver Songwriters" (white) + "Collective" (gold) |
| Image panel | 320x320 with rounded corners and shadow |
| Kind badge | Top-right badge showing entity type (Songwriter, Event, Venue, Blog, Gallery)

### Facebook App ID

**Not found** in codebase. This is optional and only needed for Facebook-specific analytics.

---

## Original Investigation

---

## Executive Summary

This investigation confirms that implementing branded OG images for social link previews is feasible with the current stack. Next.js 16 includes `next/og` with `ImageResponse` for edge-rendered dynamic images. All required data fields are available in the database. No schema changes required.

---

## Phase 0A: Route Files Identified

| Page Type | Route File | Param Type |
|-----------|------------|------------|
| Events | `web/src/app/events/[id]/page.tsx` | UUID or slug |
| Songwriters | `web/src/app/songwriters/[id]/page.tsx` | UUID or slug |
| Venues | `web/src/app/venues/[id]/page.tsx` | UUID or slug |
| Blog | `web/src/app/blog/[slug]/page.tsx` | slug only |

**Note:** Open mics (`/open-mics/[slug]`) redirect to `/events/[id]`, so no separate OG route needed.

---

## Phase 0B: Data Loading Patterns

### Events (`events/[id]/page.tsx`)
```typescript
// Lines 71-81
const { data: event } = isUUID(id)
  ? await supabase.from("events").select("title, description, event_type, venue_name").eq("id", id).single()
  : await supabase.from("events").select("title, description, event_type, venue_name").eq("slug", id).single();
```
**Fields available:** `title`, `description`, `event_type`, `venue_name`, `cover_image_url`, `event_date`, `day_of_week`, `start_time`

### Songwriters (`songwriters/[id]/page.tsx`)
```typescript
// Lines 40-52
const { data: profile } = isUUID(id)
  ? await supabase.from("profiles").select("*").eq("id", id).or("is_songwriter.eq.true,is_host.eq.true,...").single()
  : await supabase.from("profiles").select("*").eq("slug", id).or("is_songwriter.eq.true,is_host.eq.true,...").single();
```
**Fields available:** `full_name`, `bio`, `avatar_url`, `city`, `state`, `genres`, `instruments`

**Note:** Songwriters page does NOT have `generateMetadata` currently — needs to be added.

### Venues (`venues/[id]/page.tsx`)
```typescript
// Lines 32-34
const { data: venue } = isUUID(id)
  ? await supabase.from("venues").select("name, city, state").eq("id", id).single()
  : await supabase.from("venues").select("name, city, state").eq("slug", id).single();
```
**Fields available:** `name`, `city`, `state`, `address`, `cover_image_url`, `neighborhood`

### Blog (`blog/[slug]/page.tsx`)
```typescript
// Lines 21-26
const { data: post } = await supabase
  .from("blog_posts")
  .select("title, excerpt, cover_image_url, author:profiles!blog_posts_author_id_fkey(full_name)")
  .eq("slug", slug).eq("is_published", true).single();
```
**Fields available:** `title`, `excerpt`, `cover_image_url`, `author.full_name`, `published_at`

---

## Phase 0C: Existing OG Metadata

### Current State

| Page | Has generateMetadata | Has OG tags | Has images |
|------|---------------------|-------------|------------|
| Events | ✅ Yes (line 64-111) | ✅ Yes | ❌ No |
| Songwriters | ❌ **No** | ❌ No | ❌ No |
| Venues | ✅ Yes (line 27-45) | ❌ Only title/description | ❌ No |
| Blog | ✅ Yes (line 17-75) | ✅ Yes | ✅ Static cover_image_url |
| Open Mics | ✅ Yes (line 17-71) | ✅ Yes | ❌ No |
| Gallery | ✅ Yes (line 18-42) | ✅ Yes | ❌ No |

### Base URL Pattern
```typescript
// From layout.tsx line 45
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://denver-songwriters-collective.vercel.app";

// From layout.tsx line 55
metadataBase: new URL(siteUrl),
```

### Default OG Image
```typescript
// From layout.tsx lines 89-96
images: [{
  url: "/images/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Denver Songwriters Collective - Find your people. Find your stage. Find your songs.",
}],
```

---

## Phase 0D: Image Source Fields

| Table | Image Field | Nullable | Notes |
|-------|-------------|----------|-------|
| `events` | `cover_image_url` | Yes | Event poster/flyer |
| `profiles` | `avatar_url` | Yes | User profile photo |
| `venues` | `cover_image_url` | Yes | Venue photo |
| `blog_posts` | `cover_image_url` | Yes | Blog cover image |

**Fallback Strategy:**
- If entity image is null → use `/images/og-image.jpg` (default branded image)
- Dynamic OG image will always render, but can incorporate entity image when available

---

## Phase 0E: Next.js Version & ImageResponse

### Confirmed
- **Next.js Version:** `^16.0.10` (from `package.json` line 25)
- **React Version:** `19.2.1`
- **`next/og` availability:** ✅ Available (built-in since Next.js 13.3)

### ImageResponse Runtime
- Runs on Edge Runtime (Vercel Edge Functions)
- Maximum execution time: 10 seconds (Vercel default)
- Maximum image size: 1200x630 recommended for OG images

### Available Fonts
Can use Google Fonts or load custom fonts via `fetch()` in the OG route.

---

## Branding Assets Available

| Asset | Path | Dimensions |
|-------|------|------------|
| Email logo | `/public/images/logo-email.png` | Unknown (need to verify) |
| Default OG | `/public/images/og-image.jpg` | 1200x630 |
| Hero image | `/public/images/hero.jpg` | Unknown |
| App icons | `/public/icons/icon-512x512.png` | 512x512 |

---

## Proposed OG Route Structure

```
web/src/app/og/
├── events/[slug]/route.tsx     → /og/events/open-mic-night
├── songwriters/[slug]/route.tsx → /og/songwriters/sami-serrag
├── venues/[slug]/route.tsx     → /og/venues/brewery-rickoli
├── blog/[slug]/route.tsx       → /og/blog/welcome-to-dsc
└── default/route.tsx           → /og/default (fallback)
```

---

## Implementation Plan (Pending Approval)

### Phase 1: Create OG Image Routes
1. Create `web/src/app/og/events/[slug]/route.tsx`
2. Create `web/src/app/og/songwriters/[slug]/route.tsx`
3. Create `web/src/app/og/venues/[slug]/route.tsx`
4. Create `web/src/app/og/blog/[slug]/route.tsx`
5. Create `web/src/app/og/default/route.tsx`

### Phase 2: Wire Metadata in Page Routes
1. Update `events/[id]/page.tsx` generateMetadata to include OG image URL
2. Add `generateMetadata` to `songwriters/[id]/page.tsx` (missing)
3. Update `venues/[id]/page.tsx` generateMetadata to include OG image
4. Update `blog/[slug]/page.tsx` generateMetadata (already has static image)

### Phase 3: Testing & Documentation
1. Add tests for OG route responses (valid image, correct content-type)
2. Add tests for metadata generation
3. Update SMOKE-PROD.md with OG image validation steps
4. Update CLAUDE.md with OG route locations

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Edge function cold starts | Slow first load | Pre-warm via cron or use ISR |
| Font loading failures | Broken image | Fallback to system fonts |
| Missing entity images | Less attractive preview | Use branded default design |
| Rate limiting on social crawlers | Blocked requests | Vercel handles this automatically |

---

## Questions for Approval

1. **Design:** Should the OG image include the DSC logo? Location preference?
2. **Colors:** Use existing theme tokens (`#d4a853` gold accent)?
3. **Typography:** Use Playfair Display (headline) + Inter (body) to match site?
4. **Entity images:** Include cover_image/avatar when available, or always use branded template?

---

## Files That Will Be Modified

| File | Change Type |
|------|-------------|
| `web/src/app/og/events/[slug]/route.tsx` | **NEW** |
| `web/src/app/og/songwriters/[slug]/route.tsx` | **NEW** |
| `web/src/app/og/venues/[slug]/route.tsx` | **NEW** |
| `web/src/app/og/blog/[slug]/route.tsx` | **NEW** |
| `web/src/app/og/default/route.tsx` | **NEW** |
| `web/src/app/events/[id]/page.tsx` | MODIFY (add OG image to metadata) |
| `web/src/app/songwriters/[id]/page.tsx` | MODIFY (add generateMetadata) |
| `web/src/app/venues/[id]/page.tsx` | MODIFY (add OG image to metadata) |
| `web/src/app/blog/[slug]/page.tsx` | MODIFY (update OG image to dynamic) |
| `docs/SMOKE-PROD.md` | MODIFY (add OG validation) |
| `CLAUDE.md` | MODIFY (add OG routes to key files) |

---

## STOP-GATE #1 Status

**Investigation complete. Awaiting Sami approval before any file changes.**

Per GOVERNANCE.md:
> The repo agent **STOPS** and waits. Only after Sami explicitly approves does execution begin.

---

**END — Investigation Phase 0**
