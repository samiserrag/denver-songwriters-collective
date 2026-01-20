# Who's Next v0.1 Specification

- **Status**: Draft
- **Scope**: Side project only (separate product)
- **Dependencies**: References DSC shared-core primitives (guest verification + timeslot/waitlist concepts)
- **Date**: December 2024

---

## Part 1: DSC Reuse Audit

### Reusable Logic Patterns

| DSC Concept | Reusable As-Is | Reusable with Simplification | Do Not Reuse | Notes |
|-------------|----------------|------------------------------|--------------|-------|
| **Slot/Timeslot Model** | | Yes | | DSC ties slots to events with complex `event_timeslots` + `timeslot_claims` + profiles. Side project needs simpler: `slots` with position + participant reference. Remove profile FK, keep position/status/claimed_at. |
| **Waitlist Promotion** | Yes | | | Core algorithm is portable: on cancel/no-show, promote next waitlist entry by `waitlist_position`. Logic in `promoteWaitlist()` pattern is clean. |
| **"Now Playing" State** | Yes | | | `event_lineup_state` pattern (current_slot_index + updated_at) is minimal and correct. Direct reuse of concept. |
| **Slot Status Enum** | | Yes | | DSC uses `confirmed/waitlist/offered/cancelled/no_show/performed`. Side project needs subset: `confirmed/waitlist/cancelled/performed`. Drop `offered` (24h claim window is DSC-specific). |
| **Guest Verification Flow** | | Yes | | DSC's 6-digit code + JWT action token pattern is solid. Simplify: remove claim_id from token (side project has no member claims), keep email + event_id + action. |
| **Code Generation/Hashing** | Yes | | | `generateVerificationCode()` and `hashCode()` in `crypto.ts` are pure utilities. |
| **Rate Limiting Pattern** | Yes | | | 3 codes/email/hour, 5 attempts before lockout. Portable constants. |
| **Feature Flag Pattern** | Yes | | | `isGuestVerificationEnabled()` pattern for safe rollout. |
| **RSVP vs Slot Distinction** | | Yes | | DSC conflates RSVPs (capacity-based) with slots (position-based). Side project should cleanly separate: `event.type = 'lineup' | 'rsvp'`. |
| **Display Mode Polling** | Yes | | | 5-second polling for venue TV display is correct pattern. |
| **QR Code Integration** | | Yes | | DSC shows member profile QR. Side project: show event join URL QR instead. |
| **Fullscreen API Usage** | Yes | | | Browser fullscreen toggle is portable. |
| **Host Slot Actions** | | Yes | | Mark performed, mark no-show, add guest patterns are good. Remove "claim for member" (no members). |
| **One-Guest-Per-Event** | Yes | | | Constraint logic is portable: check existing claims by email within event timeslots. |

### DSC-Specific (Do Not Reuse)

| DSC Concept | Reason Not to Reuse |
|-------------|---------------------|
| **Profiles System** | Side project has no persistent identity. DSC profiles have roles, instruments, genres, collaboration prefs. |
| **Gallery/Albums** | Community content feature, not relevant to lineup tool. |
| **Blog System** | Community content feature, not relevant. |
| **Discovery/Search** | DSC has event discovery, venue search, member search. Side project is single-event focused. |
| **Admin Curation** | DSC has admin approval for hosts, content moderation. Side project is host-autonomous. |
| **Multi-Role Permissions** | DSC has fan/performer/host/studio/admin. Side project has host/participant only. |
| **Venue System** | DSC links events to venues with addresses. Side project: optional free-text location. |
| **Monthly Highlights** | Homepage curation feature, not relevant. |
| **Studio Bookings** | Unrelated feature. |
| **Favorites** | Persistent user preference, requires identity. |
| **Change Reports/Verifications** | Community moderation for event data accuracy. |
| **Supabase Auth** | Side project uses event-scoped tokens, not Supabase Auth users. |
| **RLS Policies** | DSC's RLS assumes authenticated users. Side project needs different access model. |

---

## Part 2: Side Project v0.1 Architecture Plan

### 1. App Scope

#### Supported Event Types

