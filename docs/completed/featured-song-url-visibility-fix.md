# Featured Song URL Visibility Fix

Date: 2026-03-19

## Summary

Fixed a profile rendering gap where `featured_song_url` was saved from onboarding/dashboard, but not displayed on public profile pages.

## Root Cause

- Write path existed (`/api/profile`) and dashboard copy promised public visibility.
- Public profile pages (`/members/[id]`, `/songwriters/[id]`, `/performers/[id]`) only rendered `song_links`, not `featured_song_url`.

## What Shipped

1. Added shared helper for featured/additional song display behavior.
2. Public profile pages now render featured song first (prominent treatment).
3. Added de-duplication so featured song is not repeated in additional links.
4. Added focused tests for featured song display/de-duplication edge cases.

## Files

- `web/src/lib/profile/songLinks.ts`
- `web/src/__tests__/featured-song-links.test.ts`
- `web/src/app/members/[id]/page.tsx`
- `web/src/app/songwriters/[id]/page.tsx`
- `web/src/app/performers/[id]/page.tsx`

## Validation

- `npm run lint` (web): pass
- `npm run test -- --run` (web): pass
- `npm run build` (web): pass

## Email Status

- This fix does **not** send member emails automatically.
- A one-time local script (`send-featured-song-retroactive-email.js`) exists in a local backup branch only and is not part of `main`.
- If retroactive notice emails are needed, that script must be intentionally reviewed and run with explicit `--send`.
