# Post GTM-3.1 Active Backlog (Curated View)

> This file is an index, not a source of truth.
>
> Canonical backlog: [`docs/BACKLOG.md`](../BACKLOG.md)
>
> **STRAT-01 is a parallel long-term tract and does not block the active execution backlog.**

---

## Canonical Priority Queue

| Order | Canonical ID | Priority | Status | Canonical Entry | STOP-GATE / Contract |
|------|---------------|----------|--------|-----------------|----------------------|
| 1 | `UX-06` | P0 | DONE — implemented and merged | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/phase7b-side-tract-homepage-confirmed-mismatch-stopgate.md`](../investigation/phase7b-side-tract-homepage-confirmed-mismatch-stopgate.md) |
| 2 | `GROWTH-01` | P1 | PARTIAL DONE — 7B.1 shipped, 7B.2 deferred to separate STOP-GATE | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/phase7b-community-invite-growth-stopgate.md`](../investigation/phase7b-community-invite-growth-stopgate.md), [`docs/CONTRACTS.md`](../CONTRACTS.md) |
| 3 | `EMBED-01` | P2 | DONE — production validated | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/embed-01-external-embeds-stopgate.md`](../investigation/embed-01-external-embeds-stopgate.md) (Closeout §14) |
| 4 | `EMBED-02` | P2 | DONE — venues -> members -> blog -> gallery shipped with tests (`ed3ae28`) | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/embed-02-non-event-embeds-stopgate.md`](../investigation/embed-02-non-event-embeds-stopgate.md) |
| 5 | `STRAT-01` | P0 (Strategic) | OPEN — docs-only, execution deferred | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/strat-01-multi-region-whitelabel-stopgate.md`](../investigation/strat-01-multi-region-whitelabel-stopgate.md), [`docs/NORTH_STAR.md`](../NORTH_STAR.md) |

---

## Completed Cross-Surface Prerequisites (Still Canonical)

These are complete and remain tracked in canonical backlog for regression protection.

| Canonical ID | Status | Canonical Entry | Evidence |
|--------------|--------|-----------------|----------|
| `UX-07` | DONE | [`docs/BACKLOG.md`](../BACKLOG.md) | Phase 6 closeout + PR #118 |
| `UX-08` | DONE | [`docs/BACKLOG.md`](../BACKLOG.md) | Phase 6 mobile metadata/card wrap fixes |
| `UX-09` | DONE | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/CONTRACTS.md`](../CONTRACTS.md) cross-surface contract section |

---

## Next High Priority Tract Plan (Consolidated)

1. Continue invite/share tract as `GROWTH-01` (Phase 7B.2 only): managed invite email requires a separate STOP-GATE.
2. Keep `STRAT-01` in parallel as governance architecture only until phased execution approval.

---

## Scope Guardrails

- GTM-3.1 remains closed and must not be reopened by backlog drift.
- This file must not carry independent statuses that contradict `docs/BACKLOG.md`.
- Any new active tract is added to `docs/BACKLOG.md` first, then referenced here.
