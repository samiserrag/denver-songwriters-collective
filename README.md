# The Denver Songwriters Collective

> Find your people. Find your stage. Find your songs.

Denver's community platform for songwriters. Discover open mics, showcases, song circles, and collaboration opportunities across the Front Range.

## Features

- **Happenings** — Scan-first event discovery with poster-forward cards. Answer "do I need to leave my house tonight?" at a glance.
- **Open Mics** — Weekly recurring open mics sorted by day, with signup info and venue details
- **DSC Events** — Songwriter showcases, song circles, and special events curated by the collective
- **Member Directory** — Connect with local songwriters, hosts, and studios
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
| [docs/PRODUCT_NORTH_STAR.md](./docs/PRODUCT_NORTH_STAR.md) | Philosophy & UX laws |
| [docs/CONTRACTS.md](./docs/CONTRACTS.md) | Enforceable UI/data contracts |
| [docs/theme-system.md](./docs/theme-system.md) | Tokens & visual system |

## Contributing

This is a community-curated directory. Help us keep listings accurate by submitting updates through the app.

## Changelog

### December 2025 — Phase 4.7–4.9

- Scan-first, image-forward event cards (North Star v2.0 + aligned docs)
- Recurrence pill + day-of-week filter (URL param `days=...`)
- Missing data standardized to "NA"
- Contrast-safe pill/button foreground tokens; Sunrise theme contrast improved; Night unchanged

## License

MIT
