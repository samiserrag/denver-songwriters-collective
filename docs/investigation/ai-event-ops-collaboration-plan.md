# AI Event Operations Portal Collaboration Plan

**Date:** 2026-04-28  
**Status:** Living coordination plan for Claude Code web, Codex Cloud, and local agents  
**Scope:** Strategy, sequencing, and collaboration rules for expanding the AI event portal from create-only into live event operations.

---

## 1. Why This Exists

This local chat contains a lot of product direction that cloud agents will not see by default. This document is the durable handoff. Every agent working on the AI event operations portal should read:

1. `AGENTS.md`
2. `docs/GOVERNANCE.md`
3. this file
4. the active claims doc once it exists: `docs/investigation/track1-claims.md`

This document is not a substitute for reading the current code. If code and this plan disagree, verify the code and update this document or the claims doc before continuing.

---

## 2. Product Direction

The portal should become an AI-assisted event operations tool, not just a one-shot event creator.

As of 2026-05-03, this plan should be interpreted through `docs/strategy/OPEN_MICS_AND_GRASSROOTS_PERFORMANCE_SCOPE.md`. CSC is narrowing from broad cultural-event aggregation to open mics and grassroots performance communities. The AI operations portal remains strategic infrastructure, but its first target is the maintenance burden of recurring, messy, relationship-driven performance events.

The core product value is:

- create new happenings from messy inputs
- update existing happenings from natural language
- keep recurring open mics, songwriter rounds, poetry readings, comedy mics, jams, workshops, showcases, and small gigs current as details drift over time
- compare screenshots, links, and scraped pages against existing listings
- avoid duplicate venues, organizations, performers, festivals, and recurring series

The long-term moat is not bulk import alone. Bulk import is table stakes. The defensible advantage is a clean event graph that makes every new flyer, URL, screenshot, and edit smarter over time.

---

## 3. Current Strategic Decision

Work is split into two tracks.

### Track 1: AI Edit And Update Existing Events

This is the immediate live-use feature set.

Users should be able to open an existing event and ask the agent to:

- update description, external link, notes, cost, tags, or event type
- change date, time, recurrence, venue, or cover with appropriate safety gates
- choose another uploaded image as the cover
- update a whole recurring series or one occurrence
- inspect a clear "What changed" diff
- continue chatting after an update
- keep preview and edit tabs in sync

High-risk live changes must not silently mutate public listings.

### Track 2: Event Graph, Categories, Festivals, And URL Import

This is the larger moat work.

It includes:

- broader category and event-format model
- organization and performer relationships
- festival parent relationships
- URL schedule import
- import run history
- dedup keys
- venue, organization, festival, and recurring-series matching

Track 2 should not block Track 1, but Track 1 must avoid choices that make Track 2 harder.

---

## 4. What We Learned From Live Feedback

A real user tried the site and gave useful feedback:

- Manual event creation felt too focused on existing CSC/open mic categories.
- They pasted `https://arcinda.org/schedule.html` hoping the AI could crawl a schedule and create multiple events.
- They were unsure how to model an organization performing inside a larger festival, such as Arcinda at Colorado Dragon Boat Festival.
- They expected the AI to help find or understand lineup and schedule context.

Strategic response:

- Add AI edit/update first because current users need maintenance, not just creation.
- Expand categories only where needed for the grassroots performance wedge: music, poetry, comedy, jams, workshops, showcases, small gigs, and directly adjacent community performance scenes.
- Add festival awareness before bulk import lands, even if v1 is only `parent_festival_id`.
- Add URL schedule import only after dedup and entity matching can prevent data pollution.

---

## 5. Track 1 Principles

### 5.1 Registry First

Build a patch field registry before building the published-event gate, diff UI, telemetry decisions, or prompt rewrite.

The registry should be the single source of truth for:

- field name
- value kind, including scalar vs array/set fields
- risk tier
- enforcement mode
- verifier auto-patch permission
- allowed scope: series, occurrence, or both
- optional post-patch hardening

Do not create separate high-risk lists in different files.

