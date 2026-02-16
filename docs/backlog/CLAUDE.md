# Docs Memory: Backlog and Future Tracks

This file holds deferred and future items that were previously under the root `CLAUDE.md`.

## Deferred Backlog

See full backlog in `docs/completed/CLAUDE.md` or `docs/known-issues.md`.

### P0 (Critical)
- None currently identified

### P1 (Fix Soon)
- API rate limiting missing
- Empty `alt=""` on user avatars (9 occurrences across 7 components) — accessibility concern

### P2 (Nice to Fix)
- ~~**Login redirect loses `?emailPrefs=1` deep link**~~ — RESOLVED: The proxy at `web/src/proxy.ts` already preserves full URL (path + search params) through login redirects via `?redirectTo=` param. Added test coverage confirming end-to-end preservation.
- Typography token docs drift
- Loading.tsx coverage gaps
- Duplicate VenueSelector components
- **/host page redesign** — Current page has unclear value proposition and lacks visual proof of product capability. Needs: screenshot walkthrough of host dashboard, "Who is this for?" section, concrete host use cases (lineup management, attendance tracking), feature breakdown with before/after, short demo video embed, social proof / quotes from existing hosts, CTA refinement, connection to /get-involved and hosting dashboard. See STOP-GATE B backlog note (February 2026).
- ~~53 unnecessary `as any` casts in profile page~~ — RESOLVED

### Known UX Follow-ups (All Resolved)
- ~~**A) City always visible on timeline cards + series rows**~~ — Fixed in Phase 5.04/5.06 (`getVenueCityState()` helper)
- ~~**B) "Signup time" field restored on create/edit forms everywhere**~~ — Fixed in Phase 5.04 (EventForm includes `signup_time`)
- ~~**C) Venue Google Maps + Get Directions links shown on event occurrences**~~ — Fixed in Phase 5.06/5.07 (override venue support)

### Future: Phase 4.38 — Hard Delete Admin Tools
**Investigation completed in:** `docs/investigation/phase4-37-seeded-verification-status-system.md` (Section 6)

Event hard delete is safe—all FKs use CASCADE or SET NULL:
- `event_rsvps`, `event_timeslots`, `timeslot_claims`, `occurrence_overrides`, `event_claims`, `event_update_suggestions`, `change_reports`, `favorites`, `event_hosts`, `event_comments`, `guest_verifications` — CASCADE
- `gallery_albums`, `monthly_highlights` — SET NULL (orphans album / removes highlight)

Venue hard delete requires check:
- Before delete: Check for events referencing `venue_id`
- If events exist: Block delete or cascade-nullify `venue_id`
- Add admin confirmation: "X events reference this venue"

---