| Type | Description | Data Model |
|------|-------------|------------|
| **Lineup** | Ordered performance slots (open mics, showcases, comedy nights) | Slots with position, max capacity optional |
| **RSVP** | Limited seats, no order (workshops, circles, limited attendance) | Headcount with capacity cap |

#### Public Views

| View | Path | Description |
|------|------|-------------|
| Landing | `/` | Product info, "Create Event" CTA |
| Event Join | `/e/{code}` | Participant join page (name + optional email) |
| Live Lineup | `/e/{code}/lineup` | Current queue with positions |
| Display Mode | `/e/{code}/display` | TV-optimized view: Now Playing, Up Next, QR to join |

#### Host Controls

| Action | Description | Audit Logged |
|--------|-------------|--------------|
| Reorder | Drag slots to new positions | Yes |
| Mark Performed | Advance "Now Playing" | Yes |
| Mark No-Show | Remove + promote waitlist | Yes |
| Add Walk-up | Insert participant at position | Yes |
| Remove | Cancel a slot (with optional reason) | Yes |
| Export | Download participant list (opt-in emails only) | Yes |

### 2. Identity & Trust Model

#### Core Principles

1. **Event-scoped identity** — No global user table. Participant exists only within event context.
2. **Email is optional** — Participants can join with name only.
3. **Verification is lightweight** — 6-digit code via email, valid 15 minutes.
4. **No passwords** — Ever.

#### Two Email Paths

| Path | When | Data Lifecycle | Host Access |
|------|------|----------------|-------------|
| **Operational-only** | Participant provides email for notifications only | Auto-deleted after event + retention window | Never sees email |
| **Export-opted** | Participant explicitly consents to host export | Stored until export or retention window | Included in export CSV |

#### Identity Token Structure

```
participant_token = {
  event_id: uuid,
  participant_id: uuid,  // event-scoped, not global
  name: string,
  email_hash: string | null,  // for dedup, never stored raw
  export_consent: boolean,
  created_at: timestamp,
  expires_at: timestamp  // event end + retention window
}
```

#### Trust Guarantees

- Host cannot see emails unless participant opts in
- System cannot build email lists across events
- Retention is enforced by automated deletion job
- No admin override for retention bypass

### 3. Data Model (Conceptual)

#### Tables

```
events
├── id: uuid (PK)
├── host_token: string (secret, for host auth)
├── public_code: string (6-char, for join URL)
├── name: string
├── type: 'lineup' | 'rsvp'
├── capacity: int | null
├── slot_duration_minutes: int | null
├── starts_at: timestamp | null
├── location_text: string | null
├── settings: jsonb {
│     allow_waitlist: boolean,
│     require_email: boolean,
│     show_queue_position: boolean
│   }
├── current_slot_index: int | null  // "Now Playing"
├── created_at: timestamp
└── expires_at: timestamp  // auto-delete trigger

slots (for lineup events)
├── id: uuid (PK)
├── event_id: uuid (FK)
├── position: int
├── participant_id: uuid | null (FK)
├── status: 'open' | 'confirmed' | 'waitlist' | 'performed' | 'no_show' | 'cancelled'
├── waitlist_position: int | null
├── claimed_at: timestamp | null
└── performed_at: timestamp | null

rsvps (for rsvp events)
├── id: uuid (PK)
├── event_id: uuid (FK)
├── participant_id: uuid (FK)
├── status: 'confirmed' | 'waitlist' | 'cancelled'
├── waitlist_position: int | null
└── created_at: timestamp

participants_event (event-scoped identity)
├── id: uuid (PK)
├── event_id: uuid (FK)
├── name: string
├── email_hash: string | null  // SHA-256 for dedup
├── email_encrypted: bytea | null  // only if operational or export-opted
├── export_consent: boolean (default false)
├── verification_code_hash: string | null
├── verification_expires_at: timestamp | null
├── session_token: string  // for participant actions
├── created_at: timestamp
└── expires_at: timestamp

email_delivery_queue (short-lived)
├── id: uuid (PK)
├── participant_id: uuid (FK)
├── type: 'verification' | 'confirmation' | 'reminder' | 'promotion'
├── status: 'pending' | 'sent' | 'failed'
├── created_at: timestamp
├── sent_at: timestamp | null
└── expires_at: timestamp  // hard delete after 24h

host_audit_log
├── id: uuid (PK)
├── event_id: uuid (FK)
├── action: string  // 'reorder', 'remove', 'no_show', 'export', etc.
├── target_slot_id: uuid | null
├── details: jsonb
└── created_at: timestamp

exports_log (no emails stored)
├── id: uuid (PK)
├── event_id: uuid (FK)
├── exported_count: int
├── exported_at: timestamp
└── ip_hash: string  // for abuse detection
```

