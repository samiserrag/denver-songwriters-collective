# Symphony Workflow-Format Correction ADR

Status: Accepted and implemented
Date: 2026-05-02
Scope: Symphony Phase 2 workflow-format correction stop-gate

## Decision

Make Symphony workflow parsing spec-compatible by adding YAML front matter
support as the canonical `WORKFLOW.md` format, while preserving the current
`<!-- symphony-config -->` JSON comment block as a transitional compatibility
format.

Recommended final state:

- `WORKFLOW.md` starts with YAML front matter delimited by `---`.
- Parsed workflow shape includes `{ config, prompt_template }`.
- Existing callers may keep reading `workflow.markdown` during a compatibility
  window, but `workflow.markdown` should become an alias of
  `prompt_template`.
- The current JSON comment block parser remains accepted for one migration
  window so existing Phase 1 control checkouts do not fail abruptly.
- `doctor` should warn when it sees legacy JSON-comment config and pass when
  the config is otherwise valid.
- After at least one supervised Symphony cycle proves the YAML format, remove
  or explicitly deprecate the legacy parser in a later ADR/PR.

This ADR is investigation-only. It does not edit runtime code, Symphony code,
`WORKFLOW.md`, GitHub issues, or live Symphony state.

Implementation note: the follow-up implementation PR made YAML front matter
canonical, preserved legacy JSON-comment parsing as a warning-only migration
fallback, and kept `workflow.markdown` as a compatibility alias for the
resolved `prompt_template`.

## Context

The Phase 2 spec-gap document records the workflow-format divergence in three
places:

- `docs/investigation/symphony-phase-2-spec-gap.md` says the Phase 1 workflow
  policy is repo-owned but uses `<!-- symphony-config -->` JSON rather than the
  spec's YAML front matter plus prompt body format.
- The same document notes that `tools/symphony/lib/workflow.mjs` returns
  `{ markdown, config }`, not the spec shape `{ config, prompt_template }`.
- The MVP ordering says workflow-format correction should ship in the
  operational-hardening set with 2.G recover-stale and 2.H outer timeout.

The current implementation proves the gap:

- `tools/symphony/lib/workflow.mjs` defines
  `CONFIG_PATTERN = /<!--\s*symphony-config\s*([\s\S]*?)-->/m`.
- `parseWorkflowMarkdown()` throws `missing symphony-config JSON block` if the
  comment block is absent.
- `parseWorkflowMarkdown()` calls `JSON.parse()` on the matched comment body.
- `parseWorkflowMarkdown()` returns `{ markdown, config }`.
- `tools/symphony/test/workflow.test.mjs` builds every valid fixture from
  `<!-- symphony-config ... -->` JSON.

The current repository workflow file also proves the gap:

- `WORKFLOW.md` starts with Markdown prose.
- Its config lives in an HTML comment beginning `<!-- symphony-config`.
- The config body is JSON, not YAML.
- The policy prompt follows the closing `-->`.

The current shape is not wrong for Phase 1; it worked and was validated through
supervised runs. The problem is that it is not the format described by the
original Symphony Service Specification, so future agents cannot reason about
Phase 2 compliance unless we either make it compatible or deliberately document
the divergence.

## Recommendation

Choose spec-compatible parsing, not permanent divergence.

Rationale:

1. The spec's YAML front matter plus Markdown body is more conventional for a
   repository-owned Markdown workflow file.
2. It gives future Symphony adapters the expected `{ config, prompt_template }`
   shape without forcing every downstream change to remember the Phase 1
   divergence.
3. Compatibility mode can avoid breaking current Phase 1 control checkouts.
4. The migration is isolated to `workflow.mjs`, workflow tests,
   `WORKFLOW.md`, and documentation. It does not require changing GitHub issue
   preflight, worktree creation, manifests, locks, or Codex execution behavior.

Permanent JSON-comment divergence should be rejected unless implementation
reveals a hard blocker. The only strong argument for the current format is that
JSON is parsed by built-in Node APIs. That convenience is not enough to keep a
known spec gap once Phase 2 is explicitly correcting it.

## Proposed Canonical Format

Target `WORKFLOW.md` shape:

```markdown
---
version: 1
max_concurrent_agents: 1
labels:
  ready: symphony:ready
  running: symphony:running
  humanReview: symphony:human-review
  blocked: symphony:blocked
  general: symphony
workspace:
  root: .symphony/worktrees
  logs: .symphony/logs
  state: .symphony/state
recovery:
  stale_running_minutes: 240
lock:
  stale_minutes: 240
codex:
  adapter: codex-exec
  fallback: codex exec --json
---

# Symphony Workflow

This file is the repository-owned policy for the local Symphony runner.
...
```

Parser return shape:

```js
{
  config,
  prompt_template,
  markdown: prompt_template,
  format: "yaml-front-matter"
}
```

`markdown` remains as a compatibility alias because current runner code passes
`workflow.markdown` into `buildCodexPrompt()`.

## Compatibility And Migration Plan

Phase 1 implementation PR:

1. Add YAML front matter parsing to `tools/symphony/lib/workflow.mjs`.
2. Keep legacy JSON comment parsing as fallback.
3. Return `prompt_template` and `markdown` for both formats.
4. Add `format` metadata with values such as:
   - `yaml-front-matter`
   - `legacy-json-comment`
5. Keep existing `validateWorkflowConfig(config)` semantics.
6. Migrate root `WORKFLOW.md` to YAML front matter in the same PR.
7. Update `tools/symphony/test/workflow.test.mjs` to cover:
   - YAML happy path.
   - Legacy JSON comment fallback.
   - Invalid YAML.
   - Invalid JSON fallback.
   - YAML config validation failures.
   - Missing config.
   - Returned `prompt_template` excludes front matter.
   - Returned `markdown` aliases `prompt_template`.

Phase 2 cleanup PR, only after YAML is proven:

1. Decide whether to keep legacy parsing indefinitely or remove it.
2. If removing, make the legacy parser fail with a migration-specific error
   that names YAML front matter.
3. Update the spec-gap document disposition after the implementation has
   shipped and been validated.

## Implementation Scope Decision

The later implementation PR should touch:

- `tools/symphony/lib/workflow.mjs`
- `tools/symphony/test/workflow.test.mjs`
- `WORKFLOW.md`
- `tools/symphony/README.md`
- `docs/runbooks/symphony.md`
- `docs/investigation/symphony-phase-2-spec-gap.md` only to update the
  workflow-format disposition after the feature ships

It should not touch:

- `tools/symphony/lib/runner.mjs`, unless compatibility return shape proves
  impossible
- `tools/symphony/lib/codexAdapter.mjs`
- `tools/symphony/lib/preflight.mjs`
- `web/**`
- Supabase migrations
- Track 1 files
- prompt contracts
- claims ledgers

If implementation requires changes outside the listed files, stop and ask
before expanding scope.

## Parser Rules

YAML front matter parser behavior should match the spec expectation:

- If the file starts with `---`, parse until the next `---` delimiter.
- YAML content must decode to an object/map.
- The Markdown body after the closing delimiter becomes `prompt_template`.
- Trim leading and trailing whitespace from `prompt_template`.
- Unknown config keys remain allowed for forward compatibility.
- Known config fields still go through existing validation.
- If YAML parsing fails, fail closed with a clear `workflow_parse_error`-style
  message.
- If YAML is present, do not also parse the legacy JSON comment block.

Legacy parser behavior:

- If the file does not start with `---`, look for
  `<!-- symphony-config ... -->`.
- Parse that block as JSON exactly as Phase 1 does today.
- Return the full Markdown as `prompt_template` only if keeping current prompt
  behavior is necessary for compatibility.
- Prefer excluding the JSON comment block from `prompt_template` if tests prove
  current prompt behavior does not depend on it.

Open implementation question:

- Whether legacy `prompt_template` should include or exclude the JSON config
  comment. Current `workflow.markdown` includes the whole file. Preserving this
  exactly is safest for compatibility; excluding the comment is cleaner but
  could subtly change the prompt passed to Codex. The implementation PR should
  make this an explicit test-backed choice.

## Risks

### Risk 1: Prompt Drift

Changing `WORKFLOW.md` from JSON comment to YAML front matter changes the text
passed into Codex if `prompt_template` excludes front matter.

Mitigation:

- Keep policy prose semantically identical.
- Add a test proving `prompt_template` contains the expected policy headings.
- Run a supervised dry-run before any execute using the new format.

