# Known Issues (Non-Blocking)

## 1. ~~Missing PWA Icon~~ ✅ RESOLVED

- **File**: `public/icons/icon-192x192.png`
- **Status**: File exists (19KB)
- **Resolved**: December 2025

## 2. ~~Button Contrast~~ ✅ RESOLVED

- **Issue**: `text-white` on accent backgrounds insufficient for WCAG AA
- **Fix**: Replaced with `text-[var(--color-text-on-accent)]` token in 4 files
- **Resolved**: Phase 4.11 (December 2025)

## 3. Heading Order

- **Element**: `h4` used before `h2`/`h3`
- **Location**: Gallery page footer section (not reproducible - needs exact location)
- **Impact**: Screen reader navigation affected
- **Fix**: Use proper heading hierarchy (`h1` → `h2` → `h3` → `h4`)
- **Priority**: Low
- **Status**: Cannot reproduce - no `h4` found in gallery directory

## 4. ~~Missing Default OG Image~~ ✅ RESOLVED

- **File**: `public/images/og-image.jpg`
- **Status**: File exists (151KB)
- **Resolved**: December 2025

## 5. Unused Imports Across Codebase

- **Count**: ~30 files with unused variable warnings
- **Examples**:
  - `'router' is assigned a value but never used`
  - `'HeroSection' is defined but never used`
- **Impact**: Lint warnings (not errors)
- **Fix**: Clean up imports incrementally
- **Priority**: Low

## 6. `<img>` Elements in Admin/Dashboard

- **Count**: ~15 occurrences
- **Files**: BlogPostForm, GalleryAdminTabs, CoHostManager, RSVPList
- **Issue**: Using native `<img>` instead of `next/image`
- **Impact**: Suboptimal image loading in admin areas
- **Fix**: Convert to `next/image` with proper sizing
- **Priority**: Low (admin-only pages)

## Priority Matrix

| Issue | User Impact | Effort | Priority | Status |
|-------|-------------|--------|----------|--------|
| PWA Icon | Low | Low | P3 | ✅ Resolved |
| Button Contrast | Medium | Low | P2 | ✅ Resolved |
| Heading Order | Low | Low | P3 | Cannot reproduce |
| OG Image | Medium | Low | P2 | ✅ Resolved |
| Unused Imports | None | Medium | P4 | Open |
| Admin `<img>` | Low | Medium | P4 | Open |

## Resolution Plan

Remaining issues are non-blocking polish items. Address in a dedicated cleanup PR when:
- Feature development has a natural pause
- Accessibility audit is scheduled

**Current Status**: 3 of 6 issues resolved in Phase 4.11.

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