Recommended shape:

```ts
riskTier: "low" | "medium" | "high"
enforcementMode: "enforced" | "shadow"
verifierAutoPatchable: boolean
scope: "series" | "occurrence" | "both"
valueKind: "scalar" | "array"
```

Unknown fields default to high risk and enforced.

### 5.2 Published Event Safety

Published events are live public data. The agent must be conservative.

Day-one enforced high-risk examples:

- date
- start time
- end time
- signup time
- recurrence
- venue or location
- cover image
- publish state
- cancellation
- deletion

Lower-risk fields may autosave or run in shadow mode first, depending on registry classification.

Telemetry must record `riskTier` and `enforcementMode` at decision time so later enforcement changes are evidence-based.

### 5.3 Scope Must Be Structured

The model must not only imply scope in prose. Edit responses should include:

```ts
scope: "series" | "occurrence" | "ambiguous"
```

If scope is `ambiguous`, the server must force clarification even if the model also returned a patch.

Example ambiguous user input:

- "Move next Thursday to 7."
- "Change this one to the new venue."
- "Use the other cover" when image references are not deterministic.

### 5.4 Preserve Existing State

For edit/update mode, pass the current event state as compact JSON, not only prose. The model should return a patch, not a replacement event.

Rule:

- fields missing from the patch are preserved
- no field should be cleared unless the user explicitly asked
- the response should include a structural diff of changed fields

### 5.5 Venue And Image Contracts Cannot Wait

Two Track 2 concerns must be handled in Track 1:

1. Venue resolution on edit  
   If the user says "change the venue to Lost Lake," use existing venue resolution. Do not create a duplicate custom location when a known venue exists.

2. Stable image references  
   The chat must pass ordered image references every turn. "Use the other image" should resolve from a visible ordered list, not model guesswork.

Suggested image reference shape:

```ts
{
  index: number,
  clientId: string,
  eventImageId?: string,
  fileName?: string,
  isCurrentCover: boolean
}
```

If `eventImageId` is absent, the image is staged in chat only and has not yet been persisted to `event_images`.

---

## 6. Track 1 Execution Order

### PR 1: Patch Field Registry

Owner proposal: Claude  
Behavior change: none  
Runtime migration: none

Files likely touched:

- `web/src/lib/events/patchFieldRegistry.ts`
- `web/src/__tests__/events/patchFieldRegistry.test.ts`

Test source of truth should be static and deterministic. Prefer checked-in generated database types if current. Do not introspect the live database in CI.

The test should assert every editable `events` column is classified or explicitly listed in an `UNCLASSIFIED_BY_DESIGN` allowlist with justification.

### PR 2: Server-Side Diff Utility

Owner proposal: Claude  
Depends on: PR 1

Files likely touched:

- `web/src/lib/events/computePatchDiff.ts`
- related tests

Diffs should use the registry. Array fields such as `event_type` should diff by added/removed values, not positional order.

### PR 3: Telemetry For Edit Turns

Owner proposal: Codex  
Depends on: PR 1

Telemetry should capture:

- mode
- current event id
- prior state hash
- scope decision
- proposed changed fields
- verifier auto-patched fields
- risk tier
- enforcement mode
- blocked fields
- user accepted or rejected where known
- model id
- latency

### PR 4: Eval Harness

Owner proposal: Codex  
Depends on: none, but should align with PR 1 field names when merged

Add a prompt/eval harness before rewriting prompts.

It should include fixed cases for:

- "move next Thursday to 7" -> ask clarification
- "change the whole series to 6:30" -> series scope
- "use the other image" -> deterministic image selection when image refs are available
- event type inferred from flyer/source
- venue change resolves to existing venue
- missing event type does not produce "please provide event_type"

Evals should run on demand, not as a flaky model-dependent CI gate.

### PR 5: Prompt And Contract Rewrite

Owner proposal: Claude  
Single-writer file lock likely required.

Goals:

- current event state JSON
- structured `scope`
- patch-only edits
- negative examples for ambiguity
- ordered image references
- clearer instruction to ask one useful question only when truly blocked

