# Known Issues (Non-Blocking)

## 1. Missing PWA Icon

- **File**: `public/icons/icon-192x192.png`
- **Error**: 404 on page load
- **Impact**: PWA manifest incomplete
- **Fix**: Add icon file to `public/icons/`
- **Priority**: Low

## 2. Button Contrast

- **Element**: `button.px-4.py-2.bg-[var(--color-accent-primary)]`
- **Issue**: Background/foreground contrast ratio insufficient for WCAG AA
- **Impact**: Accessibility score reduced
- **Fix**: Adjust `--color-accent-primary` or text color in theme presets
- **Priority**: Medium

## 3. Heading Order

- **Element**: `h4` used before `h2`/`h3`
- **Location**: Gallery page footer section
- **Impact**: Screen reader navigation affected
- **Fix**: Use proper heading hierarchy (`h1` → `h2` → `h3` → `h4`)
- **Priority**: Low

## 4. Missing Default OG Image

- **File**: `public/images/og-image.jpg`
- **Issue**: OpenGraph default image not created
- **Impact**: Social shares show no preview image when page-specific image missing
- **Fix**: Create 1200x630px image with DSC branding
- **Priority**: Medium

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

| Issue | User Impact | Effort | Priority |
|-------|-------------|--------|----------|
| PWA Icon | Low | Low | P3 |
| Button Contrast | Medium | Low | P2 |
| Heading Order | Low | Low | P3 |
| OG Image | Medium | Low | P2 |
| Unused Imports | None | Medium | P4 |
| Admin `<img>` | Low | Medium | P4 |

## Resolution Plan

All issues are non-blocking polish items. Address in a dedicated cleanup PR when:
- Feature development has a natural pause
- Accessibility audit is scheduled
- PWA support becomes a priority

**Current Status**: Not blocking v0.3.0 release or Stream 3 completion.
