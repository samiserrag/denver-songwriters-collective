

# THE DENVER SONGWRITERS COLLECTIVE (DSC) — AI CONTEXT FILE (ACTIVE)

This file provides unified context for Claude Code, GPT‑5.1 Codex‑Max (external), and any other AI assistants used for The Denver Songwriters Collective development.

## BRAND INFORMATION
- **Full Name:** The Denver Songwriters Collective
- **Short Name:** DSC
- **Tagline:** "Find your people. Find your stage. Find your songs."
- **Previous Name:** Open Mic Drop (deprecated)

## 1. CURRENT DEVELOPMENT ENVIRONMENT

- You are working inside VS Code.
- Claude Code (official Anthropic extension) is installed and active.
- Continue.dev is **not** being used as the primary tool.
- GPT‑5.1 Codex‑Max cannot run inside Continue; use ChatGPT for architecture only.
- Local coding agent = **Claude Code**.
- Anthropic API key is already added in VS Code → Settings → Extensions → Claude → API Key.

## 2. REPO STRUCTURE (IMPORTANT)

Your active repo is:

```
/Users/samiserrag/Documents/GitHub/denver-songwriters-collective
```

The `.continue/` folder exists but **is not the active agent** and can be ignored unless a future migration is needed.

All context files must live directly inside the repo root.

## 3. ACTIVE CONTEXT FILES

Claude Code should load from:

- `scaffold.md`
- `global-rule.md`
- `DSC_AI_CONTEXT.md` (this file)

## 3.1 MULTI‑AI REVIEW PROTOCOL

The Denver Songwriters Collective uses a 3‑AI architecture:

- **Claude Code** → local coding, diffs, Supabase SQL generation.
- **ChatGPT (GPT‑5.1 Codex‑Max)** → architecture, planning, high‑level decisions.
- **Gemini 3.0** → validation & safety review of schema, RLS, booking logic, and any critical system behaviors.

RULE:
For all major backend changes (schema, RLS, RPC functions, booking logic), Claude Code must generate the implementation and **Gemini must review** before anything is executed or committed.

Gemini review prompt template:
"Review this schema/RLS/RPC logic for security, correctness, conflict‑risk, and adherence to multi‑actor behavior. Identify vulnerabilities or edge cases."

## 3.2 PHASE 1 — RLS SPEC (IMPLEMENTATION GUIDELINES)

This section defines the Row Level Security requirements for all core tables.
Claude Code will generate `supabase/rls_phase1.sql` from this spec. Gemini must review it before execution.

### GLOBAL RLS RULES
- RLS must be enabled on all custom tables.
- Admin = full access to all tables.
- Users may only modify records they own.
- Public may read events, slots, spotlights, and studio services.
- All permission checks must use `auth.uid()` and joins to `profiles`.

---

### 1. profiles
Users may read/update **their own profile**. Admins may read/write all.

Policies needed:
- select_own_or_admin
- update_own
- insert_self
- admin_full_access

---

### 2. events
Public can read all events. Only the host (or admin) can insert/update/delete.

Policies needed:
- public_read_events
- host_manage_own
- admin_full_access

---

### 3. event_slots
Public can read all slots.
Performers may claim an open slot by setting performer_id = auth.uid().
Hosts/admins may edit or lock slots.

Policies needed:
- public_read_slots
- performer_claim_self
- host_manage_event_slots
- admin_full_access

---

### 4. studio_services
Public may read all services.
Studios may modify their own services.
Admins have full access.

Policies needed:
- public_read_services
- studio_manage_own_services
- admin_full_access

---

### 5. studio_appointments
Performers may read/update/delete their own appointments.
Studios can read/manage appointments for their own services.
Admins have full access.

Policies needed:
- performer_see_own
- studio_view_own_appointments
- studio_manage_status
- admin_full_access

---

### 6. spotlights
Public may read spotlight history.
Only admins may write.

Policies needed:
- public_read_spotlights
- admin_manage_spotlights

---

### IMPLEMENTATION NOTE FOR CLAUDE CODE
All RLS SQL must follow this format:
1. `alter table ... enable row level security;`
2. `create policy ... on ... for select using (...);`
3. `create policy ... on ... for insert with check (...);`
4. `create policy ... on ... for update using (...) with check (...);`
5. `create policy ... on ... for delete using (...);`

Gemini must review the resulting SQL before any execution.

END OF RLS SPEC.

## 4. HIGH‑LEVEL ARCHITECTURE

The Denver Songwriters Collective is built as:

- **Next.js 15 app router**
- **Supabase (DB + Auth + Edge Functions)**
- **Tailwind + shadcn/ui**
- **Expo React Native app (later phase)**

Key features:

- Event discovery
- Booking / slot management
- Showcase system
- Performer profiles
- Studio integrations
- Spotlight system
- Admin dashboard
- Multi‑city support

## 5. AGENT RULES (FOR CLAUDE CODE)

- Produce **precise, atomic diffs** only.
- Ask before modifying schema, RLS, or Supabase config.
- Never invent files—use real file structure.
- Use scaffold.md as the source of truth.
- Do not change environment files without explicit approval.

## 6. WORKFLOW

### Architecture / planning  
→ Handled by GPT‑5.1 Codex‑Max in ChatGPT.

### Implementation / coding  
→ Handled by Claude Code in VS Code.

### Supabase queries & RLS  
→ Generated by Claude Code, then pasted manually into the Supabase SQL editor.

## 7. PENDING TODO

- Clean stale `.continue/` folder later.
- Add Supabase schema (Phase 1).
- Add booking logic.
- Add RPC functions.
- Add RLS policies.
- Add actor flows.

End of context file.