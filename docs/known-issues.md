# Known Issues (Non-Blocking)

> **Policy:** Issues become "Guarded" only when a regression test exists that would catch reintroduction. Otherwise, issues remain "Known Issue" until fixed and guarded.

See [docs/GOVERNANCE.md](./GOVERNANCE.md) for the stop-gate workflow and quality gates.

---

## Issue Format

When adding new issues, use this format:

```markdown
### X. Issue Title

- **Symptoms:** What the user sees / what fails
- **Root Cause:** Why this happens (if known), or "UNKNOWN" with next investigation step
- **Mitigation:** Current workaround (if any)
- **Guard Test:** Test file that prevents regression (if exists)
- **Status:** Known Issue | Guarded | Resolved
- **Priority:** P1 (fix now) | P2 (fix soon) | P3 (nice to fix) | P4 (low priority)
```

---

## Resolved / Guarded (Phase 4.30 — Gallery + Comments Track)

> **Track Closed: 2026-01-01**

These issues have been resolved and are now guarded by regression tests to prevent reintroduction.

### 8. Gallery Visibility Query Mismatch ✅ RESOLVED

- **Issue:** Album detail page used `is_approved=true` while gallery listing used `is_published/is_hidden`
- **Impact:** New albums showed empty on detail page until manually approved
- **Fix:** Unified queries to use `is_published=true AND is_hidden=false`
- **Guard:** `gallery-album-management.test.ts` tests query consistency
- **Resolved:** Phase 4.20 (December 2025)

### 9. Gamification Language in Gallery UI ✅ GUARDED

- **Risk:** UI could introduce "most commented", "trending", or popularity-based language
- **Fix:** Copy freeze tests prevent approval/metrics/urgency language in user-facing copy
- **Guard:** `gallery-copy-freeze.test.ts` (39+ pattern tests)
- **Status:** Permanently guarded by test suite

### 10. Comment Threading Inconsistency ✅ RESOLVED

- **Issue:** Blog comments had threading but gallery/profile comments did not
- **Fix:** Added `parent_id` to all comment tables; shared `CommentThread` component
- **Guard:** `threaded-comments.test.ts` enforces threading behavior
- **Resolved:** Phase 4.30 (January 2026)

### 11. Profile Comments Missing ✅ RESOLVED

- **Issue:** Songwriter and studio profiles had no comment support
- **Fix:** Created `profile_comments` table with RLS; `ProfileComments` component
- **Guard:** `threaded-comments.test.ts` tests ProfileComments integration
- **Resolved:** Phase 4.30 (January 2026)

### 12. Per-Date Cancellations/Overrides ✅ RESOLVED

- **Issue:** No way to cancel or customize individual occurrences of recurring events
- **Fix:** Per-occurrence override system via `occurrence_overrides` table
- **Guard:** `occurrence-overrides.test.ts` (17 tests)
- **Resolved:** Phase 4.21 (January 2026)

### 13. Event Ownership Claiming ✅ RESOLVED

- **Issue:** Unclaimed events (host_id IS NULL) had no path for users to claim ownership
- **Fix:** Event claims system with `event_claims` table, user claim button, admin review queue
- **Guard:** `event-claims.test.ts` (13 tests)
- **Resolved:** Phase 4.22 (January 2026)

### 14. Deleted Venues Still Visible on Public Pages ✅ RESOLVED

- **Symptoms:** Admin-deleted venues continued appearing on `/venues` list and detail pages
- **Root Cause:** Two issues: (1) DELETE endpoint returned success even when zero rows deleted (Supabase behavior), (2) Vercel Data Cache potentially caching Supabase responses despite `dynamic="force-dynamic"`
- **Fix:** Hardened DELETE endpoint with pre/post delete verification, added `fetchCache="force-no-store"` to venue pages and search API
- **Guard:** `venue-delete-visibility.test.ts` (18 tests)
- **Resolved:** January 2026

---

## 1. ~~Missing PWA Icon~~ ✅ RESOLVED

- **File**: `public/icons/icon-192x192.png`
- **Status**: File exists (19KB)
- **Resolved**: December 2025

## 2. ~~Button Contrast~~ ✅ RESOLVED

- **Issue**: `text-white` on accent backgrounds insufficient for WCAG AA
- **Fix**: Replaced with `text-[var(--color-text-on-accent)]` token in 4 files
- **Resolved**: Phase 4.11 (December 2025)

