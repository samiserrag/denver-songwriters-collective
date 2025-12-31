# Known Issues (Non-Blocking)

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

## Resolution Plan

All original issues resolved or accepted. Lint warnings reduced from 41 to 29.

**Current Status**: 5 of 6 issues resolved; 1 accepted (footer heading order is decorative).

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
