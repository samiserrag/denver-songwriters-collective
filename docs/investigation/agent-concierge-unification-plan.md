# Agent Concierge Unification Plan

**Date:** 2026-05-01
**Status:** Investigation document for Codex collaborative review
**Authority:** Companion to `docs/investigation/track2-roadmap.md` and `docs/investigation/ai-event-ops-collaboration-plan.md`. Specifically scopes the unified-concierge sub-track that the roadmap §3 sub-track 2F introduced.
**Audience:** Codex (review + critique) + Sami (final approver) + future builders implementing the sub-PRs.

---

## 1. Why this exists

### 1.1 The product reframe (2026-05-01)

Sami articulated a strategic reframe today after live user testing of the AI edit experience:

> Lets focus on transforming our agent from creation only into a multipurpose agent that can handle editing and updating events as the main goal including edge cases and we need to give it its own page and also it should be able to cancel, but not delete events. It should confirm with a clear message. Also the UI needs to be updated around it to make it much better and clearer on what it can do, what the user should do, whats happening, and whats next, etc. It's the core product and the center of gravity of the entire website. It's essentially a hosts concierge to handle messy real world data input from a variety of sources including just a weblink and will know what to do with that info against the database with a human in the loop for final publish and available to answer questions on things the agent isn't certain on.

Translating: the host-side relationship and verified event graph are the durable product. The chat surface is the current interaction layer, and the model behind it will change over time; the moat is that hosts trust CSC to maintain their live event data and the public graph stays clean enough for humans and AI systems to rely on it.

### 1.2 The triggering evidence

A real host typed an update-shaped natural-language message — "The Recovery Cafe' open mic is now 4 to 7, still the first Friday each month." — into the create flow at `/dashboard/my-events/new/conversational`. The system correctly drafted a new event from the input, but the host's intent was to update an existing Recovery Cafe Longmont Open Mic event. The system has no path today for "I want to update an event but I'm not sitting on its detail page."

This is one observation. But it crystallized a long-running architectural observation:

> The agent capabilities are scattered across three URLs that share an implementation but force the user to navigate before getting help.

### 1.3 The scattering today

The existing codebase has a SINGLE component (`ConversationalCreateUI.tsx`) handling THREE distinct entry-point URLs via a `mode` prop:

| URL | Mode | Purpose | Shipped via |
|---|---|---|---|
| `/dashboard/my-events/new/conversational` | `create` | Draft new event from messy input | Original create flow |
| `/dashboard/my-events/[id]/ai` | `edit_series` | Edit an existing event series | Track 1 PR 6 (#129) |
| `/dashboard/my-events/[id]/overrides/[dateKey]/ai` | `edit_occurrence` | Edit a specific occurrence override | Track 1 PR 6 (#129) |

The component is unified at the implementation level — same React component, same chat surface, same telemetry, same gates. But the user-facing UX is split across three URLs. To use the agent, you must:

1. Decide upfront which mode you want (create vs edit-series vs edit-occurrence)
2. Navigate to the corresponding URL (and find the right event ID for edit modes)
3. Type your input

For a host with a clear single-mode intent and good URL discoverability, this works. For a host with a vague intent ("the Recovery Cafe thing changed") or one with many events, the URL-discovery step is friction — and the friction is exactly what the live testing surfaced.

### 1.4 What this document scopes

This investigation document scopes the unification work — collapsing the three URL entry points into one dedicated agent page that figures out mode dynamically based on input and matches against existing data, with cross-event find-and-edit, URL-input handling, AI cancel (NOT delete) with confirmation, and a UI overhaul so the agent's capabilities, the user's role, what's happening, and what's next are all clear at every moment.

This document does NOT scope:
- Track 2 §2A categories (separate sub-track)
- Track 2 §2B festivals (separate sub-track)
- Track 2 §2C performers (separate sub-track)
- Track 2 §2E recurring series matching (separate sub-track, but tightly coupled — see §6.3)
- Full URL Schedule Import pipeline (Track 2 §2D — but the agent calls into pieces of it)
- Symphony Phase 2 (different track)

---

## 2. Current state audit

### 2.1 What works today end-to-end

The agent can:

- **Create new events from messy input** at `/dashboard/my-events/new/conversational`. Source can be: free text, pasted flyer text, uploaded flyer image, structured field extraction, recurrence detection, venue resolution against the directory.
- **Preview proposed edits for existing event series** at `/dashboard/my-events/[id]/ai`. The route can interpret the requested series-wide change and show the proposed patch, including venue resolution and image cover switching, but existing-event AI writes are still locked.
- **Preview proposed edits for specific occurrences** at `/dashboard/my-events/[id]/overrides/[dateKey]/ai`. The route can interpret occurrence-scoped patches, but existing-event AI writes are still locked.
- **Ask one clarification question** when scope or content is ambiguous (PR 5 prompt rewrite).
- **Show "What changed"** field-level diff (PR 11 just shipped).
- **Distinguish result vs follow-up** visually (PR 11).
- **Capture telemetry** for every edit turn with turnId correlation between server emit and client accept/reject (PR 3 stack).
- **Hold the server-side published-event safety gate** (`ai_confirm_published_high_risk`) for future approved existing-event AI writes (PR 9 gate). That gate exists, but the shipped AI edit entry points are still preview/interpret-only until 2F.0 approves the write/apply unlock.

### 2.2 What does NOT work today

The agent CANNOT:

- **Apply existing-event AI edits from the AI edit pages.** `allowExistingEventWrites={false}` on the shipped AI edit routes and `canWriteExistingEvent` in `ConversationalCreateUI.tsx` keep existing-event AI apply locked until 2F.0 Concierge Write Gate Hardening is approved and implemented.
- **Find an existing event from free-text input.** No cross-event search; no entity matching; no "did you mean to update X?" disambiguation.
- **Mode-switch mid-conversation.** Once the user lands on a URL, the mode is fixed. If you start in create and realize you meant to edit, you must navigate.
- **Cancel an event.** Cancel exists in the manual EventForm flow, but the AI route does not call it. (Per Sami: lift, but explicitly NOT delete.)
- **Process a URL as input.** A weblink in the chat is treated as text; there's no JSON-LD harvest, no schedule scrape, no candidate extraction. (Track 2 §2D scopes the import pipeline; the agent should be able to call into pieces of it.)
- **Live as a top-level dashboard surface.** It lives behind three flow-specific URLs. There's no `/dashboard/agent` or equivalent.
- **Answer general questions about a host's events.** "When is the next open mic?" "Which of my events is in 30 days?" — the agent has no path to answer these without a specific event in scope.

### 2.3 What's split that should be unified

| Concept | Today | Unified target |
|---|---|---|
| Entry point | 3 URLs | 1 URL: `/dashboard/agent` (or chosen name) |
| Mode | Locked at URL load | Dynamic from input + match results |
| Default landing | "create something" | "tell me what you want to do, I'll figure it out" |
| Help text | Static per-flow | Dynamic per-stage of conversation |
| Capability discovery | Read the docs (or guess) | Agent surfaces capabilities in onboarding + on-demand |
| Cancel | Manual form only | Available via natural language, with confirmation |
| URL input | Treated as text | Recognized, dispatched, summarized |
| Cross-event Q&A | None | First-class capability |

---

## 3. Vision: the unified concierge

### 3.1 Mental model

The dashboard's center of gravity is a single chat surface. The host opens it and says (or pastes, or uploads) whatever they have. The agent figures out:

1. **What the user is trying to do** — create, update, cancel, ask, just-paste-this-URL-and-help-me-out.
2. **Which existing data this relates to** — if any. Cross-event match + venue match + series identity match.
3. **What action(s) to propose** — with clear "I'm going to do X" framing before any commit.
4. **What confirmation is required** — for high-risk fields on published events (PR 9 gate already), and for cancel (NEW per Sami).
5. **What to ask the user** — only when truly blocked.

The user always sees:
- **What the agent CAN do** — capabilities surface always-visible somewhere.
- **What the user is supposed to do RIGHT NOW** — clear next-step affordance.
- **What's happening** — assistant state (thinking, drafting, asking, applied) clearly communicated.
- **What's next** — preview of next action button, or "ready to publish" state.

The user is in the loop for final publish (already shipped via PR 9 gate + manual "Save and publish" button). The agent does NOT auto-publish.

### 3.2 Concrete user experiences

**Scenario A — the live testing scenario (cross-event find-and-edit):**

> Host opens `/dashboard/agent`. Types: "The Recovery Cafe' open mic is now 4 to 7, still the first Friday each month."
>
> Agent: "I think you mean to update the **Recovery Cafe Longmont — Open Mic** series (currently first Friday at 7–9 PM). Should I update that one, or create a new event?"
>
> Buttons: [ Update existing ] [ Create new ] [ Cancel ]
>
> Host clicks Update existing.
>
> Agent: "Got it. I'll update the start time to 16:00 and end time to 19:00 on Recovery Cafe Longmont — Open Mic. Recurrence stays first Friday monthly. Is that right?"
>
> Buttons: [ Yes, save ] [ Adjust before saving ] [ Cancel ]
>
> Host clicks Yes, save. This path is not enabled today; it becomes valid only after 2F.0 hardens the write gate and explicitly unlocks existing-event AI apply. After that approval, PR 9 gate fires (start_time + end_time are high-risk on a published event), the agent shows the published-risk confirmation panel, the host confirms, the patch applies, "What changed" diff shows the time change, and telemetry fires.

**Scenario B — URL input:**

> Host pastes `https://lostlake.com/events`.
>
> Agent recognizes URL. Fetches with robots.txt + rate-limit middleware (Track 2D.0.2). Tries JSON-LD harvest first (Track 2D.1.1). Returns: "I found 6 upcoming events on Lost Lake's calendar. 4 of them look like new events you don't have yet. 2 of them I think match your existing events but with updated info. Should I show them to you for review?"
>
> Buttons: [ Review the 6 ] [ Just show new ones ] [ Cancel ]
>
> Host clicks Review the 6. Agent surfaces a review UI (Track 2D.1.4) where each event is editable + accept/reject per row.

**Scenario C — cancel with confirmation:**

> Host: "Cancel the Tuesday open mic next week."
>
> Agent: "I think you mean to cancel the **Tuesday Open Mic at Lost Lake** scheduled for 2026-05-12. Is that right?"
>
> Host: "Yes."
>
> Agent: "Cancelling will hide this event from the public listing and send a cancellation notice to anyone who RSVP'd. The event row stays in the database (cancellation is reversible — you can restore it from the Cancelled tab). Should I cancel it?"
>
> Buttons: [ Yes, cancel and notify ] [ Yes, cancel without notifying ] [ Don't cancel ]
>
> Host clicks first option. Cancel applies. Telemetry. Done.

**Scenario D — Q&A on uncertain things:**

> Host: "Did I publish the Sunday acoustic night?"
>
> Agent: "Looking at your events… The **Sunday Acoustic Night at The Hideaway** is currently a draft (not published). Would you like me to publish it now?"
>
> Buttons: [ Yes, publish ] [ Show me the draft first ] [ Not now ]

**Scenario E — onboarding (first-time use):**

> Host opens `/dashboard/agent` for the first time.
>
> Agent: "Hi! I can help you create new events, update existing ones, cancel events, or pull events from a URL. What would you like to do?"
>
> Suggestion chips: [ Create a new event ] [ Update an existing event ] [ Pull events from a URL ] [ Cancel an event ]
>
> Host clicks one OR types free-form. Agent dispatches into the right mode dynamically.

### 3.3 What the agent does NOT do

Even in the unified concierge:

- **Does NOT auto-publish.** Final publish is always a human click (PR 9 gate + manual button).
- **Does NOT delete events.** Per Sami: cancel only. Delete is destructive and stays manual.
- **Does NOT mass-update without review.** Cross-event matching presents disambiguation; multi-event updates require explicit per-event confirmation.
- **Does NOT take actions on events the host doesn't have permission to edit.** Permission check on every match.
- **Does NOT hallucinate.** When uncertain, asks one targeted question. Never improvises a venue address, a date, or a price.

---

## 4. Architectural proposal

### 4.1 Surface architecture

**Today:**

```
/dashboard/my-events/new/conversational  ─┐
/dashboard/my-events/[id]/ai               ├─→ ConversationalCreateUI (mode prop)
/dashboard/my-events/[id]/overrides/[k]/ai ─┘
```

**Unified target:**

```
/dashboard/agent                              ─→ AgentConcierge component
  ├─ /dashboard/agent?event=[id]              ─→ same component, deep-link prefilled mode
  ├─ /dashboard/agent?event=[id]&date=[k]     ─→ same component, occurrence override prefilled
  └─ existing legacy URLs redirect to /dashboard/agent with appropriate query params
```

The legacy URLs continue to function (redirects), so existing entry points like the "Edit with AI" button on event detail pages still work. The dashboard navigation surfaces a top-level "Agent" or "Concierge" link that lands on `/dashboard/agent` with no preselected event.

### 4.2 Component architecture

`ConversationalCreateUI.tsx` is large and growing. The refactor introduces a clean boundary:

```
AgentConciergePage (new, /dashboard/agent route)
└── AgentConcierge (new, top-level component)
    ├── AgentChat (extracted from CRUI's chat-surface code)
    ├── AgentInputBar (extracted from CRUI's input area)
    ├── AgentCapabilitiesPanel (NEW — what-the-agent-can-do persistent surface)
    ├── AgentStateIndicator (NEW — what-is-happening + what-is-next surface)
    ├── AgentResultPanel (extracted from CRUI's host result panel, generalized)
    │   ├── WhatChanged (existing, from PR 11)
    │   ├── PublishedRiskConfirmation (existing, from PR 9)
    │   └── CancelConfirmation (NEW)
    └── AgentMatchCandidates (NEW — disambiguation UI for cross-event match)
```

`ConversationalCreateUI.tsx` becomes a thin compatibility wrapper that mounts `AgentConcierge` with mode-locked props for the legacy URLs. After the unification ships and the legacy URLs are deprecated, the wrapper goes away.

### 4.3 State machine

The agent's mode is no longer a URL prop — it's a property of the conversation state:

```
mode: "discover" | "create" | "edit_series" | "edit_occurrence" | "cancel" | "url_import" | "qa"

state machine:
  start → discover (default)
  discover → [create | edit_* | cancel | url_import | qa] based on first input + match results
  create → create (drafting)
       → edit_* (if user accepts cross-event match)
  edit_* → edit_* (refining)
        → cancel (if user asks to cancel during edit)
  url_import → [individual review of candidates] → [bulk create / bulk edit / mixed]
  qa → discover (after answering)
  any → cancel (with explicit cancel intent)
  any → published-risk-confirmation gate (when high-risk fields touched on published event)
```

The state machine runs client-side. The server remains stateless per-request; mode is passed in each call. This preserves the existing telemetry contract (each turn emits an `EditTurnTelemetryEvent` with the current mode).

### 4.4 Server endpoints

Existing:
- `POST /api/events/interpret` — interpret request, returns draft / clarification (Track 1 PR 5)
- `PATCH /api/my-events/[id]` — manual/server patch path with PR 9 gate support. Existing-event AI apply remains disabled until 2F.0.
- `POST /api/my-events/[id]/overrides/[date]` — manual/server occurrence override path. Existing-event AI apply remains disabled until 2F.0.
- `POST /api/my-events` — create new event (existing)
- `POST /api/events/telemetry/edit-turn` — outcome ping (Track 1 PR 3 follow-up)

New:
- `POST /api/events/agent/find-candidates` — given free-text input, return ranked candidate events for the user (Track 2 §2F.2 search backend)
- `POST /api/my-events/[id]/cancel` — cancel an event (NEW; or extend existing PATCH with a cancel verb)
- `POST /api/events/agent/url-extract` — given a URL, harvest JSON-LD + sanitize HTML + return parsed candidates (Track 2 §2D pieces, called by the agent)
- `POST /api/events/agent/answer` — given a Q&A intent, return an answer about the host's events (NEW, lighter than interpret)

### 4.5 Telemetry extension

PR 3 stack already covers create + edit turns. Extend for the new modes:

- New mode values in `EditTurnTelemetryEvent.mode`: add `"discover"`, `"cancel"`, `"url_import"`, `"qa"`
- New telemetry event type: `AgentModeSwitchEvent { fromMode, toMode, trigger, turnId }` for tracking discover → edit transitions
- Extend `userOutcome` to include `"cancelled_by_user"` (separate from `"rejected"`) for canceled actions

### 4.6 Cancel implementation specifics

Per Sami's vision:

- **Cancel only — never delete.** No row removal. Status change to `cancelled`, `cancelled_at` timestamp, optional `cancel_reason`.
- **Clear confirmation message.** Two-stage: first "I think you mean X — confirm?" then "Cancelling will [consequences]. Proceed?". Two button clicks before commit.
- **RSVP notification choice.** If the event has RSVPs, ask whether to notify them.
- **Reversible.** PR 4.28 added restore for never-published events. For previously-published events that were cancelled, restore is also reversible. Surface this in the confirmation copy: "you can restore from the Cancelled tab."
- **Tests must cover:**
  - Cancel applies the right status change and clears nothing else
  - Cancel does NOT happen without explicit confirmation
  - Cancel does NOT happen on events the user lacks permission to manage
  - Cancel emits telemetry with the new outcome value
  - Restore-after-cancel works end-to-end via the agent

### 4.7 URL input implementation specifics

The agent recognizes URLs in free-text input and dispatches to a URL-extract path. This path is a slim wrapper around Track 2D pipeline pieces:

1. **Recognize URL:** detect `https?://` in input, extract the URL.
2. **Robots.txt + rate limit:** check (Track 2D.0.2 middleware).
3. **JSON-LD harvest first:** parse Schema.org Event microdata (Track 2D.1.1).
4. **HTML sanitize fallback:** if no JSON-LD, sanitize HTML and try LLM extraction (Track 2D.0.3 + 2D.2.1). Lower confidence; require review.
5. **Per-candidate dedup:** for each candidate, run cross-event match against host's existing events (Track 2 §2F.2 search backend). Return create-vs-update suggestions.
6. **Surface review UI:** `AgentMatchCandidates` component renders the candidates with per-row actions.

This means the agent is the **first user-visible feature of the URL Schedule Import pipeline**. Track 2D.0–2D.1 is required infrastructure for the agent. The two sub-tracks merge or sequence carefully.

---

## 5. Sub-PR sequence

Numbered as Track 2 §2F.* and §2G.* and §2H.* (per the roadmap framing). Investigation-only PRs first, then code.

### 5.0 Mandatory prerequisites before unification work

**2F.0 — Concierge Write Gate Hardening ADR.** This is the first 2F PR and a hard prerequisite before any existing-event AI write/apply unlock. It locks the server-side write boundary: LLM output is untrusted, the server decides what can be written, high-risk published changes still require explicit confirmation, every write path has audit/rollback affordances, and the kill switch (`ENABLE_AGENT_WRITE_APPLY` or the final approved name) defaults to off. Until 2F.0 is approved and implemented, the unified concierge may interpret and preview existing-event patches but must not apply them.

**CRUI landmine audit.** Before extracting components from `ConversationalCreateUI.tsx`, ship or attach a focused investigation note that inventories the component's implicit state and side-effect boundaries: create vs edit mode defaults, `allowExistingEventWrites`, `canWriteExistingEvent`, draft save/publish paths, edit-turn telemetry capture, image-reference handling, published-risk confirmation, host/lab route differences, and source-text tests that are currently standing in for fuller RTL coverage. The output is a checklist for G.4/G.5/G.6 so "zero behavior change" is testable rather than assumed.

### 5.1 Investigation phase (stop-gates)

**G.1 — Agent Concierge architecture ADR.** Investigation-only. Decisions to lock:

- Surface URL: `/dashboard/agent` vs `/dashboard/concierge` vs `/dashboard/host` vs other
- Component extraction strategy: hard refactor vs progressive (legacy URL wrappers)
- Permissions model: cross-event search scoped to "events I host" vs "events I have permission to manage"
- State machine details: which transitions are allowed, which are blocked
- Telemetry schema additions
- Cancel UX exact copy and confirmation flow
- URL input UX exact flow

Stop-gate before any code.

**F.1 — Cross-event search backend ADR.** Investigation-only (already scoped in roadmap). Decisions to lock:

- Search strategy: deterministic keys vs LLM vs hybrid
- Confidence threshold for auto-propose vs ask
- Multi-match disambiguation UX
- Update-shape detection signals
- Eval harness fixtures for matching

Stop-gate before search backend code.

### 5.2 Backend foundations

**F.2 — Search backend implementation.** `findUserEventCandidates(freeText, userId, opts)` library function. Pure backend, tests, no UI. Per the roadmap.

**G.2 — Cancel endpoint and helper.** Backend support for AI-driven cancel. Per §4.6 specifics. Tests cover permission, confirmation contract, telemetry.

**G.3 — URL extract endpoint and harvester.** Backend support for URL input. JSON-LD harvest + HTML sanitize. Tests cover known good URLs, malformed inputs, robots.txt compliance.

### 5.3 Component extractions (no behavior change)

**G.4 — Extract `AgentChat` from CRUI.** Lift the chat-surface rendering into its own component with a clean prop interface. CRUI continues to mount it; legacy URLs still work. Tests confirm zero regression.

**G.5 — Extract `AgentInputBar` from CRUI.** Same pattern. Lift the input area.

**G.6 — Extract `AgentResultPanel` and `WhatChanged` integration.** Generalize the result panel beyond create/edit; allow it to render cancel-confirmation and url-import-review variants.

### 5.4 New unified surface

**G.7 — Add `AgentConcierge` component and `/dashboard/agent` route.** The new top-level page mounting the extracted components. Defaults to discover mode; routes legacy URLs through the same component via query params.

**G.8 — Add `AgentCapabilitiesPanel`.** Persistent surface listing what the agent can do, with onboarding-style chips for first-time users.

**G.9 — Add `AgentStateIndicator`.** Visible "what's happening / what's next" surface that updates per turn. Coordinates with existing waiting state and PR 11's distinct result/follow-up panel.

### 5.5 Cross-event find-and-edit wiring

**F.3 — Scan-first step in `AgentConcierge` create mode.** Per the roadmap.

**F.4 — Disambiguation UI (`AgentMatchCandidates`).** Per the roadmap.

**F.5 — Mode-switch flow with state preservation.** Per the roadmap.

### 5.6 Cancel wiring

**H.1 — Cancel intent detection and dispatch.** Agent detects cancel-shaped input ("cancel the Tuesday show", "we're not doing the open mic this week"). Dispatches to find-candidates first if event isn't already in scope.

**H.2 — `CancelConfirmation` component and flow.** Two-stage confirmation per §4.6. RSVP notification choice if applicable.

**H.3 — Cancel telemetry and outcome.** Extend telemetry to capture cancel events distinctly from edit events.

### 5.7 URL input wiring

**G.10 — URL recognition in input.** Detect URLs in user messages, dispatch to G.3 endpoint.

**G.11 — URL candidate review UI.** Surface harvested candidates with per-row create/update/skip choices.

**G.12 — Bulk apply with mixed actions.** Support "create these 3, update these 2, skip these" as a single submit.

### 5.8 Q&A and polish

**G.13 — Q&A intent detection and answer endpoint.** Lighter-weight than interpret; handles "when is X" / "did I publish Y" / "what's coming up". Read-only.

**G.14 — Capabilities discovery and onboarding.** First-time-use experience; in-chat hints for capability discovery.

**G.15 — UI clarity overhaul.** Final polish pass on copy, spacing, color, motion. Probably analogous to Track 1 PR 11 but for the unified surface.

### 5.9 Eval harness extensions

**F.6 — Eval fixtures for cross-event match.**
**G.16 — Eval fixtures for URL extract and Q&A.**
**H.4 — Eval fixtures for cancel intent recognition.**

### 5.10 Total estimate

~30 PRs across §F + §G + §H. Some can ship in parallel after the ADR phase. First user-visible milestone is G.7 (agent page + dispatch). Most-impactful single PR is F.3 (scan-first step that resolves the live testing scenario).

---

## 6. Risks and open critique points (FOR CODEX REVIEW)

### 6.1 False-positive blast radius (highest)

> If the agent confidently misidentifies an event and the user clicks "yes update it", the wrong event gets edited. PR 9 gate requires confirmation only for high-risk fields on PUBLISHED events; for low-risk fields or unpublished events, a single misclick can apply a wrong patch.

**Mitigations proposed:**
- High confidence threshold (probably 0.85+) before auto-propose
- Always show event title + venue + date prominently in the disambiguation step
- "Show me the event before applying" affordance always available
- Telemetry on user accept/reject ratio per match-confidence bucket; if accept-rate-after-match drops, raise threshold
- Audit log: every cross-event match decision logged with input + candidates + chosen + outcome

**Codex critique invited:** is this enough? Should there be a one-click rollback after apply? Should the agent never auto-propose for users with > N events (where higher event count = higher misclassification risk)?

### 6.2 Cancel UX — false intent

> User says "cancel" in the middle of a different conversation. Agent thinks they want to cancel an event. Wrong action.

**Mitigations proposed:**
- Strong intent detection: cancel-shaped phrases ("cancel the X", "we're cancelling Y", "X isn't happening") not just "cancel"
- Always show event title + date in confirmation
- Two-stage confirmation (per §4.6)
- Reversible (cancel → restore via Cancelled tab)

**Codex critique invited:** is the "cancel/discard" word ambiguity going to bite us? E.g., "cancel my changes" vs "cancel the event" — how does agent disambiguate?

### 6.3 Coupling to Track 2 §2E series matching and §2D URL import

> 2F's match quality improves dramatically with §2E series identity work. URL input depends on §2D pipeline pieces. The unified concierge can't be built in isolation.

**Mitigations proposed:**
- Sequence §2E.1 (series identity audit) before §2F.2 (search backend) so search uses series identity hashes
- Sequence §2D.0 + §2D.1 (foundations + JSON-LD harvest) before §2G.10 (URL recognition)
- Build the agent to gracefully degrade: if series identity isn't available, fall back to event-level match; if URL extract isn't available, prompt user to paste text

**Codex critique invited:** is this acceptable, or should we pause §F/G/H until §2E and §2D foundations land?

### 6.4 Component extraction churn

> Lifting `AgentChat`, `AgentInputBar`, `AgentResultPanel` out of `ConversationalCreateUI.tsx` is a major refactor that risks breaking the existing flows during transition.

**Mitigations proposed:**
- Each extraction is its own PR with zero behavior change as the explicit acceptance criterion
- Existing tests on `ConversationalCreateUI.tsx` (the source-text assertion suite from PR 11) must remain green at every step
- Extractions are sequenced so the flow continues working at every commit
- New tests added per extracted component (real-render RTL where the component is small and isolated)

**Codex critique invited:** is the progressive-extraction approach right, or should we do a big-bang refactor with feature-flag rollback?

### 6.5 Confirmation friction

> If the agent asks "did you mean X?" on every input, the create flow becomes worse than today.

**Mitigations proposed:**
- Update-shape detection: only run scan-first when input has update-shaped signals ("is now", "moved to", "the [thing]" with definite article + venue match)
- Pure create-shaped input (no existing-venue mention, no recurrence reference, no time-change phrase) bypasses scan
- Telemetry on scan-first hit rate; tune threshold over time

**Codex critique invited:** what's a defensible default scan-first heuristic for v1?

### 6.6 Q&A scope creep

> "Answer questions" is open-ended. Today the interpret prompt is event-shaped. Q&A could grow to "what should I do about my dropping attendance?" — well outside event ops.

**Mitigations proposed:**
- Q&A endpoint is event-data-only: answers questions about the host's existing events (counts, dates, statuses) but doesn't editorialize
- Out-of-scope questions get a clear "I can help with your events; for X you'd need..." response
- Specific Q&A templates: "when is X", "is X published", "what's next", "show me X"
- Free-form Q&A is a Phase 2

**Codex critique invited:** is Q&A worth shipping in v1, or should we defer it to Phase 2?

### 6.7 URL input safety

> Fetching arbitrary URLs from user input is a real attack surface. Phishing pages, malformed HTML, large documents, slow servers, captive portals.

**Mitigations proposed:**
- robots.txt enforcement (Track 2D.0.2)
- Per-host rate limits
- Response size cap (e.g., 5 MB)
- Timeout (e.g., 10s)
- Sanitize HTML aggressively before any extraction
- JSON-LD path is preferred (deterministic, no LLM in the loop)
- LLM extraction path requires review-UI before any apply

**Codex critique invited:** is the safety floor strong enough? Should we maintain a host allow-list for URL input, at least initially?

### 6.8 Permission model complexity

> Cross-event search needs to know which events the user can edit. Today the events table has multiple ownership/permission paths (host_id, cohost relationships, admin role, organization membership).

**Mitigations proposed:**
- Reuse existing `canManageEvent()` helper from `web/src/lib/events/eventManageAuth.ts`
- Search returns only events that pass `canManageEvent()` for the requesting user
- Admin users get all events (existing behavior)
- Tests cover: regular host, cohost, admin, org member, denied user

**Codex critique invited:** any permission edge cases I'm missing?

### 6.9 Telemetry volume

> Adding `AgentModeSwitchEvent` + extending mode enum + new outcome values increases telemetry volume. Axiom retention costs.

**Mitigations proposed:**
- console.info sink already drains to Axiom; no new infra
- New events are correlation-only (small payload)
- Mode-switch events fire only on actual transitions (rare per session)

**Codex critique invited:** acceptable, or should we sample mode-switch events?

### 6.10 Disintermediation risk

> If consumer-side AI agents answer "what's happening tonight?" directly, CSC can lose destination traffic even if its event data is good. A chat UI alone does not defend against that shift; any model provider can copy the interaction pattern.

**Mitigations proposed:**
- Treat the durable asset as the host relationship plus verified event graph, not the current chat UI or model layer.
- Sequence 2I public-source optimization after the security ADR phase so external AI systems cite CSC's clean structured data instead of bypassing or misquoting it.
- Preserve stable public URLs and cancellation semantics so AI agents propagate current truth, including cancellations, rather than stale scraped copies.
- Use the concierge to make host maintenance easier than competing platforms; fresher source data is the part consumer AI cannot synthesize on its own.

**Codex critique invited:** does the concierge roadmap sufficiently feed 2I and 2J, or should 2I citation-stability work move earlier once 2I.0 lands?

---

## 7. Open questions for Codex

In addition to the critique points above, please respond on:

1. **Does the architectural proposal in §4 hold up?** Specifically the state machine, the component extraction sequence, the server endpoint additions.
2. **Are there sub-PRs missing from §5?** What did I overlook?
3. **Ordering is now constrained by the merged Track 2 roadmap.** Phase 5.0 housekeeping and the security ADR phase come first. For this concierge plan, 2F.0 Concierge Write Gate Hardening must precede any existing-event AI apply unlock; 2J.1 Safe URL Fetcher must precede URL-paste fetching; 2L.1 BOLA/RLS/service-role audit should run in parallel with endpoint work; then proceed through 2F ADRs and the CRUI landmine audit before G.4/G.5/G.6 component extraction. §G route/UI work can start only after the relevant ADRs release the locked surfaces; §H cancel work is exact-context first and write-gated by 2F.0.
4. **What's a defensible MVP?** If we had to ship the smallest possible version of "the agent is the product center of gravity", which sub-PRs would compose it?
5. **What existing code paths do I underestimate?** Lifting from `ConversationalCreateUI.tsx` is going to surface assumptions I haven't seen. Where are the landmines?
6. **Eval harness scaling.** PR 4 eval harness covers create + edit cases. Adding cancel + URL + cross-event match + Q&A — is the harness shape right, or do we need a different evaluation framework for the unified concierge?
7. **Any dissent on the strategic frame?** The sharper frame is: the host relationship plus verified event graph are the durable product; the chat UI and model layer are replaceable interfaces over that asset. If you disagree, say so with evidence. Default agreement without evidence is a governance violation per the GOVERNANCE.md Subordinate Architect Review Mode rule.

---

## 8. Definition of Done

The unified concierge is "broad live use" complete when:

- `/dashboard/agent` is the documented top-level entry point.
- Legacy URLs (`/dashboard/my-events/new/conversational`, `/dashboard/my-events/[id]/ai`, `/dashboard/my-events/[id]/overrides/[k]/ai`) redirect to `/dashboard/agent` with appropriate query params.
- The agent handles all five modes from §3.2 scenarios: create, find-and-edit, URL input, cancel, Q&A.
- Existing-event AI apply is unlocked only after 2F.0 write-gate hardening is approved and implemented; before that, existing-event AI paths remain interpret/preview-only.
- Cancel flow has two-stage confirmation, never deletes, surfaces RSVP notification choice when applicable.
- URL input handles JSON-LD-friendly URLs deterministically; LLM-fallback URLs go through review UI.
- Cross-event match has telemetry; accept rate is monitored; threshold is tunable.
- The agent's capabilities, the user's role, what's happening, what's next are clear at every conversation stage.
- All existing CRUI behavior (create flow, edit flow, occurrence override flow) continues working through the legacy URL redirects.
- All Track 1 contracts preserved: published-event gate (PR 9), patch-only edits (PR 5), telemetry stack (PR 3), what-changed diff (PR 11).

---

## 9. Pre-approved remote work pattern

Per `docs/investigation/track2-roadmap.md` §10:

### 9.1 Pre-approved without another stop-gate

- Investigation documents (this file, ADRs in §5.1)
- Eval harness extensions (no runtime behavior change)
- Component extractions with zero behavior change (PRs G.4, G.5, G.6)

### 9.2 Requires explicit Sami approval

- 2F.0 Concierge Write Gate Hardening ADR approval before any existing-event AI write/apply unlock.
- All new endpoints (G.2, G.3, F.2 search backend, agent answer endpoint)
- All new public routes (`/dashboard/agent`)
- All UI changes touching ConversationalCreateUI.tsx (still §8.2 locked) — every component extraction needs lock release
- All schema changes (none currently planned for §F/G/H, but watch for it)
- Cancel implementation (G.2 + H.1 + H.2)
- URL input implementation (G.3 + G.10 + G.11)

### 9.3 Scope creep rule

Pre-approved only for stated scope. Mid-PR expansion → stop and ask.

### 9.4 Blocked rule

When blocked → draft PR with question. Don't improvise.

---

## 10. First concrete actions (after this doc lands)

In order:

1. **Codex reviews this document.** Raises critique points per §6 and §7. Dissent welcomed.
2. **Sami responds to Codex's critique.** Locks decisions or asks for revision.
3. **2F.0 — Concierge Write Gate Hardening ADR.** Investigation-only PR. Locks the write boundary and keeps existing-event AI apply disabled until approved follow-up implementation.
4. **G.1 — Agent Concierge architecture ADR.** Investigation-only PR. Locks the surface URL, component extraction strategy, permissions model, state machine details, telemetry schema additions, cancel UX, URL input UX.
5. **F.1 — Cross-event search backend ADR.** Investigation-only PR (already scoped in roadmap). Stop-gate before search backend code.
6. **CRUI landmine audit.** Investigation-only or attached to G.1. Produces the checklist required before component extraction.
7. **First implementation PR is whichever approved ADR releases a safe zero-behavior-change surface.** Probably G.4 (extract `AgentChat`) only after the landmine audit makes the no-regression checklist explicit.

---

## 11. Document maintenance

This document is living. Update when:

- Architectural decisions in §4 change (state machine, component boundaries).
- Sub-PR sequence in §5 reorders.
- Risks in §6 are resolved or new ones surface.
- Codex critique adds new questions or invalidates existing assumptions.

Update protocol: small additive edits via coordinator PR. Larger structural changes via stop-gate review.

---

**End — Agent Concierge Unification Plan v1.0**
