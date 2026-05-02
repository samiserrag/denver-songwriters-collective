# Codex Builder Brief

Standing brief for Codex builder threads. This file began as the Track 1 Codex Cloud brief; for current Lane 2, Lane 3, Lane 4, Lane 5, or Lane 6 work, the coordinator prompt is authoritative for lane, scope, branch name, claim requirements, and forbidden files.

## Required reading on every session start

1. `AGENTS.md`
2. `docs/GOVERNANCE.md`
3. `docs/investigation/ai-event-ops-collaboration-plan.md`
4. `docs/investigation/track1-claims.md`
5. `.claude/rules/00-governance-and-safety.md`
6. `.claude/rules/20-web-quality-gates.md`

## Platform Reality

Codex environments differ. The coordinator prompt is authoritative for whether
the task should use direct push, the GitHub plugin, or the button-click
protocol.

### Codex Cloud constraints verified 2026-04-29

Codex Cloud sandboxes — even when started with the GitHub repo selected — have:

- `origin` remote configured ✅
- Outbound access to `github.com` **blocked** at the network layer (CONNECT tunnel 403) ❌
  This blocks `git fetch origin`, `git push`, `gh` API calls, and any other
  HTTPS request to github.com. The repo is already cloned into the sandbox at
  task launch — work from the preloaded clone, do not try to refresh it.
- `gh` CLI **not installed** ❌
- No `GITHUB_TOKEN` environment variable ❌

If these constraints are present, you cannot push directly and the button-click
protocol is the only path. If your current environment has working `git push`,
`gh`, or GitHub plugin access, use the protocol in the task prompt and report
what worked.

## Role

Implement focused PRs only when assigned by Sami or the Lane 1 coordinator.

Current lane routing:

- Lane 2: Track 2 security/BOLA/concierge work.
- Lane 3: Symphony prototype/spec-completion implementation.
- Lane 4: Symphony helper/reviewer, read-only unless explicitly assigned implementation.
- Lane 5: event audit/admin alerts/growth work, docs-only until stop-gates approve runtime changes.
- Lane 6: strategy/public-good infrastructure policy, docs-only by default; ingestion, write APIs, MCP surfaces, verification migrations, and trust-layer UI/content changes require separate stop-gates.

Do not update `docs/investigation/track1-claims.md` unless the coordinator prompt explicitly requires it or the task is Track 1/AI-edit coordination.

## §8.2 single-writer locks

You may not edit these files:

- `web/src/app/api/events/interpret/route.ts`
- `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`
- Any migration in `supabase/migrations/`
- Prompt contract files once claimed
- Published-event gate files once claimed

If your task requires touching one of these, stop and ask Sami before proceeding. Codex tasks should default to non-locked files.

## Git / PR Protocol

If the task prompt selects the button-click protocol because direct push is
blocked, use this protocol:

1. Verify remote at session start: `git remote -v`. If origin is not configured, stop and tell Sami.
   Do NOT run `git fetch origin` — it will 403. The sandbox is preloaded; HEAD already reflects the
   commit Codex Cloud cloned at task launch.
2. Branch from the preloaded `main` HEAD. Get the base SHA from `git rev-parse HEAD` BEFORE checking
   out the new branch and record it in the claim entry. If main HEAD does not match the SHA the
   coordinator gave you, use the actual sandbox HEAD and note the discrepancy in your claim entry.
3. Branch name: use the task prompt.
4. Update `docs/investigation/track1-claims.md` only if the task prompt requires a Track 1/AI-edit claim.
5. Implement work in focused commits. One logical change per commit.
6. Run quality gates before signaling ready:

   ```
   cd web
   npx tsc --noEmit --incremental false
   npm run lint
   CODEX_CI= TMPDIR="$PWD/.tmp" npm run test -- --run --pool=threads --isolate=false <relevant test files>
   ```

7. Confirm `git status --short` is clean and `git log --oneline -5` shows your commits.
8. **Do not run `git push`** — it will fail with CONNECT 403 in this sandbox.
9. **Do not use `make_pr`** or any sandbox-internal staging that bypasses the button.
10. Tell Sami: *"Ready. Branch `<name>`. Click Create PR with title: `<title from task prompt>` and the body below."* — and provide the PR body as a fenced block in your reply.
11. Sami clicks Create PR in the Codex Cloud UI. The platform pushes the branch and opens the PR.
12. The PR body **is** your status comment — see template below. Sami will not be able to easily post a comment from his phone, so the body must be self-contained.

## PR body template

The body of the PR opened via Create PR must include:

```markdown
## Scope
<one line from the task prompt>

## Files changed
<list>

## Files locked and forbidden (verified untouched)
<list any §8.2 locks relevant to this PR>

## Tests run
<commands>

## Quality gates
- Lint: 0 errors, 0 warnings (or document any pre-existing)
- Typecheck: pass
- Tests: <count> passing
- Build: pass

## Runtime behavior changed
yes / no — <if yes, describe>

## Needs Sami approval before merge
yes (§13.2) / no (§13.1)

## Next dependent PR
<number or "none">

## Base SHA
<SHA of main when branched>
```

## Scope rules

- One focused PR per task. No follow-up "polish" PRs without explicit approval. The night of 2026-04-28 produced a polish PR that was scope creep; do not repeat.
- If you discover scope expansion is needed mid-PR, stop and tell Sami before continuing. Do not improvise.
- If a quality gate fails, fix the root cause. Do not skip hooks or amend old commits.
- All changes must follow `.claude/rules/20-web-quality-gates.md`.

## Quality gate notes

- Use the Codex sandbox test command shape exactly: `CODEX_CI= TMPDIR="$PWD/.tmp" npm run test -- --run --pool=threads --isolate=false <files>`. The default `npm run test` may fail with EPERM in the sandbox.
- Known sandbox-only test pollution under `--isolate=false`: if failures pass in isolation and don't touch your changes, note this in the PR body but don't block on it.
- If `tsc` fails with `.next/types/routes.d 2.ts` errors, run `rm -rf web/.next` first.

## Session restart

Fresh Codex Cloud task? Two-step bootstrap:

1. **Verify GitHub setup.** Run `git remote -v`, `git ls-remote --heads origin 2>&1 | head -3`, `gh auth status 2>&1`. Report exact output.
2. **Read all six required docs above.** Then await task assignment.

Even though direct push is blocked, the remote should still be configured. If it's not, the task was created without the repo picker and Sami needs to start a new task.

## What You Do Not Do

- Do not run `git push`, `git fetch origin`, or `gh` in a Codex Cloud sandbox that already showed CONNECT 403, no `gh`, or no token.
- Do not use `make_pr` or sandbox-internal PR staging when the task prompt requires the button-click protocol.
- Do not merge PRs.
- Do not run migrations.
- Do not start work without an explicit task assignment.
- Do not amend old commits — create new ones.
- Do not open follow-up "polish" PRs in the same lane without explicit approval.
