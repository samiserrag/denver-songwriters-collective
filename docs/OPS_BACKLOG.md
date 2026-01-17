# Ops & Admin Backlog

> **DEPRECATED** — This document has been merged into [docs/BACKLOG.md](./BACKLOG.md).
> See the canonical backlog for current status of all items.
>
> *Deprecated: 2026-01-16*

---

> ~~Deferred features and future work items. Updated as investigations complete.~~

---

## In Progress

### Events Ops Console v1 (Series + One-offs) + Occurrence Overrides CSV v1
**Status:** Approved, implementing
**Goal:** Enable admin to bulk manage seeded events and recurring series + per-date overrides

- Events CSV export/import (update-only, no verification timestamps)
- Overrides CSV export/import (create-or-update via upsert)
- Bulk actions: verify, unverify, status, event_type, venue_id
- Verification managed via UI buttons only (not CSV)

---

## Next Priority

### Host Attendee Messaging
**Status:** Approved as next after Events Ops v1
**Goal:** Allow hosts to send updates to RSVPs/performers for specific occurrences

Minimum viable:
- On occurrence detail page, host can "Send update to RSVPs / performers"
- System sends email to relevant users
- Message stored as public comment/update on that occurrence (visible to non-email recipients)
- Natural pairing with occurrence_overrides (same "specific date" mental model)

---

## Deferred (Future Phases)

### Venue Manager / Venue Claim System
- Allow venue representatives to claim their venue
- Venue profile management by venue owners
- Approval workflow for venue claims

### Enhanced Venue Profile Features
- Venue updates/announcements
- Venue invites to hosts
- Comments on venue pages
- API enrichments (Google Places, etc.)

### Full Happenings/Series Bulk Edit Workflows
- Beyond v1: more fields, more actions
- Series template editing
- Batch occurrence modifications

### Members Export/Import
- Member directory CSV export
- Profile bulk updates
- Role management via CSV

### Gallery Ops Console
- Bulk album/photo management
- Moderation workflows
- CSV export of gallery metadata

---

## Completed

### Venue Ops Console v1 (Phase 4.61)
**Completed:** January 2026
**Commit:** `ffc6d3a`

- Venue CSV export/import with preview diff
- Google Maps URL helper
- Validation library (venueValidation, venueCsvParser, venueDiff)
- 71 new tests
