# The Colorado Songwriters Collective

This project uses scoped Claude Code memory rules to keep global context small while preserving full operational guidance. Use this file as the index for what to read and where to edit memory.

## Global essentials

- All contributors and agents must follow governance stop-gates in `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/00-governance-and-safety.md`.
- For UX principles and system design rules, see `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/DSC_UX_PRINCIPLES.md`.
- For product philosophy and UX laws, see `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/PRODUCT_NORTH_STAR.md`.
- For enforceable UI and data behavior, see `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/CONTRACTS.md`.
- For governance workflow and stop-gate protocol, see `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/GOVERNANCE.md`.
- For database security invariants, see `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/SECURITY.md`.

## CLI tools available (USE THESE FIRST)

This repo has authenticated CLI access to production infrastructure. **Use these tools proactively** — don't guess when you can query.

| Tool | Command | What it does |
|------|---------|-------------|
| **Axiom** | `axiom query "['vercel-runtime'] \| ..."` | Query Vercel runtime logs (function invocations, errors, console output). See `40-ops-observability-and-debug.md` for field names and query patterns. |
| **Supabase DB** | `curl -X POST "https://api.supabase.com/v1/projects/{ref}/database/query"` | Execute SQL on production DB. Token: `security find-generic-password -s "Supabase CLI" -a "supabase" -w` (decode `go-keyring-base64:` prefix with `sed + base64 -d`). Project ref: `oipozdbfxyskoscsgbfq`. |
| **Vercel CLI** | `npx vercel ls`, `npx vercel logs <url>` | List deployments, stream runtime logs. |
| **GitHub CLI** | `gh run list`, `gh run view <id> --log-failed` | Check CI status, read failure logs. |
| **Chrome MCP** | `mcp__Claude_in_Chrome__*` tools | Control browser: click, type, execute JS, read network/console, take screenshots. Critical for debugging client-side issues — can execute `fetch()` from a logged-in session to see actual API response bodies. |

**When debugging production issues, always:**
1. Check Axiom logs first (`axiom query`) for the actual error
2. Query the DB directly if you need to verify data state
3. Use Chrome MCP `javascript_tool` to execute `fetch()` from the user's session when the error is client-facing (captures the full response body including error messages that may differ from what `canManageEvent` or other server-side checks suggest)
4. Check `gh run list` for CI status before and after pushing

## Project overview

A community platform for Denver-area songwriters to discover open mics, connect with musicians, and stay informed about local music events.

Live site: [coloradosongwriterscollective.org](https://coloradosongwriterscollective.org)
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Auth + RLS), Vercel

## Rules index

- Global governance and safety: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/00-governance-and-safety.md`
- Web product invariants and locked UI behavior: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/10-web-product-invariants.md`
- Web quality gates: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/20-web-quality-gates.md`
- Supabase migrations and deploy rules: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/30-supabase-migrations-and-deploy.md`
- Ops, observability, and debugging guidance: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/40-ops-observability-and-debug.md`
- Docs workflow and authority: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/.claude/rules/50-docs-workflow-and-authority.md`

## Deep reference memory

- Docs memory index: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/CLAUDE.md`
- Historical change log: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/completed/CLAUDE.md`
- Deferred backlog and future tracks: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/backlog/CLAUDE.md`
- Operational runbook references: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/runbooks/CLAUDE.md`