### PR 6: AI Edit Routes

Owner proposal: Claude

Add thin wrappers:

- `/dashboard/my-events/[id]/ai`
- `/dashboard/my-events/[id]/overrides/[dateKey]/ai`

These should mount the conversational UI in edit mode with the current event id and, for occurrence edits, the date key.

### PR 7: Entry Points And Copy

Owner proposal: Codex after PR 6 route shape is known.

Add:

- "Edit with AI"
- "Update with AI"
- "Ask AI to update this event"

Update the agent page title and CTA copy to reflect both create and update capability. Do not promise URL schedule import until that feature ships.

Suggested title:

> Create Or Update Happenings With AI

Suggested helper copy:

> Add a flyer, paste notes, upload images, or ask me to update an existing draft. I will build or revise the event, save safe changes, and ask only when something truly blocks publishing.

### PR 8: Venue Resolution And Image Reference Contract

Owner proposal: Claude  
Single-writer lock may be needed if touching `ConversationalCreateUI.tsx` or `route.ts`.

Goals:

- use existing venue resolver for edit requests
- prevent custom-location duplicates when a venue match exists
- pass stable ordered image references on each turn
- allow natural language cover switching from uploaded image order

### PR 9: Published-Event Gate

Owner proposal: Claude  
Single-writer lock required.

Start with enforced handling for obvious high-risk fields and shadow mode for uncertain fields, all driven by the registry.

The gate should live on the server write path, not only in the UI.

If pending patches are built:

- store patch
- store prior state snapshot
- reject stale acceptance if relevant current fields changed
- keep pending patches host-side only
- public detail page continues showing current published values

If timeline needs compression, a simpler first version can return a versioned confirmation response and require retry with confirmation, without a full pending-patch table.

### PR 10: Refresh Instrumentation And Tab Sync

Owner proposal: Codex

Instrument the existing draft sync path behind a debug flag:

- log broadcasts
- log receives
- include source labels at call sites

Verify every mutation path broadcasts:

- series patch
- occurrence patch
- cover update
- publish
- AI-applied update

Do not leave noisy production logging enabled by default.

### PR 11: UI Polish

Owner proposal: Codex

Goals:

- distinct visual treatment for result vs follow-up question
- clear "What changed" section
- orange draft preview CTA where appropriate
- more calming waiting state
- copy that accurately describes available capabilities

---

## 7. Track 2 Strategy

Track 2 should not start before Track 1 has a stable edit/update path, except for small schema design research.

### 7.1 Categories

The current `events.event_type` is already `text[]`, not a single enum. It remains a closed validation set today.

Future category strategy:

- keep compatibility with `events.event_type` for at least one release
- introduce normalized category tables
- separate event format from disciplines
- show user/org favorites first
- provide a "+ More types" picker
- keep categories curated, not free text

Example format tags:

- open mic
- jam
- concert
- showcase
- workshop
- festival appearance
- meetup
- class
- performance

Example discipline tags:

- music
- dance
- poetry
- comedy
- martial arts
- cultural
- family friendly

### 7.2 Festivals

Start narrow.

V1 should likely be:

- `festivals` table
- `events.parent_festival_id`
- optional `events.performing_organization_id`
- UI badge: "Part of: Colorado Dragon Boat Festival"

Do not build full festival lineup management until festival organizers actually need it.

### 7.3 URL Schedule Import

Build after enough graph foundation exists to prevent duplicates.

Important requirements:

- import as first-class `import_run`
- store source URL hash
- store per-candidate content hash
- drop past events server-side
- confidence per row
- review UI for uncertain rows
- respect robots.txt and rate limits
- sanitize scraped HTML aggressively
- deterministic JSON-LD extraction before LLM extraction
- dedup against prior imports and existing events

---

## 8. Coordination Rules

### 8.1 Claims Doc

Create and maintain:

`docs/investigation/track1-claims.md`

Each active PR should list:

- branch name
- owner
- task
- files claimed
- base SHA
- status
- notes for the other agent

