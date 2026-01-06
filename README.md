# The Denver Songwriters Collective

> Find your people. Find your stage. Find your songs.

Denver's community platform for songwriters. Discover open mics, showcases, song circles, and collaboration opportunities across the Front Range.

## Features

- **Happenings** — Scan-first event discovery with poster-forward cards. Answer "do I need to leave my house tonight?" at a glance.
  - Recurring events with multi-ordinal schedules (1st & 3rd Thursday, etc.)
  - 90-day rolling window occurrence expansion
  - Per-date cancellations and overrides without duplicating events
- **Open Mics** — Weekly recurring open mics sorted by day, with signup info and venue details
- **DSC Events** — Songwriter showcases, song circles, and special events curated by the collective
- **Member Directory** — Connect with local songwriters, hosts, and studios
- **Gallery** — Album-based photo galleries with threaded comments and owner moderation
- **Blog** — Community blog with threaded comments
- **Profile Comments** — Leave comments on songwriter and studio profiles
- **Map View** — See what's happening near you

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Supabase (Auth, Database, Edge Functions)
- Tailwind CSS v4
- TypeScript

## Development

```bash
cd web
npm install
npm run dev
```

## Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Repo operations (start here for agents) |
| [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) | Stop-gate workflow & shipping process |
| [docs/PRODUCT_NORTH_STAR.md](./docs/PRODUCT_NORTH_STAR.md) | Philosophy & UX laws |
| [docs/CONTRACTS.md](./docs/CONTRACTS.md) | Enforceable UI/data contracts |
| [docs/theme-system.md](./docs/theme-system.md) | Tokens & visual system |

## How This Repo Is Operated

This repository follows a **stop-gate workflow** where all non-trivial changes require:
1. Investigation with evidence (no speculation)
2. Risk/coupling/rollback critique
3. Explicit approval from Sami before execution

See [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) for the full protocol.

## Contributing

This is a community-curated directory. Help us keep listings accurate by submitting updates through the app.

## Changelog

### January 2026 — Phase 4.21

- **Occurrence Overrides for Recurring Events**
- Per-date cancellations and overrides without persisting occurrences
- Cancelled occurrences hidden by default with toggle to reveal
- Override flyer and notes take precedence when present
- 550+ tests passing

### January 2026 — Phase 4.30

- **Gallery + Comments Track CLOSED**
- Threaded comments (1-level nesting) on all comment surfaces
- Profile comments for songwriter and studio pages
- Owner moderation (hide/unhide) with audit trail
- Copy freeze tests to prevent gamification language

### December 2025 — Phase 4.17–4.20

- **Happenings Recurrence & UX Maturity**
- Canonical Denver timezone date logic for ordinal correctness
- 90-day rolling window occurrence expansion
- Multi-ordinal recurrence support (1st & 3rd, 2nd/4th)
- DateJumpControl with presets (Today, Tomorrow, This Weekend)
- StickyControls with collapsible date sections
- Gallery UX final lock (album publish/unpublish workflow)
- Bulk comment moderation with audit trail

### December 2025 — Phase 4.14–4.16

- Lint warnings eliminated (29 → 0)
- `next/image` conversions for public-facing avatars, thumbnails, HappeningCard
- Intentional `<img>` suppressions documented (ReactCrop, blob URLs, user uploads)

### December 2025 — Phase 4.7–4.9

- Scan-first, image-forward event cards (North Star v2.0 + aligned docs)
- Recurrence pill + day-of-week filter (URL param `days=...`)
- Missing data standardized to "NA"
- Contrast-safe pill/button foreground tokens; Sunrise theme contrast improved; Night unchanged

## License

MIT
