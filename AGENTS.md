# Agent Operations Guide

This file is the operational handbook for AI/code agents working in this repository.

## Canonical Authority

1. [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) - stop-gates, approval, and shipping rules (authoritative)
2. [CLAUDE.md](./CLAUDE.md) - repo workflow details, active context, and implementation boundaries
3. [docs/CONTRACTS.md](./docs/CONTRACTS.md) and [docs/PRODUCT_NORTH_STAR.md](./docs/PRODUCT_NORTH_STAR.md) - product/data behavior and UX rules

When there is conflict, follow the higher-priority document.

## Roles

Use the role model defined in [docs/GOVERNANCE.md](./docs/GOVERNANCE.md):

- Sami: product owner and final approver
- Coordinator: scope and execution prompt authority
- Repo Executor: implementation, investigation support, and delivery

Agents must respect stop-gates and explicit approval requirements for non-trivial execution.

## Required Workflow

For non-trivial work:

1. Investigate with evidence (paths, migrations, policies, tests)
2. Provide risk and coupling critique
3. Wait for explicit approval before execution
4. Execute narrowly, verify, and report evidence

## Tooling Expectations (Use Frequently)

### Axiom CLI

Use Axiom often for production log and query validation during investigation and post-change verification.

Verified working status (Feb 11, 2026):
- `axiom auth status axiom` confirms login and org access.
- `axiom query "['vercel-runtime'] | limit 1" --format table` returns runtime rows.
- Drain token ingest + query smoke test succeeded for dataset `vercel-runtime`.

Common checks:

```bash
axiom auth status axiom
axiom dataset list --deployment axiom
axiom query "['vercel-runtime'] | limit 20" --format table
```

### Supabase CLI

Use Supabase CLI often for local DB/auth/template workflows and migration confidence.

Common checks:

```bash
supabase status
supabase migration list
supabase db lint
supabase db reset
```

Run the safest command first (`status`, `list`, `lint`) before mutating operations.

## Browser Validation: Claude in Chrome MCP

Use Claude + Chrome MCP for browser-side validation when workflows require real UI state, including:

- Admin workflows that depend on dashboard behavior
- Auth template behavior and visual QA
- Post-change smoke checks where CLI output is insufficient

Capture concrete evidence (screen state, route, action, outcome) in your summary.

## Email Asset Note

Latest shared email header asset:

- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/public/images/CSC Email Header1.png`

When referencing public web assets in docs, always use the repo path above for traceability.
