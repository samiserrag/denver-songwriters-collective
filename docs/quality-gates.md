# Quality Gates

## Baseline (December 16, 2025)

| Check | Status |
|-------|--------|
| Lint | 0 errors (81 warnings acceptable) |
| Tests | 267 passed |
| Typecheck | Clean |
| Build | Passes |

## Rules

### Before Merging

1. **`npm run lint`** — must have 0 errors
2. **`npm run test -- --run`** — no new failures
3. **`npm run build`** — must succeed

### Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | ≥85 |
| Accessibility | ≥90 |
| Best Practices | ≥90 |
| SEO | ≥95 |
| TBT (Total Blocking Time) | ≤100ms |
| CLS (Cumulative Layout Shift) | 0 |

### Warnings Policy

- **81 pre-existing warnings** are acceptable (unused vars, `<img>` vs `<Image>`)
- Do **not** increase warning count
- Fix incrementally in cleanup PRs

## Pre-Existing Known Issues

### Unused Variables (~30 files)

Warnings like:
```
'router' is assigned a value but never used
'error' is defined but never used
```

**Policy**: Low priority, fix opportunistically during related changes.

### `<img>` vs Next.js `<Image>` (~15 occurrences)

Warnings like:
```
Using `<img>` could result in slower LCP and higher bandwidth
```

**Files affected**:
- Admin forms (BlogPostForm, GalleryAdminTabs)
- Comment components (BlogComments, EventComments)
- Member/Performer cards
- Image upload previews

**Policy**: Convert to `next/image` when touching these files for other reasons.

### React Hooks Dependencies

```
React Hook useEffect has a missing dependency
React Hook useCallback has a missing dependency
```

**Policy**: Evaluate case-by-case. Some are intentional to prevent infinite loops.

## Verification Commands

```bash
# Full verification suite
cd web
npm run lint && npm run test -- --run && npm run build

# Quick lint check
npm run lint

# Type check only
npx tsc --noEmit

# Run tests with coverage
npm run test -- --run --coverage
```

## CI/CD Integration

Currently manual verification before merge. Future considerations:
- GitHub Actions workflow for PR checks
- Lighthouse CI for performance regression detection
- Automated deployment previews

## Test Coverage

### Current Test Files

| File | Tests |
|------|-------|
| `event-update-suggestions/page.test.tsx` | 4 tests |

### Mock Configuration

Tests use Vitest with React Testing Library. Supabase client is mocked:

```typescript
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));
```

## Performance Baselines

### Homepage

| Metric | Value |
|--------|-------|
| LCP | ~3.4s (synthetic) |
| CLS | 0 |
| TBT | 40-52ms |

### Gallery Page

| Metric | Value |
|--------|-------|
| LCP | ~3.7s (synthetic) |
| CLS | 0 |
| TBT | <50ms |

**Note**: LCP values are from Lighthouse synthetic testing with CPU throttling. Real-world performance is better.
