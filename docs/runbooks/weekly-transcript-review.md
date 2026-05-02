# Runbook: Weekly Transcript Review

**Status:** ACTIVE
**Owner:** Sami
**Last updated:** 2026-05-02
**Scope:** Track 2 Phase 5.0 operational hygiene for AI edit, import, and concierge learnings

---

## Purpose

Run a deliberate weekly review so Track 2 learnings from AI edit, import,
concierge, source verification, and analytics work are captured while the
context is still fresh.

The review is not a strategy-reset meeting and not an implementation task. It
is a small operational habit that turns raw transcripts, telemetry, PR review
comments, user feedback, and incident notes into concrete next actions:

- eval fixtures
- bugfix issues
- follow-up ADR questions
- backlog items
- roadmap clarifications that require Sami approval
- explicit "no action needed" records

This runbook exists because `docs/investigation/track2-roadmap.md` calls for
weekly transcript review and telemetry consumption as Phase 5.0 housekeeping
before Track 2 adds more agent modes.

---

## Cadence

Default cadence: once per week, 30 minutes.

Recommended timing:

- Review the prior 7 days.
- Run before planning new Track 2 implementation work for the week.
- Use a longer window only when a launch, model change, prompt change, or
  production incident created a known review backlog.

Do not let the review become an open-ended transcript archaeology session. If a
thread needs deeper investigation, file a follow-up item and move on.

---

## Inputs to Inspect

Inspect the smallest source set that can answer whether the agent is behaving
well enough and whether Track 2 plans need follow-up work.

### Required Sources

1. Axiom AI edit-turn telemetry
   - Start with `docs/runbooks/ai-telemetry-consumption.md`.
   - Use the saved query that joins `[edit-turn-telemetry]` and
     `[edit-turn-outcome]` by `turnId`.
   - Review the prior 7 days.

2. Recent accepted, rejected, and unknown-outcome turns
   - Sample across `create`, `edit_series`, and `edit_occurrence`.
   - As Track 2 ships, include `discover`, `cancel`, `url_import`, `qa`,
     source-verification, and import-review modes.

3. High-risk or unusual turns
   - High-risk accepted outcomes.
   - Turns with blocked fields.
   - Turns with verifier auto-patches.
   - High latency.
   - Unknown outcome spikes.
   - Repeated clarification loops.

4. Recent Track 2 PRs and review threads
   - Look for reviewer findings that imply missing evals, unclear contracts, or
     repeated confusion.
   - Do not reopen already-resolved code review unless the same issue appears
     in new telemetry or user feedback.

5. User or operator reports
   - Host feedback.
   - Admin observations.
   - Manual QA notes.
   - Production incidents or support messages.

### Optional Sources

Use these only when relevant to the week:

- Axiom runtime errors around agent, import, URL fetch, public API, or analytics
  routes.
- Eval harness failures or newly added eval fixtures.
- GitHub issues labeled for Track 2, AI edit, import, concierge, public API,
  safe fetcher, analytics, or BOLA/RLS.
- Security ADR follow-up comments.
- Browser QA notes for agent or import flows.
- Manual source-verification evidence for 2J.

---

## Sampling Guidance

The review should be small but balanced.

Minimum weekly sample:

- 10 joined edit-turn records from the prior 7 days.
- At least 2 accepted turns, if available.
- At least 2 rejected or abandoned/unknown turns, if available.
- Any high-risk accepted turn.
- Any turn with blocked fields.
- Any turn tied to a new Track 2 mode once that mode exists.

If volume is low, review all available turns and record that volume was low.
Low volume is a finding only if it blocks product learning or hides operational
signal.

---

## Review Questions

For each sampled turn or report, ask:

1. Did the agent understand the user's intent?
2. Did it choose the correct mode: create, edit, occurrence edit, cancel, URL
   import, Q&A, source verification, or manual review?
3. Did it target the right event, occurrence, venue, organization, source, or
   import candidate?