Agents must read the claims doc before editing.

### 8.2 Single-Writer Locks

Only one writer at a time may edit:

- `web/src/app/api/events/interpret/route.ts`
- `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`
- migrations
- published-event gate files
- prompt contract files once claimed

### 8.3 Safe Parallel Work

Likely parallelizable after claims are clear:

- registry vs eval harness
- telemetry vs AI route wrappers
- refresh instrumentation vs category research
- entry-point buttons after routes exist

Do not parallelize work that touches the same large files.

### 8.4 Branch And PR Hygiene

- one focused PR per contract
- no long-lived mega branch
- rebase from main before opening PR
- do not include unrelated local files
- do not touch `output/` or `.claude/scheduled_tasks.lock` unless specifically requested
- migrations must be sequential and never in parallel

---

## 9. What Not To Build Yet

Do not build these in Track 1:

- undo/redo for AI patches
- AI cancel/delete
- full conflict resolution for multiple hosts
- pre-event durable image storage
- full festival organizer lineup management
- Playwright-heavy lineup discovery
- multi-org account redesign
- bulk operations beyond future import review

These may be valid later, but they are not on the critical path.

---

## 10. Operational Habits For Live Use

This is no longer demo-only. Treat the agent as a production feature.

Recommended operating habits:

- keep AI features behind feature flags or kill switches
- log enough telemetry to debug model behavior
- review random AI transcripts weekly
- turn repeated failures into eval fixtures
- track model id on AI-created or AI-edited records where possible
- classify AI origin: manual, ai_chat, ai_edit, url_import
- keep copy honest about what exists today

---

## 11. Immediate Next Step

Claude should start PR 1:

> Patch field registry + classification test only. No runtime behavior changes, no migrations, no allowlist migration.

Codex Cloud can independently start:

- eval harness, or
- refresh instrumentation

Only after the claims doc exists and file ownership is clear.

---

## 12. Definition Of Done For Track 1

Track 1 is ready for broad live use when:

- hosts can open an existing event and edit it with AI
- occurrence vs series scope is explicit and safe
- published high-risk changes require confirmation
- low-risk updates can be saved with clear feedback
- the UI shows a trustworthy field-level diff
- venue edits resolve against existing venues when possible
- cover switching works from uploaded images
- open preview/edit tabs stay fresh
- telemetry captures enough detail to diagnose failures
- prompt evals cover the common failure modes

---

## 13. Pre-Approved Remote Work

The following scopes are pre-approved for cloud agents once they have read `AGENTS.md`, `docs/GOVERNANCE.md`, this collaboration plan, and created or updated `docs/investigation/track1-claims.md`.

### 13.1 Pre-Approved Without Another Stop-Gate

- PR 1: patch field registry and classification test, with no runtime behavior change.
- PR 2: server-side diff utility, with no runtime behavior change.
- PR 4: eval harness, with no runtime behavior change and no model-dependent CI gate.
- PR 10: refresh instrumentation, debug-gated only and with no noisy default production logging.

### 13.2 Requires Explicit Sami Approval

Explicit approval is required before coding any work involving:

- telemetry schema or runtime changes
- prompt or interpreter contract rewrite
- AI edit routes
- entry-point UI
- venue or image edit wiring
- published-event gate
- migrations
- `web/src/app/api/events/interpret/route.ts`
- `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`
- production write behavior

Default rule: when in doubt, treat the PR as requiring approval.

### 13.3 Scope Creep Rule

Pre-approved means pre-approved only for the stated scope. If a cloud agent discovers that a pre-approved PR needs schema changes, new dependencies, runtime behavior changes, or edits to a locked file, stop and ask in the PR before continuing.

### 13.4 Blocked Rule

When blocked on a judgment call, open the PR as a draft with the question clearly stated in the description or a PR comment. Do not improvise.

### 13.5 Cloud Startup Defaults

- Claude Code web starts PR 1 only.
- Codex Cloud starts PR 4 only.
- Both agents must create or update the claims doc before their first implementation edit.
