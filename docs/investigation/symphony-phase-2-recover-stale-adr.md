# Symphony Phase 2.G Recover-Stale Live Test ADR

Status: Proposed for coordinator review
Date: 2026-05-02
Scope: Symphony Phase 2.G operational hardening

## Decision

Use a disposable GitHub issue that is deliberately staged as stale
`symphony:running` to exercise live `recover-stale --execute`.

The test must not kill an active runner, must not start Codex, and must not
touch application code. It should prove only this recovery path:

1. Symphony discovers an open issue carrying `symphony:running`.
2. Symphony uses the workpad `Last Updated` timestamp to classify it as stale.
3. Dry-run reports the issue as stale without mutations.
4. Execute mode, with `SYMPHONY_EXECUTION_APPROVED=1`, moves the issue to
   `symphony:blocked`, removes `symphony:running`, updates the workpad, writes a
   manifest, and releases `runner.lock`.

This closes the daemon-readiness gap currently documented as "live
`recover-stale --execute` remains untested."

## Context

The Phase 1 runner already has unit coverage for stale issue recovery. The code
lists GitHub issues by the configured running label, loads comments for each
issue, and calls `assessRunningIssue` with the configured stale threshold
(`tools/symphony/lib/runner.mjs:232-249`).

`recoverStaleRunningIssues` creates a manifest context and acquires
`runner.lock` before live work (`tools/symphony/lib/runner.mjs:252-280`). Execute
mode refuses to continue without `SYMPHONY_EXECUTION_APPROVED=1`, before GitHub
access (`tools/symphony/lib/runner.mjs:282-302`).

Dry-run writes planned stale issues and active non-stale running issues to the
manifest without label mutation (`tools/symphony/lib/runner.mjs:311-337`).
Execute mode writes a pre-mutation manifest first
(`tools/symphony/lib/runner.mjs:339-368`), then applies the `blocked`
transition and upserts the workpad (`tools/symphony/lib/runner.mjs:370-404`).
The final manifest records label transitions and outcome
(`tools/symphony/lib/runner.mjs:406-434`). The lock is released in `finally`
(`tools/symphony/lib/runner.mjs:435-453`).

Staleness is based on the Symphony workpad comment when one exists. The parser
looks for `- Last Updated:` in a comment containing `<!-- symphony-workpad -->`;
otherwise it falls back to the issue timestamps (`tools/symphony/lib/issues.mjs:35-53`).
An issue is stale only when it is open, has the running label, and its computed
age is greater than or equal to `staleMs`
(`tools/symphony/lib/issues.mjs:56-71`).

Parser strictness is intentionally narrow. `findWorkpadComment` first requires
the comment body to contain `<!-- symphony-workpad -->`
(`tools/symphony/lib/issues.mjs:35-36`). `parseWorkpadUpdatedAt` then matches a
line shaped like `- Last Updated: 2026-05-02T00:00:00.000Z`, with optional
backticks around the timestamp, using `WORKPAD_UPDATED_PATTERN`
(`tools/symphony/lib/issues.mjs:1-2,39-45`). If that line is absent or
unparseable, the code falls back to the comment's `updated_at` / `created_at`
timestamp (`tools/symphony/lib/issues.mjs:48-52`). The staged comment therefore
must contain both the marker and the exact `- Last Updated: <ISO timestamp>`
shape.

The default stale threshold is 240 minutes from `WORKFLOW.md`
(`WORKFLOW.md:23-28`). It can be overridden by
`SYMPHONY_STALE_RUNNING_MINUTES`, but this ADR avoids that override for the
canonical live test so the production configuration is exercised.

The current runbook documents the command path but explicitly says live
`recover-stale --execute` remains untested
(`docs/runbooks/symphony.md:181-207`).

## Existing Test Coverage

Current unit tests prove these pieces:

- A stale running issue moves to blocked in execute mode
  (`tools/symphony/test/runner.test.mjs:450-513`).
- Duplicate workpad comments are cleaned while updating the canonical workpad
  (`tools/symphony/test/runner.test.mjs:515-581`).
- Execute mode proves the manifest is writable before GitHub mutations
  (`tools/symphony/test/runner.test.mjs:583-643`).
- Execute mode requires `SYMPHONY_EXECUTION_APPROVED=1` before GitHub access
  (`tools/symphony/test/runner.test.mjs:645-662`).

What remains unproven is the live GitHub path: real labels, real comment
upsert, real manifest, and real lock release against the repository.

## Alternatives Considered

### Kill a Real Daemon Run

Rejected for this test. The earlier watched daemon trial already proved that
interrupting the daemon can surface real cleanup bugs. Reusing that pattern for
recover-stale would add unnecessary Codex execution, worktree, and label-state
risk. Phase 2.G needs to test stale issue recovery, not daemon cancellation.

### Manually Leave a Local `runner.lock`

Rejected. `recover-stale` is about stale running issues, not stale local lock
deletion. A stale local lock prevents `recover-stale` from starting; execute
paths intentionally do not auto-delete stale locks. Testing lock deletion here
would measure the wrong behavior.

### Use `SYMPHONY_STALE_RUNNING_MINUTES=1`

Rejected for the canonical test. It is useful for emergency local debugging,
but it broadens the blast radius if any unrelated running issue exists. The
safer test is to create a workpad timestamp more than 240 minutes in the past
and keep the configured threshold unchanged.

## Live Test Plan

Run from the supervised control checkout, after refreshing to current main in
Sami's terminal.

### Preconditions

