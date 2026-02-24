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
| 1 | `EVENTS-PRIVATE-01` | P0 | DONE — PR1–PR6 shipped (commit `ecc43353`): schema + RLS, invite management, read-surface hardening, member+token accept, CI guardrails | [`docs/BACKLOG.md`](../BACKLOG.md) | Investigation: [`docs/investigation/private-invite-only-events-stopgate.md`](../investigation/private-invite-only-events-stopgate.md) |
| 2 | `HARDEN-01` | P0 | OPEN — gallery RLS/storage contract formalization + negative privilege tests | [`docs/BACKLOG.md`](../BACKLOG.md) | Contract alignment: [`docs/CONTRACTS.md`](../CONTRACTS.md), security baseline: [`SECURITY.md`](../../SECURITY.md) |
| 3 | `UX-10` | P0 | DONE — canonical parity restored, error states added (`da131a0`, `90c9de4`, `9851a16`) | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/ux-blog-gallery-visibility-parity-stopgate.md`](../investigation/ux-blog-gallery-visibility-parity-stopgate.md) |
| 4 | `UX-11` | P0 | DONE — recurring slug redirect markers removed (`90c9de4`, `9851a16`) | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/ux-facebook-sharing-stopgate.md`](../investigation/ux-facebook-sharing-stopgate.md) |
| 5 | `UX-06` | P0 | DONE — implemented and merged | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/phase7b-side-tract-homepage-confirmed-mismatch-stopgate.md`](../investigation/phase7b-side-tract-homepage-confirmed-mismatch-stopgate.md) |
| 6 | `GROWTH-01` | P1 | PARTIAL DONE — 7B.1 shipped, 7B.2 deferred to separate STOP-GATE | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/phase7b-community-invite-growth-stopgate.md`](../investigation/phase7b-community-invite-growth-stopgate.md), [`docs/CONTRACTS.md`](../CONTRACTS.md) |
| 7 | `EMBED-01` | P2 | DONE — production validated | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/embed-01-external-embeds-stopgate.md`](../investigation/embed-01-external-embeds-stopgate.md) (Closeout §14) |
| 8 | `EMBED-02` | P2 | DONE — venues -> members -> blog -> gallery shipped with tests (`ed3ae28`) | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/embed-02-non-event-embeds-stopgate.md`](../investigation/embed-02-non-event-embeds-stopgate.md) |
| 9 | `STRAT-01` | P0 (Strategic) | OPEN — docs-only, execution deferred | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/strat-01-multi-region-whitelabel-stopgate.md`](../investigation/strat-01-multi-region-whitelabel-stopgate.md), [`docs/NORTH_STAR.md`](../NORTH_STAR.md) |
| 10 | `MEDIA-EMBED-01` | P1 | DONE — `MEDIA-EMBED-01A` shipped (`514c085`), `01B` superseded by `02` | [`docs/BACKLOG.md`](../BACKLOG.md) | [`docs/investigation/media-embed-01-structured-urls-stopgate.md`](../investigation/media-embed-01-structured-urls-stopgate.md) |
| 11 | `MEDIA-EMBED-02` | P1 | DONE — Foundation (`b849513`), `02B` events/blog/gallery (`cec7d64`), `02C` Bandcamp fixes, `02D` venues + UX (`36c3720`), `02E` profile-card fallback + explicit import (`8304e10a`, `93139183`, `392bcb49`) | [`docs/BACKLOG.md`](../BACKLOG.md) | — |

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

1. ~~Start `EVENTS-PRIVATE-01` STOP-GATE investigation~~ — **DONE** (PR1–PR6 shipped, commit `ecc43353`)
2. Execute `HARDEN-01` as the immediate security tract: gallery RLS/storage permission matrix + negative privilege tests.
3. Continue invite/share tract as `GROWTH-01` (Phase 7B.2 only): managed invite email requires a separate STOP-GATE.
4. Keep `STRAT-01` in parallel as governance architecture only until phased execution approval.
5. Keep `UX-10`, `UX-11`, `MEDIA-EMBED-01A`, and `MEDIA-EMBED-02` through `02D` under regression watch with their tests.

---

## Scope Guardrails

- GTM-3.1 remains closed and must not be reopened by backlog drift.
- This file must not carry independent statuses that contradict `docs/BACKLOG.md`.
- Any new active tract is added to `docs/BACKLOG.md` first, then referenced here.
