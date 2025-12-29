# Legacy Test Suite (Archived)

> **Archived:** December 2025
> **Reason:** Schema mismatch with current DSC implementation

---

## Why Archived

This test suite was written for an earlier "Open Mic Drop" schema that differs significantly from the current Denver Songwriters Collective implementation.

**DO NOT run these tests against the current database** — they will fail or potentially corrupt data.

---

## Schema Conflicts Found

### 1. Slot/Timeslot Model

| Legacy Schema | Current DSC Schema |
|---------------|-------------------|
| `event_slots` table | `event_timeslots` + `timeslot_claims` tables |
| `performer_id` on slot | `member_id` or `guest_name` on claim |
| Direct slot assignment | Claim-based with status tracking |

### 2. Role Model

| Legacy Schema | Current DSC Schema |
|---------------|-------------------|
| `performer` role | `member` role + identity flags |
| `host` role | `member` role + `is_host` flag |
| `studio` role | `member` role + `is_studio` flag |
| `admin` role | `admin` role (unchanged) |

### 3. Event Structure

| Legacy Schema | Current DSC Schema |
|---------------|-------------------|
| `is_showcase` boolean | `event_type` enum |
| `host_id` on event | `created_by` + RLS policies |
| Simple slots | Timeslots with claims + waitlist |

### 4. Studio Booking

| Legacy Schema | Current DSC Schema |
|---------------|-------------------|
| `studio_services` table | Different structure |
| `studio_appointments` table | Not yet implemented |

---

## Reusable Components (Migrated)

The following schema-independent utilities were migrated to `web/src/__tests__/utils/`:

| Original File | Migrated To |
|---------------|-------------|
| `utils/datetime.test.ts` | `web/src/__tests__/utils/datetime.test.ts` |
| `utils/index.ts` | `web/src/__tests__/utils/test-helpers.ts` |

These utilities handle:
- Time formatting and parsing
- UUID generation
- Async retry logic
- Concurrency helpers
- Assertion utilities

---

## Test Categories (Not Migrated)

### RPC Tests (`rpc/`)
- `claim-slot.test.ts` — Uses `event_slots` table
- `unclaim-slot.test.ts` — Uses `event_slots` table
- `get-available-slots.test.ts` — Uses `event_slots` table
- `set-showcase-lineup.test.ts` — Uses `is_showcase` flag
- `book-studio.test.ts` — Uses legacy studio schema
- `concurrency.test.ts` — Uses `event_slots` table
- `error-flows.test.ts` — Uses legacy error codes

### SQL Tests (`sql/`)
- `is-admin.test.ts` — May be compatible, needs review
- `rls-policies.test.ts` — Uses legacy role model
- `triggers.test.ts` — Uses legacy schema

### Component Tests (`components/`)
- `EventSlotList.test.tsx` — Uses `event_slots`
- `ShowcaseLineupEditor.test.tsx` — Uses `is_showcase`
- `StudioBookingForm.test.tsx` — Uses legacy studio schema

### Hook Tests (`hooks/`)
- `useOpenMicSlots.test.ts` — Uses `event_slots`
- `useShowcaseLineup.test.ts` — Uses `is_showcase`
- `useStudioBooking.test.ts` — Uses legacy studio schema

### E2E Tests (`end-to-end/`)
- `workflows.test.ts` — Full flow with legacy schema

---

## If You Need These Tests

To adapt these tests for the current schema:

1. Replace `event_slots` references with `event_timeslots` + `timeslot_claims`
2. Replace `performer_id` with `member_id` or `guest_name`/`guest_email`
3. Update role checks from `performer`/`host`/`studio` to identity flags
4. Update RPC function names and signatures
5. Update fixture factories in `fixtures/index.ts`

---

## Files in This Archive

```
tests-legacy-schema/
├── README.md              # This file
├── setup.ts               # Test setup (legacy DB connection)
├── vitest.config.ts       # Vitest configuration
├── components/
│   ├── EventSlotList.test.tsx
│   ├── ShowcaseLineupEditor.test.tsx
│   └── StudioBookingForm.test.tsx
├── end-to-end/
│   └── workflows.test.ts
├── fixtures/
│   └── index.ts
├── hooks/
│   ├── useOpenMicSlots.test.ts
│   ├── useShowcaseLineup.test.ts
│   └── useStudioBooking.test.ts
├── rpc/
│   ├── book-studio.test.ts
│   ├── claim-slot.test.ts
│   ├── concurrency.test.ts
│   ├── error-flows.test.ts
│   ├── get-available-slots.test.ts
│   ├── set-showcase-lineup.test.ts
│   └── unclaim-slot.test.ts
├── sql/
│   ├── is-admin.test.ts
│   ├── rls-policies.test.ts
│   └── triggers.test.ts
└── utils/
    ├── datetime.test.ts   # Migrated to web/src/__tests__/utils/
    ├── index.ts           # Migrated to web/src/__tests__/utils/
    └── validateTestEnvironment.ts
```

---

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) — Current test file locations
- [docs/future-specs/progressive-identity.md](/docs/future-specs/progressive-identity.md) — Current guest verification spec
- [docs/future-specs/white-label-mvp.md](/docs/future-specs/white-label-mvp.md) — Current timeslot system spec