4. Did it avoid applying or suggesting unsafe writes?
5. Did published-risk confirmation, preview, and human-in-the-loop review remain
   intact?
6. Did it preserve public/private boundaries and avoid exposing draft,
   invite-only, private note, email, analytics, or internal data?
7. Did any LLM or external-content behavior show prompt-injection,
   hallucination, overconfidence, stale source handling, or unsupported
   extraction?
8. Did telemetry capture enough context to debug the behavior?
9. Is this a one-off bad sample, a recurring pattern, or an expected limitation
   already covered by an ADR?
10. Does this require action, or is "no action needed" the correct outcome?

---

## Capture Format

Create a short weekly note in the appropriate tracking location for the week.
Use GitHub issue comments, a coordinator standing report, or a future dedicated
ops log if one exists. Do not create a new repo file for every weekly review
unless Sami explicitly asks for that.

Use this format:

```md
## Weekly Transcript Review - YYYY-MM-DD

Window:
- YYYY-MM-DD to YYYY-MM-DD

Sources reviewed:
- Axiom saved query:
- PRs/reviews:
- User/operator reports:
- Other:

Sample:
- Joined turns reviewed:
- Modes covered:
- High-risk turns reviewed:
- Unknown outcomes reviewed:

Findings:
- Finding:
  Evidence:
  Impact:
  Disposition:

Follow-ups:
- Type: ADR / backlog / bugfix / eval fixture / docs / no action
  Owner:
  Blocking:
  Link:

No action needed:
- Reason:

Approval needed:
- Yes/No
- If yes, what Sami must decide:
```

Keep the note concise. The goal is to preserve decisions and follow-ups, not to
transcribe every sampled turn.

---

## Finding Types

Classify findings into one of these types.

### Eval Fixture

Use when the behavior is model/prompt-sensitive and should be replayed.

Examples:

- recurring bad scope decision
- hallucinated venue or event detail
- bad clarification question
- unsafe confidence on ambiguous source text
- URL import candidate extraction error

Expected action: add or request an eval fixture in the relevant harness. Do not
rewrite prompts from this review alone unless a scoped prompt PR is approved.

### Bugfix

Use when deterministic code, routing, auth, serialization, validation,
telemetry, or UI behavior is wrong.

Examples:

- wrong event ID accepted
- field blocked incorrectly by registry code
- telemetry missing `turnId`
- public response leaks a private field
- dashboard or admin UI renders misleading state

Expected action: file a bug with evidence, expected behavior, observed behavior,
and affected files if known.

### Follow-Up ADR

Use when the finding changes a policy, security boundary, data model, endpoint
contract, product behavior, or sequencing assumption.

Examples:

- new writable field category not covered by 2F.0
- source-fetch behavior not covered by 2J.0
- public API exposure not covered by 2I.0
- analytics collection or retention question not covered by 2K.0
- object ownership rule not covered by 2L.0

Expected action: create a scoped ADR prompt or add the question to the relevant
ADR review. Do not make the architectural change during the weekly review.

### Backlog Item

Use when the finding is valid but not urgent or not tied to a current blocker.

Examples:

- useful dashboard panel
- better admin filter
- lower-priority copy clarification
- future import quality metric

Expected action: file a backlog item with enough detail to reproduce why it
matters.

### Documentation Update

Use when the behavior is correct but the docs, runbook, or roadmap no longer
match reality.

Expected action: create a docs-only follow-up. If the doc change would alter
strategy or approval boundaries, Sami must approve.

### No Action Needed

Use when the sampled behavior is acceptable, already covered by an existing
ADR/backlog item, or not actionable with current evidence.

Record why no action is needed so the same sample is not relitigated later.

---

## Approval Boundary

The weekly review can identify work. It cannot silently change strategy.

Do not use weekly transcript review to:

- change Track 2 sequencing
- expand a sub-track scope
- weaken a security ADR
- enable existing-event AI writes
- enable URL fetching or import behavior
- introduce analytics collection
- change public data exposure policy
- change BOLA/RLS/service-role assumptions
- edit prompts
- edit contracts
- edit runtime code
- edit schema or migrations

If a finding implies any of those, mark it `Approval needed: Yes` and route it
to Sami through a scoped ADR, backlog, or implementation prompt.

Default rule: if the finding changes product behavior, data exposure, security
posture, or Track 2 order, it needs Sami approval.

---

## Connect Findings Back to Track 2

Every action item should point to one Track 2 area.

Use this routing table:

| Finding area | Route to |
|---|---|
| Existing-event AI write/apply, cancel, confirmation, rollback, audit | 2F.0 / 2F follow-up |
| Concierge routing, cross-event search, Q&A, mode switching | 2F / concierge ADRs |
| Public event JSON-LD, `/events.json`, crawler policy, citation stability | 2I.0 / 2I follow-up |
| URL fetching, source reverification, drift detection, external evidence | 2J.0 / 2J follow-up |
| URL import, JSON-LD import, dedup, review queue | 2D follow-up |
| Analytics collection, GPC, retention, bot filtering, dashboards | 2K.0 / 2K follow-up |
| Object-level auth, RLS, service-role, resource ownership | 2L.0 / 2L follow-up |
| Eval harness coverage | eval fixture / Track 1 or Track 2 harness follow-up |
| Roadmap sequencing or strategic direction | Sami approval required |

When a finding maps to an approved security ADR, link it there and state whether
the ADR already covers the case. If the ADR does not cover it, propose a
follow-up ADR or review comment rather than silently broadening implementation
scope.

---

## No Action Needed

"No action needed" is a valid weekly outcome when the evidence supports it.

Use this outcome when:

- sampled turns behaved as expected
- bad-looking samples were already blocked by the correct gate
- low confidence correctly led to clarification or manual review
- rejected turns are expected user preference, not model failure
- unknown outcomes are within normal volume and not trending upward
- the issue is already covered by an open ADR, PR, bug, or backlog item
- there is not enough evidence to act and the next evidence source is known

The note should include:

```md
No action needed:
- Reviewed 10 joined turns from YYYY-MM-DD to YYYY-MM-DD.
- No unsafe writes, privacy leaks, public/private boundary issues, or repeated
  bad scope decisions found.
- One unknown outcome was present; below action threshold and already tracked by
  telemetry consumption runbook.
- No Sami approval needed.
```

Avoid vague entries like "looks good" without sample size, source, and reason.

---

## Escalation Rules

Escalate immediately instead of waiting for the next weekly review when a sample
shows:

- possible private data leak
- cross-user or cross-resource access
- existing-event write applied without the required gate
- public API exposing draft, invite-only, private host notes, email, analytics,
  or internal IDs
- unsafe URL fetch behavior
- stored/reflected XSS risk through analytics or transcript values
- repeated hallucinated event facts accepted by users
- source reverification likely to mutate event content without review
- analytics collecting non-essential client data despite GPC or kill switch

Escalation means file or route a blocker with evidence. Do not patch runtime
behavior inside the weekly review unless a separate implementation prompt
explicitly approves it.

---

## Done Criteria for the Weekly Review

A weekly review is complete when:

- the chosen time window is stated
- sources inspected are listed
- sample size and modes are recorded
- findings are classified
- follow-ups are routed to ADR, backlog, bugfix, eval fixture, docs, or no
  action
- approval-needed items are separated from routine work
- no strategic direction changes were made without Sami approval

If no material findings exist, the review is still complete when the "No action
needed" section records the evidence.

---

## Related Docs

- `docs/investigation/track2-roadmap.md`
- `docs/runbooks/ai-telemetry-consumption.md`
- `docs/GOVERNANCE.md`
- `AGENTS.md`
- Track 2 security ADRs under `docs/investigation/track2-*.md`
