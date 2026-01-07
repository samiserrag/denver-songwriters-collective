# Seeding Contract — Event Source Values

> **Phase 4.43** — Defines the contract for the `source` field on events.

---

## Source Values

| Value | Created By | Auto-Confirm on Publish? | Requires Admin Verification? |
|-------|------------|--------------------------|------------------------------|
| `community` | User via EventForm | Yes | No (trusted) |
| `import` | Bulk import script | No | Yes |
| `admin` | Admin via admin UI | No | Yes |

---

## Rules

### 1. User-Created Events (`source='community'`)

Events created by authenticated users through the EventForm:

- `host_id` is set to the creating user's ID
- `source` is set to `'community'`
- `last_verified_at` is set to `published_at` when published (auto-confirmed)
- These are trusted events and do not require admin verification

### 2. Bulk Imported Events (`source='import'`)

Events created via bulk import scripts:

- `host_id` may be NULL (unclaimed) or set to an admin
- `source` MUST be set to `'import'`
- `last_verified_at` MUST be NULL (requires admin verification)
- These events show as "Unconfirmed" until an admin verifies them

### 3. Admin-Created Events (`source='admin'`)

Events created by admins through the admin interface:

- `host_id` may be set to the admin or NULL
- `source` MUST be set to `'admin'`
- `last_verified_at` MUST be NULL (requires admin verification)
- Even admin-created events should be verified before going live

---

## Verification Logic

The verification state is determined purely by `last_verified_at`:

```typescript
function getVerificationState(event) {
  if (event.status === "cancelled") return "cancelled";
  if (event.last_verified_at !== null) return "confirmed";
  return "unconfirmed";
}
```

The `source` field is NOT used in verification logic—it's for auditing and UI copy only.

---

## Creating an Import Script

When writing a bulk import script, follow this pattern:

```typescript
// CORRECT: Import source + no auto-confirm
const { error } = await supabase
  .from("events")
  .insert({
    title: "Imported Event",
    // ... other fields ...
    source: "import",           // ← REQUIRED: marks as imported
    host_id: null,              // ← Typically NULL for imports
    last_verified_at: null,     // ← REQUIRED: don't auto-confirm
    is_published: true,         // Can be published but unconfirmed
  });

// WRONG: This would incorrectly auto-confirm
const { error } = await supabase
  .from("events")
  .insert({
    source: "community",        // ← WRONG: should be "import"
    // ...
  });
```

---

## Audit Script

Run the source audit script to check for violations:

```bash
npx tsx scripts/source-audit.ts
```

This will flag:
- Events with `source='community'` but `host_id` is NULL
- Events with unexpected source values
- Events with `source='import'` that have `last_verified_at` set

---

## Database Default

The database has a default value:

```sql
source TEXT DEFAULT 'community'
```

This means if you INSERT without specifying `source`, it will be `'community'`.

**For import scripts, you MUST explicitly set `source='import'`.**

---

## Related Files

| File | Purpose |
|------|---------|
| `api/my-events/route.ts` | Sets `source='community'` for user-created events |
| `lib/events/verification.ts` | Verification state helper (doesn't check source) |
| `scripts/source-audit.ts` | Audit script for contract violations |
| `scripts/backfill-all-events-to-rsvp.ts` | Backfill script (logs source for each event) |

---

**Last updated:** January 2026 (Phase 4.43)
