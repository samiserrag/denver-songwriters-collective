# Claude Builder Brief

Standing brief for Claude Code web builder threads. This file began as the Track 1 builder brief; for current Lane 2, Lane 3, Lane 4, or Lane 5 work, the coordinator prompt is authoritative for lane, scope, branch name, claim requirements, and forbidden files.

## Required reading on every session start

1. `AGENTS.md`
2. `docs/GOVERNANCE.md`
3. `docs/investigation/ai-event-ops-collaboration-plan.md`
4. `docs/investigation/track1-claims.md`
5. `.claude/rules/00-governance-and-safety.md`
6. `.claude/rules/20-web-quality-gates.md`

## Role

Implement focused PRs only when assigned by Sami or the Lane 1 coordinator.

Current lane routing:

- Lane 2: Track 2 security/BOLA/concierge work.
- Lane 3: Symphony prototype/spec-completion implementation.
- Lane 4: Symphony helper/reviewer, read-only unless explicitly assigned implementation.
- Lane 5: event audit/admin alerts/growth work, docs-only until stop-gates approve runtime changes.

Do not update `docs/investigation/track1-claims.md` unless the coordinator prompt explicitly requires it or the task is Track 1/AI-edit coordination.

## §8.2 single-writer locks

You may not edit these files unless the task explicitly says "single-writer lock claimed for this PR":

- `web/src/app/api/events/interpret/route.ts`
- `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`
- Any migration in `supabase/migrations/`
- Prompt contract files once claimed
- Published-event gate files once claimed

If your task requires touching one of these, the task prompt should say so explicitly. If it doesn't but the work seems to require it, stop and comment on the draft PR with the question. Do not improvise.

## Git / PR protocol

Claude Code on web has direct GitHub access. Use it.

1. Branch from current `main`. Confirm base SHA before starting.
2. Branch name: use the task prompt.
3. Update `docs/investigation/track1-claims.md` only if the task prompt requires a Track 1/AI-edit claim.
4. Implement work in focused commits. One logical change per commit.
5. Run quality gates before opening PR:

   ```
   cd web
   npx tsc --noEmit --incremental false
   npm run lint
   CODEX_CI= TMPDIR="$PWD/.tmp" npm run test -- --run --pool=threads --isolate=false <relevant test files>
   ```

6. Push: `git push -u origin <branch>`
7. Open PR with the title and body requested by the task prompt.
8. Post status comment: `gh pr comment <#> --body "$(cat <<'EOF' ... EOF)"` using the template below.
9. Confirm PR URL in your final message to Sami.

## Status comment template

Post immediately after opening the PR:

```
**Scope:** <one line from the task prompt>
**Files changed:** <list>
**Files locked and forbidden (verified untouched):** <list any §8.2 locks relevant to this PR>
**Tests run:** <commands>
**Quality gates:** lint <0/0>, typecheck <pass/fail>, tests <count passing>, build <pass/fail>
**Runtime behavior changed:** yes/no — <if yes, describe>
**Needs Sami approval before merge:** yes (§13.2) / no (§13.1)
**Next dependent PR:** <number or "none">
**Base SHA:** <SHA of main when branched>
```

## Scope rules

- One focused PR per task. No follow-up "polish" PRs without explicit approval.
- If you discover scope expansion is needed mid-PR, stop and comment on the draft PR with the question. Do not improvise.
- If a quality gate fails, fix the root cause. Do not skip hooks (`--no-verify`) or amend old commits.
- All changes must follow `.claude/rules/20-web-quality-gates.md` (lint 0/0, tests pass, build success).

## Quality gate notes

The repo has known sandbox-only test pollution under `--isolate=false`. If the full suite shows failures that pass when run in isolation and don't touch your changes, note this in the status comment but don't block on it.

The known pre-existing lint warning in `web/src/components/media/MusicProfileCard.tsx` is not your problem; ignore it.

If `tsc` fails with `.next/types/routes.d 2.ts` errors, run `rm -rf web/.next` first.

## Session restart

Fresh thread? Read the required docs above. Then await task assignment from the coordinator.

Coordinator-generated task prompts will reference this brief for protocol details, so they should stay short. If a task prompt seems to violate this brief (e.g., asks you to edit a §8.2 locked file without explicit lock claim), stop and ask Sami before proceeding.

## What you do not do

- Do not start work without an explicit task assignment from the coordinator or Sami.
- Do not merge PRs.
- Do not run migrations.
- Do not push to `main` directly.
- Do not skip quality gates.
- Do not amend old commits to fix hook failures — create a new commit.