### 4. Security & Abuse Controls

#### Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Join event | 10 per IP per event | 1 hour |
| Request verification code | 3 per email per event | 1 hour |
| Verify code attempts | 5 per code | Until lockout |
| Create event | 5 per IP | 1 hour |
| Export | 3 per event | 24 hours |

#### Token Expiry Rules

| Token Type | Lifetime |
|------------|----------|
| Verification code | 15 minutes |
| Participant session | Event end + 24 hours |
| Host token | Event end + 7 days |
| Event data | Event end + retention window (default 7 days) |

#### Host Audit Log (Required)

All host actions are logged with:
- Timestamp
- Action type
- Target (slot/participant ID, anonymized)
- Before/after state where applicable

No admin override exists to bypass retention deletion.

#### Data Deletion Enforcement

- Cron job runs hourly
- Deletes events where `expires_at < now()`
- Cascade deletes: slots, rsvps, participants_event, audit_log
- email_delivery_queue has separate 24h TTL

### 5. UX Principles

#### Participant Join Flow

**Target: 2 taps maximum**

```
1. Scan QR or tap link → /e/{code}
2. Enter name → [Join] or [Join + Add Email]
   └── If email: inline verification (no page change)
3. Done → See position in queue
```

#### Display Mode (TV View)

| Requirement | Implementation |
|-------------|----------------|
| TV-readable | Large fonts, high contrast, minimal UI |
| Auto-refresh | 5-second polling (configurable) |
| QR always visible | Bottom-right corner, links to join page |
| Modes | Now Playing / Up Next / Full Queue (tab or URL param) |
| Fullscreen | One-click button, persists across refreshes |
| Offline tolerance | Show "Reconnecting..." with last known state |

#### Host UI

| Principle | Implementation |
|-----------|----------------|
| Large touch targets | Minimum 48x48px buttons |
| Minimal menus | Primary actions visible, secondary in overflow |
| Undo where safe | Reorder, remove (within 30s window) |
| Confirmation for destructive | No-show, export require tap-and-hold or confirm |
| Real-time sync | Optimistic UI with rollback on conflict |

### 6. Platform Recommendation

#### Web-First PWA (Recommended)

**Justification:**
- Lower friction: no app store download required
- QR → instant access for participants
- PWA covers offline basics (service worker cache)
- Host can "install" via Add to Home Screen
- Single codebase for all platforms
- Faster iteration for v0.1

**Tech Stack Suggestion:**
- Next.js (App Router) — SSR for SEO, RSC for performance
- Tailwind CSS — rapid UI development
- Supabase or PlanetScale — managed Postgres
- Vercel — deployment + edge functions
- Resend or Postmark — transactional email

#### Offline Tolerance

**Strategy: Cache + Retry**

- Service worker caches static assets + last event state
- Participant actions queue locally, retry on reconnect
- Host actions require connectivity (audit log integrity)
- Display mode shows cached state with "Last updated: X" indicator

#### Notification Channels

**Email-only default (v0.1)**

- Verification codes
- Slot confirmation
- "You're up next" reminder (optional)
- Waitlist promotion

**SMS deferred** — Adds cost, complexity, carrier issues. Revisit post-v0.1.

### 7. Open Decisions

| Decision | Options | Recommended Default | Notes |
|----------|---------|---------------------|-------|
| **Final name** | "Who's Next" / "Next Up" / "LineupQ" / "SlotSpot" | "Who's Next" | Friendly, clear purpose |
| **Retention window** | 24h / 3 days / 7 days / 14 days | **7 days** | Balances host needs (export window) with privacy |
| **"Continue as guest" toggle** | Default on / Default off | **Default on** | Lower friction; email optional by default |
| **SMS support** | v0.1 / v0.2 / Never | **Defer to v0.2** | Cost and complexity; validate email-only first |
| **Paid tier features** | Export / Analytics / Branding removal | **Export + Analytics** | One-time $12 unlocks both |
| **Free tier limits** | 20 slots / 50 slots / unlimited | **20 slots** | Enough for small open mic, upsell for larger |