## 3. Heading Order (Footer)

- **Element**: `h4` used in footer section labels
- **Location**: `components/navigation/footer.tsx` (shared across all pages)
- **Details**: Footer uses `<h4>` for link group labels ("Discover", "Community", "Stay Connected")
- **Impact**: Minor — footer headings don't affect main content hierarchy
- **Status**: Accepted (footer section labels are decorative, not document headings)
- **Priority**: Low (P4)

## 4. ~~Missing Default OG Image~~ ✅ RESOLVED

- **File**: `public/images/og-image.jpg`
- **Status**: File exists (151KB)
- **Resolved**: December 2025

## 5. ~~Unused Imports Across Codebase~~ ✅ RESOLVED

- **Original count**: ~30 files with unused variable warnings
- **Fix**: Suppressed with eslint-disable comments (8 files in Phase 4.12 batch 1)
- **Resolved**: Phase 4.12 (December 2025)

## 6. ~~`<img>` Elements in Admin/Dashboard~~ ✅ RESOLVED

- **Original count**: ~15 occurrences in admin areas
- **Files fixed**: BlogPostForm, CoHostManager, RSVPList
- **Fix**: Converted to `next/image` with explicit width/height
- **Resolved**: Phase 4.12 (December 2025)

## Priority Matrix

| Issue | User Impact | Effort | Priority | Status |
|-------|-------------|--------|----------|--------|
| PWA Icon | Low | Low | P3 | ✅ Resolved |
| Button Contrast | Medium | Low | P2 | ✅ Resolved |
| Heading Order | Low | Low | P4 | Accepted |
| OG Image | Medium | Low | P2 | ✅ Resolved |
| Unused Imports | None | Medium | P4 | ✅ Resolved |
| Admin `<img>` | Low | Medium | P4 | ✅ Resolved |
| Lint Warnings | None | Medium | P4 | ✅ Resolved |
| Venue Delete Visibility | High | Low | P0 | ✅ Resolved |

## 7. ~~Lint Warnings (no-img-element, unused vars)~~ ✅ RESOLVED

- **Original count**: 29 warnings after Phase 4.12
- **Fix**: Phase 4.14–4.16 systematic cleanup
  - Converted public-facing `<img>` to `next/image` (avatars, thumbnails, HappeningCard)
  - Added documented eslint suppressions for intentional `<img>` usage (ReactCrop, blob URLs, user uploads)
- **Final count**: 0 warnings
- **Resolved**: Phase 4.16 (December 2025)

## Resolution Plan

All issues resolved or accepted. **Lint warnings: 0**. **Tests: 2241 passing**.

**Current Status**: 13 of 14 issues resolved; 1 accepted (footer heading order is decorative).

**Phase 4.30 Track:** Gallery + Comments — CLOSED (January 2026)
**Phase 4.21 Track:** Occurrence Overrides — COMPLETE (January 2026)
**Phase 4.22 Track:** Editing + Ownership UX — COMPLETE (January 2026)
**Phase 4.32 Track:** Trust-Based Content Model — COMPLETE (January 2026)

---

## Future Roadmap

These are broader product initiatives for post-launch development. See CLAUDE.md for detailed tracking.

### Community Growth (Onboarding, Discovery, Retention)
- Improved onboarding flow with guided tours
- Member discovery features (search, filters, recommendations)
- Engagement features (activity feeds, notifications, achievements)
- Retention mechanics (streaks, milestones, community badges)

### Host / Venue UX Improvements
- Simplified event creation for recurring open mics
- Venue dashboard with analytics
- Host tools for managing regulars and slot preferences
- Venue claim and verification workflow

### Event Lifecycle Polish (Before / During / After)
- Pre-event: reminder emails, calendar sync improvements
- During event: live check-in, real-time lineup updates
- Post-event: feedback collection, photo uploads, recaps

### Analytics & Feedback Loops
- Event attendance tracking and trends
- Community health metrics dashboard
- User feedback collection and analysis
- Performance metrics for hosts/venues

### Mobile-First Refinements
- Touch-optimized interactions
- Offline support for key features
- Push notifications
- Native app (React Native/Expo)

### Content Strategy
- Editorial calendar for blog/community content
- User-generated content guidelines
- Community spotlight automation
- Newsletter content planning
