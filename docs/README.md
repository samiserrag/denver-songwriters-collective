# Documentation — The Colorado Songwriters Collective

> **For repo operations and recent changes, start with [CLAUDE.md](../CLAUDE.md)**

This directory contains canonical documentation for The Colorado Songwriters Collective platform.

## Canonical Documents

| Document | Purpose |
|----------|---------|
| [../AGENTS.md](../AGENTS.md) | Agent execution handbook (roles, tooling, browser validation expectations) |
| [BACKLOG.md](./BACKLOG.md) | **Active backlog** — All TODOs and feature tracking |
| [CONTRACTS.md](./CONTRACTS.md) | Enforceable UI/data contracts |
| [GOVERNANCE.md](./GOVERNANCE.md) | Stop-gate workflow and shipping process |
| [PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md) | Philosophy, UX laws, and design decisions |
| [SEEDING-CONTRACT.md](./SEEDING-CONTRACT.md) | Data seeding contract |
| [SMOKE-PROD.md](./SMOKE-PROD.md) | Production smoke test checklist |
| [copy-tone-guide.md](./copy-tone-guide.md) | Copy and tone guidelines |
| [known-issues.md](./known-issues.md) | Bug tracking (non-blocking issues) |
| [theme-system.md](./theme-system.md) | Design tokens and visual system |

## Reference Documentation

| Directory | Purpose |
|-----------|---------|
| [emails/](./emails/) | Email system documentation (inventory, style guide, SMTP setup) |
| [runbooks/](./runbooks/) | Operational runbooks for admin tasks |

## Archived Documentation

Historical and completed documentation is preserved in [`archived/`](./archived/):

- **investigations/** — Completed phase investigation documents
- **completed/** — Historical completed work and specs
- **future-specs/** — Long-term vision documents
- **ops/** — Historical ops scripts and notes
- **consultation/** — External consultation notes
- **deprecated/** — Documents superseded by canonical docs (preserved for history)
- **tests-legacy-schema/** — Archived legacy test files

## Document Hierarchy

When documents conflict, resolve using this priority:

1. `CLAUDE.md` — Wins on repo operations and workflow
2. `docs/GOVERNANCE.md` — Wins on shipping process and stop-gates
3. `docs/PRODUCT_NORTH_STAR.md` — Wins on philosophy and UX laws
4. `docs/CONTRACTS.md` — Wins on testable UI/data behavior
5. `docs/theme-system.md` — Wins on styling and tokens

## Adding New Documentation

- **Active backlog items** go in `BACKLOG.md`
- **Bug reports** go in `known-issues.md`
- **Phase investigations** go in `investigation/` during development, then move to `archived/investigations/` when complete
- **Operational runbooks** go in `runbooks/`

---

*Last updated: January 2026*