---

## Part 3: Execution Order (Strict)

### Phase 0: Foundation (Week 1)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 0.1 | Project scaffold (Next.js + Tailwind + DB) | Dev environment works |
| 0.2 | Database schema migration | Data model is sound |
| 0.3 | Event creation (host flow) | Host can create lineup event |
| 0.4 | Host token auth (simple bearer) | Host can access their event |

### Phase 1: Core Lineup Flow (Week 2)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 1.1 | Participant join page (`/e/{code}`) | QR → Name → Slot works |
| 1.2 | Slot claiming (name only, no email) | Participants can join queue |
| 1.3 | Live lineup view | Participants see their position |
| 1.4 | Host reorder + remove | Host can manage queue |
| 1.5 | "Now Playing" advancement | Host can run the event |

**Milestone: Usable for a real open mic (paper backup ready)**

### Phase 2: Display Mode (Week 3)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 2.1 | Display page (`/e/{code}/display`) | TV view renders |
| 2.2 | Auto-refresh polling | Live updates without reload |
| 2.3 | QR code overlay | Participants can join from TV |
| 2.4 | Fullscreen mode | Clean TV presentation |

**Milestone: Venue can show lineup on TV**

### Phase 3: Email Verification (Week 4)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 3.1 | Optional email field on join | Participant can add email |
| 3.2 | Verification code generation + send | Email delivery works |
| 3.3 | Code verification flow | Participant verifies inline |
| 3.4 | Confirmation email | Participant gets receipt |

**Milestone: Email verification works end-to-end**

### Phase 4: Waitlist + Promotion (Week 5)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 4.1 | Waitlist when slots full | Overflow handled |
| 4.2 | No-show marking | Host can flag no-shows |
| 4.3 | Waitlist promotion | Next in line gets slot |
| 4.4 | Promotion notification email | Promoted participant notified |

**Milestone: Full lineup lifecycle works**

### Phase 5: RSVP Events (Week 6)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 5.1 | Event type toggle (lineup vs RSVP) | Both types supported |
| 5.2 | RSVP join flow | Headcount-based signup |
| 5.3 | RSVP capacity enforcement | Waitlist when full |
| 5.4 | RSVP cancellation + promotion | Same promotion logic |

**Milestone: Both event types work**

### Phase 6: Export + Audit (Week 7)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 6.1 | Export consent checkbox | Participant opts in |
| 6.2 | Host export (opted-in only) | CSV download works |
| 6.3 | Audit log capture | All host actions logged |
| 6.4 | Audit log view (host) | Host can see their actions |

**Milestone: Trust model enforced**

### Phase 7: Retention + Cleanup (Week 8)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 7.1 | Event expiration logic | Events auto-expire |
| 7.2 | Cascade deletion job | All event data deleted |
| 7.3 | Email queue TTL | Transient data cleaned |
| 7.4 | Retention configuration | Host can extend (paid) |

**Milestone: Privacy guarantees enforced**

### Phase 8: Polish + Launch Prep (Week 9-10)

| Step | Deliverable | Validates |
|------|-------------|-----------|
| 8.1 | PWA manifest + service worker | Installable, offline basics |
| 8.2 | Landing page | Product is discoverable |
| 8.3 | Payment integration (one-time) | Revenue works |
| 8.4 | Error handling + edge cases | Production ready |
| 8.5 | Beta test with real event | Validated with users |

**Milestone: Ready for public launch**

---

## Post-v0.1 Considerations (Out of Scope)

- SMS notifications
- Native mobile apps
- Multi-host events
- Recurring event templates
- Analytics dashboard
- Custom branding
- API for integrations
- Internationalization

---

## Summary

| Metric | Target |
|--------|--------|
| Time to v0.1 | 8-10 weeks |
| Core tables | 6 |
| API endpoints | ~15 |
| Pages | 5-6 |
| Reused DSC patterns | 10+ logic patterns |
| DSC code changes | 0 |