### Risk 2: Parser Dependency Expansion

Node has JSON parsing built in, but YAML requires either a dependency or a
small parser.

Mitigation:

- Prefer the repo's existing dependency/tooling if a YAML parser already exists.
- If adding a dependency is required, surface it explicitly in the
  implementation PR and justify why it is safer than maintaining a custom YAML
  parser.
- Keep accepted YAML subset simple: maps, strings, numbers, nested maps.

### Risk 3: Mixed Format Ambiguity

A file could contain both YAML front matter and a legacy JSON comment block.

Mitigation:

- YAML front matter wins when present at byte zero / file start.
- Legacy block is ignored in YAML mode.
- Add a test for mixed format.

### Risk 4: Existing Control Checkouts

Older branches or worktrees may still contain JSON-comment `WORKFLOW.md`.

Mitigation:

- Keep legacy JSON comment fallback for at least one migration window.
- Make `doctor` surface format metadata so operators can see legacy vs YAML.

### Risk 5: Validation Behavior Changes

Config validation must not loosen while format changes.

Mitigation:

- Reuse `validateWorkflowConfig(config)`.
- Preserve existing tests for unsafe concurrency and stale thresholds.
- Add equivalent YAML tests for every existing JSON validation test.

## Doctor And Test Expectations

`symphony:doctor` should:

- Pass when `WORKFLOW.md` uses valid YAML front matter.
- Pass with a warning or visible diagnostic when legacy JSON-comment format is
  used.
- Fail when YAML front matter is malformed.
- Fail when YAML front matter does not parse to an object.
- Fail when known fields violate existing safety validation.

`npm run symphony:test` should include:

- Existing JSON-comment tests, either unchanged or renamed as legacy tests.
- New YAML-front-matter tests.
- Return-shape tests for `config`, `prompt_template`, `markdown`, and `format`.
- A regression test that current `WORKFLOW.md` can be loaded.

## Rollback Plan

If YAML parsing ships and causes operational issues:

1. Revert only the `WORKFLOW.md` migration to the legacy JSON-comment block if
   the parser still supports fallback.
2. If parser changes are the cause, revert the workflow-format implementation
   PR.
3. Re-run `npm run symphony:doctor`.
4. Re-run `npm run symphony:test`.
5. Do not run `once --execute` until doctor and tests are clean.

The compatibility fallback is the main rollback mechanism. It keeps Phase 1
usable while the canonical format is proven.

## Acceptance Criteria For This ADR PR

- Adds only `docs/investigation/symphony-workflow-format-correction-adr.md`.
- Does not edit runtime code.
- Does not edit `tools/symphony/**`.
- Does not edit `WORKFLOW.md`.
- Does not mutate GitHub issues.
- Does not run daemon or `once --execute`.
- `git diff --check origin/main..HEAD` passes.
- `git diff --name-only origin/main..HEAD` returns exactly:

```text
docs/investigation/symphony-workflow-format-correction-adr.md
```

## Acceptance Criteria For Later Implementation PR

- `WORKFLOW.md` uses YAML front matter as the canonical format.
- `loadWorkflow()` returns `config`, `prompt_template`, `markdown`, and
  `format`.
- YAML front matter parsing is covered by tests.
- Legacy JSON-comment parsing remains covered by tests for the migration
  window.
- Existing validation remains enforced.
- `npm run symphony:test` passes.
- `find tools/symphony -name '*.mjs' -print0 | xargs -0 -n1 node --check`
  passes.
- `git diff --check -- tools/symphony docs/runbooks/symphony.md
  tools/symphony/README.md WORKFLOW.md docs/investigation/symphony-phase-2-spec-gap.md`
  passes.
- The implementation PR includes explicit high-risk approval phrasing if the
  issue Approved write set includes `tools/symphony/**`:
  `Explicitly approved high-risk scope: tools/symphony self-edit.`

## Stop Conditions For Implementation

Stop and ask before coding further if:

- YAML support requires a new package dependency not already present.
- Parser changes require edits to `runner.mjs` or `codexAdapter.mjs`.
- The legacy format cannot be preserved without significant complexity.
- `WORKFLOW.md` migration changes the effective prompt in a way that affects
  worker behavior.
- Any file outside the approved implementation surface becomes necessary.
