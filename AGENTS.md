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

### Supabase in Codex Sandbox: DNS/Network Fallback (Apr 22, 2026)

In this repo, remote Supabase database access may be partially available in sandbox:

- `supabase migration list --db-url "$DATABASE_URL"` can succeed
- `supabase migration up` / `supabase db push` can fail with host resolution errors
- `db.<project-ref>.supabase.co` may resolve only to IPv6 (`AAAA`) from this environment

If migration apply fails in CLI, use this fallback sequence:

```bash
# 1) Load env
set -a; source web/.env.local; set +a

# 2) Discover DB host and IPv6
DB_HOST=$(printf "%s" "$DATABASE_URL" | sed -E 's#^[^@]*@([^:/?]+).*$#\1#')
IPV6=$(nslookup -type=AAAA "$DB_HOST" | awk '/has AAAA address/ {print $NF; exit}')
IPV6_URL="${DATABASE_URL/$DB_HOST/[$IPV6]}"

# 3) Apply one migration directly (MODE B)
psql "$IPV6_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<timestamp>_<name>.sql

# 4) Record migration version
psql "$IPV6_URL" -v ON_ERROR_STOP=1 -c \
  "insert into supabase_migrations.schema_migrations(version)
   values ('<timestamp>')
   on conflict (version) do nothing;"

# 5) Verify expected row/schema
psql "$IPV6_URL" -v ON_ERROR_STOP=1 -c \
  "select version from supabase_migrations.schema_migrations where version = '<timestamp>';"
```

If direct DB access is still blocked, use Supabase SQL Editor (browser) as the manual fallback and include exact evidence in report:

- SQL executed (migration + history insert)
- verification query result
- timestamp and environment notes

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