1. `npm run symphony:doctor` passes.
2. `gh issue list --label symphony:ready --state open` returns zero rows.
3. `gh issue list --label symphony:running --state open` returns zero rows.
4. `.symphony/state/runner.lock` is absent.
5. The disposable test issue is the only issue that will receive
   `symphony:running`.

### Stage the Disposable Issue

Create an issue titled:

```text
Symphony recover-stale live test (do not execute)
```

Suggested issue body:

```markdown
## Task

Disposable recovery-control issue for Symphony Phase 2.G. Do not run Codex for
this issue. It is manually staged as stale `symphony:running` to test
`recover-stale --execute`.

## Expected recovery result

- `recover-stale --dry-run` reports this issue as stale.
- `recover-stale --execute` moves this issue to `symphony:blocked`.
- `symphony:running` is removed.
- Workpad state becomes `blocked`.
```

Apply labels:

```bash
gh issue edit <issue-number> \
  --repo samiserrag/denver-songwriters-collective \
  --add-label symphony,symphony:running
```

Add one stale workpad comment:

```bash
STALE_AT=$(node -e 'console.log(new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString())')
gh issue comment <issue-number> \
  --repo samiserrag/denver-songwriters-collective \
  --body "<!-- symphony-workpad -->
## Codex Workpad

- Issue: #<issue-number> Symphony recover-stale live test (do not execute)
- State: running
- Last Updated: ${STALE_AT}
- Command: test fixture
- Mode: manual
- Branch: pending
- Worktree: pending
- Log: pending
- Run Manifest: pending
- Next Human Action: Wait for recover-stale dry-run and execute.
- Blocked Reason: none
- Detail: Deliberately stale workpad for Phase 2.G live recovery test.

This comment is maintained by the local Symphony runner."
```

The `node -e` timestamp form is portable across macOS and Linux and avoids
BSD/GNU `date` flag differences. The timestamp is intentionally more than the
configured 240-minute stale threshold.

### Dry-Run Evidence

```bash
npm run symphony:recover-stale 2>&1 | tee /tmp/symphony-recover-stale-dry-run.log
```

Expected:

- output says `Symphony recover-stale: dry-run`
- stale list includes exactly the disposable issue
- active running count is absent or zero
- manifest outcome is `ok: true`
- no label transition occurs
- `runner.lock` is absent after the command

### Execute Evidence

```bash
SYMPHONY_EXECUTION_APPROVED=1 node tools/symphony/cli.mjs recover-stale --execute \
  2>&1 | tee /tmp/symphony-recover-stale-execute.log
```

Expected:

- output says `Symphony recover-stale: execute`
- stale list includes exactly the disposable issue and ends with `-> blocked`
- manifest outcome is `ok: true` with reason `stale running issues recovered`
- final labels are `symphony` + `symphony:blocked`
- `symphony:running` is absent
- workpad state is `blocked`
- blocked reason includes `stale running recovery after`
- `runner.lock` is absent after the command
- `gh issue list --label symphony:running --state open` returns zero rows
- `gh issue list --label symphony:ready --state open` returns zero rows

Find the execute manifest with:

```bash
ls -t .symphony/state/manifests/*-recover-stale-*.json | head -1
```

After the evidence bundle is captured, clear the approval variable in the
terminal session:

```bash
unset SYMPHONY_EXECUTION_APPROVED
```

## Evidence Bundle Required for Coordinator Review

Capture and paste:

1. Doctor output.
2. Pre-test ready/running issue-list checks.
3. Staged issue number, labels, and manual workpad comment timestamp.
4. Full dry-run output and dry-run manifest JSON.
5. Full execute output and execute manifest JSON.
6. Final issue labels and final workpad comment body.
7. `runner.lock` absence.
8. `git status --short` from the control checkout.
9. Confirmation that no worktree was created and no branch was created.
10. `git diff --name-only origin/main..HEAD` from the control checkout.

## Rollback and Cleanup

If dry-run does not identify exactly one stale issue, do not execute. Remove the
test labels and close the disposable issue as `not planned`.

If execute fails after mutation, manually put the issue in a safe terminal state:

```bash
gh issue edit <issue-number> \
  --repo samiserrag/denver-songwriters-collective \
  --remove-label symphony:running,symphony:ready,symphony:human-review \
  --add-label symphony,symphony:blocked
```

Only remove `.symphony/state/runner.lock` manually after confirming no Symphony
process is alive.

Close the disposable issue only after coordinator sign-off on the recovery
evidence and before the docs-update PR merges:

```bash
gh issue close <issue-number> \
  --repo samiserrag/denver-songwriters-collective \
  --reason "not planned" \
  --comment "Closed after Symphony Phase 2.G recover-stale live test."
```

## Acceptance Criteria for the Follow-Up PR

After the live test passes, ship a small documentation PR that:

- Updates `docs/runbooks/symphony.md` to replace "live recover-stale remains
  untested" with the exact successful test evidence.
- Adds the manifest path and issue number to the supervised activation log.
- Updates `docs/investigation/symphony-phase-2-spec-gap.md` disposition labels
  for 2.G only.
- Does not change Symphony runtime code unless the live test exposes a gap.

If the live test exposes a deeper recovery bug, stop and open a separate
hardening issue/ADR before expanding scope.

This ADR-only PR does not touch `tools/symphony/**`, so it does not trigger the
PR #147 self-edit guard. Any follow-up runtime hardening that touches
`tools/symphony/**` must include explicit high-risk approval phrasing in the
issue or PR body, for example:
`Explicitly approved high-risk scope: tools/symphony self-edit.`
