# Agent Operations Guide

This file is the operational handbook and default orientation document for AI/code agents working in this repository.

## Start Here

When Sami says "Read AGENTS.md", every new agent should treat this file as the first stop for repo bearings, collaboration expectations, and environment-specific workarounds. Read this file before planning substantial work, then follow the linked canonical docs only as deeply as the task requires.

Use this file to quickly learn:

- who has approval authority and how stop-gates work
- how Sami prefers scoped investigation, evidence, and execution
- which repo-specific commands avoid known Codex sandbox problems
- when browser, Supabase, Axiom, GitHub, or production validation is expected

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

### Codex Vitest / TypeScript Workarounds

In Codex sandbox sessions, Vitest's default isolation mode may fail before tests load with:

```text
EPERM: operation not permitted, mkdir '.../web/.tmp/<random>/client'
```

Use this command shape for focused Vitest runs:

```bash
cd web
CODEX_CI= TMPDIR="$PWD/.tmp" npm run test -- --run --pool=threads --isolate=false <test files>
```

This is a sandbox workaround, not a test behavior change. `--pool=threads --isolate=false` avoids the denied temp `client` directory path and still runs Vitest.

For TypeScript checks, avoid sandbox writes to `tsconfig.tsbuildinfo`:

```bash
cd web
npx tsc --noEmit --incremental false
```

If TypeScript reports duplicate generated `.next/types/routes.d*.ts` identifiers, remove the generated `.next` directory first:

```bash
rm -rf web/.next
```

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

### GitHub Access in Codex: Plugin Is Canonical

The GitHub plugin / connector is the canonical GitHub control plane for Codex agents in this repo, including coordinators. Use it first for PR metadata, PR diffs, review threads, comments, status checks, merges, branch/file updates when appropriate, issues, labels, and repository metadata.

Do not use `gh`, raw GitHub REST calls, `curl https://api.github.com`, or ad hoc shell GitHub calls when the GitHub plugin can perform the operation. Shell GitHub access is only acceptable when the repo runtime itself must exercise GitHub from the shell, or when a coordinator prompt explicitly says the plugin cannot perform the needed operation.

Codex may still have two different GitHub access paths:

- **GitHub plugin / connector tools** - canonical for GitHub control-plane work. They can work even when the shell cannot reach `api.github.com`.
- **Shell network access** through `gh`, `git`, `curl`, Node `fetch`, or repo scripts - required only when the code under test itself calls GitHub, such as `tools/symphony` doctor, dry-run, daemon, and recovery commands. These shell-dependent Symphony paths remain prohibited while Symphony is prototype-only unless a future stop-gate explicitly allows them.

Do not confuse the two. If `gh issue list`, `curl https://api.github.com`, or Node `fetch("https://api.github.com")` fails inside Codex, first check whether the GitHub plugin is available before declaring GitHub unavailable. Use the plugin for GitHub mutations that do not need to be performed by the repo runtime itself.

If a repo command must call GitHub from the shell, the plugin is not enough. That shell must have both valid GitHub auth and network access to GitHub. For Codex Cloud / restricted environments, enable agent internet access for the environment and allow the required domains and HTTP methods. Minimum domains for this repo's GitHub/Symphony operations are typically:

- `api.github.com`
- `github.com`

Issue staging and label/comment changes require write methods such as `POST`, `PATCH`, and `DELETE`; a read-only `GET` allowlist is insufficient for live GitHub issue operations. If Codex shell networking remains blocked, run the shell-dependent command from Sami's normal local terminal and paste the output back for audit.

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

### Browser QA With Local Dev Servers

Codex sandboxed shell commands may be blocked from starting local dev servers with errors like:

```text
Error: listen EPERM: operation not permitted 0.0.0.0:3000
Error: listen EPERM: operation not permitted 127.0.0.1:3001
```

When browser QA needs a local Next.js server and Codex cannot bind/listen, prompt Sami to start the server outside Codex in a normal terminal:

```bash
cd /Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web
npm run dev -- -H 127.0.0.1 -p 3001
```

Then use browser tools against:

```text
http://127.0.0.1:3001
```

This is the preferred fallback for visual QA. Do not treat the Codex `listen EPERM` as an app failure unless the same command fails in Sami's normal terminal.

## Email Asset Note

Latest shared email header asset:

- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/public/images/CSC Email Header1.png`

When referencing public web assets in docs, always use the repo path above for traceability.
