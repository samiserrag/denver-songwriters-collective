# DSC UX Principles

> A living reference for product decisions, UX behavior, and system design across The Colorado Songwriters Collective.

**How to use this document:**
- Before any new feature: sanity-check against Sections 2, 4, 6, and 8
- When something feels "off": it will almost always violate one of the principles (especially dead states, preview mismatch, or mixed concerns)
- For repo-agent prompts: you can now say "must comply with DSC UX Principles" instead of restating intent every time
- In STOP-GATE reports: reference explicitly as "Checked against DSC UX Principles §X"

---

## 1. Primary Goal

**Prevent dead-ends. Preserve intent. Enable recovery.**

Every UX flow must satisfy:
- Users understand what will happen before they act
- Users can undo or recover from mistakes
- No action leaves data in an unrecoverable or unmanageable state

If a flow violates any of these, it is considered broken—even if technically functional.

---

## 2. Visibility vs Trust vs Lifecycle (Core Separation)

These concerns must never be conflated:

### A. Visibility

Controls whether something appears publicly.
- **Field(s):** `is_published`, `status`
- **Rule:** Public visibility must NEVER depend on verification state

### B. Trust / Confirmation

Controls user-facing confidence signals.
- **Field:** `last_verified_at`
- **Derived state:** Confirmed if non-null
- **Rule:** Confirmation affects badges only, not visibility

### C. Lifecycle

Controls whether an item is active, cancelled, duplicate, etc.
- **Field:** `status`
- **Rule:** Lifecycle states should be few, explicit, and boring

**If a feature mixes these layers, it will drift and cause bugs.**

---

## 3. Rolling Windows Must Be Explained

If the system limits what users see (e.g. rolling 90-day occurrence windows):
- The window must be visible in the UI
- The computed date range must be shown (e.g. Jan 24 – Apr 24)
- The rule must be consistent across:
  - Forms
  - Previews
  - Public pages

**Hidden constraints create support issues and user distrust.**

---

## 4. Centralize Logic, Never Rebuild It

If a concept exists in more than one place, it must be centralized.

**Examples:**
- Recurrence labels → `recurrenceContract.ts`
- Ordinal parsing → shared helpers only
- Occurrence expansion → single authoritative function

No UI component may reconstruct domain logic manually.

**If a component needs a value: It must import it, not infer it.**

---

## 5. Previews Must Match Reality

Anything labeled as a preview must:
- Use the same data shape as the real page
- Use the same formatting helpers
- Reflect the same confirmation/visibility rules

**If preview and reality diverge, previews lose trust and must be fixed immediately.**

---

## 6. Anchored Navigation Is Mandatory

When navigating from a specific instance (occurrence, photo, row):
- The destination must preserve context
- URLs must include anchoring parameters (e.g. `?date=YYYY-MM-DD`)

**Never rely on defaults when context is known.**

---

## 7. UX Friction Is a Tool (Use It Precisely)

Friction is appropriate only when:
- The action creates long-term consequences
- The user might not realize those consequences

Friction must be:
- **Contextual** (only when relevant)
- **Lightweight** (nudges > blocks)
- **Learnable** (one-time confirmations, dismissible warnings)

**Never punish experienced users.**

---

## 8. Dead States Are Unacceptable

Any state the system allows must also be manageable.

If users can create it, they must be able to:
- Edit it
- Move it
- Delete it

If management tools exist for admins, users should get equivalent tools for their own content unless there is a security reason not to.

---

## 9. Admin UX Exists to Repair, Not Control

Admin interfaces exist to:
- Fix legacy data
- Recover abandoned content
- Moderate bad actors

They should not be required for normal user workflows.

**If users are told to "use the admin panel," the UX is broken.**

---

## 10. Defaults Should Match the Common Case

Defaults should reflect what most users intend:
- New community-created events are confirmed by default
- Uploading photos usually belongs in an album
- Most series are ongoing, not capped

**Make edge cases possible—but not default.**

---

## 11. Prefer Soft Constraints Over Hard Rules

When possible:
- Warn instead of block
- Explain instead of enforce
- Offer recovery instead of prevention

Hard validation is reserved for:
- Data integrity
- Invariants
- Conditions that would corrupt the system

---

## 12. Test the Contract, Not the Implementation

Tests should assert:
- Invariants
- Inputs vs outputs
- Cross-surface consistency

Avoid tests that merely mirror implementation details.

**If a test breaks after a refactor but the contract still holds, the test is wrong.**

---

## 13. One Fix Per Phase

Each phase should:
- Solve one class of problems
- Close a loop completely
- Reduce future UX debt

**Avoid partial fixes that require follow-up patches.**

---

## 14. If Something Feels Confusing, It Probably Is

If you have to explain a flow verbally more than once:
- The UI is missing information
- Or the model is wrong

**Trust confusion as a signal—not a user failure.**

---

## 15. The North Star

> A songwriter should never wonder why something happened, where something went, or how to fix it.

If the system answers those three questions consistently, the UX is succeeding.

---

## Phase Examples (Reference)

| Phase | Principle Demonstrated |
|-------|------------------------|
| Phase 4.90 | §8 Dead States — Fixed unassigned photos dead-end |
| Phase 4.91 | §7 UX Friction — Added nudges for unassigned uploads |
| Phase 4.89 | §2 Visibility vs Trust — Confirmation separate from visibility |
| Phase 4.82 | §4 Centralize Logic — Override patch field propagation |
| Phase 4.83 | §4 Centralize Logic — Recurrence canonicalization |
| Phase 4.92 | §16 Ownership & Invites — Event invite primitives audit |

---

## 16. Ownership & Invitation Systems (Mandatory Checklist)

Any feature involving ownership, invites, claims, roles, delegation, approvals, revocation, or acceptance flows **must** follow the [Ownership & Invitation UX Checklist](ux/ownership-invitation-ux-checklist.md).

**Before implementation:**
1. Complete STOP-GATE 1 using the checklist's YES/NO matrix
2. Answer all STOP-GATE questions in the checklist
3. Document dead-ends and missing primitives
4. Only proceed to design after confirming primitives exist

**Key invariants:**
- Every invite/claim must have system-tracked status (no manual-email-only paths)
- Token-based invites store hash only; plaintext shown exactly once
- Acceptance must survive login/signup redirects (token in URL)
- Parallel ownership tracks (e.g., Events + Venues) are separate unless explicitly linked

**Reference:** Phase 4.92 investigation established this checklist after finding Events lacked all invite primitives that Venues had
