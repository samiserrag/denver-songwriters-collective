# Supabase RPC Integration Guide

Complete guide for integrating Open Mic Drop's Supabase RPC functions into your Next.js 15 application.

## Table of Contents

- [Setup](#setup)
- [Architecture](#architecture)
- [RPC Functions](#rpc-functions)
- [React Hooks](#react-hooks)
- [Example Components](#example-components)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Setup

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js@^2.39.0 @supabase/ssr@^0.1.0
```

### 2. Environment Variables

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Important**: Never commit the `.env.local` file. Add it to `.gitignore`.

### 3. Deploy Supabase SQL

Execute the following SQL files in your Supabase SQL Editor **in this order**:

1. `supabase/schema_phase1.sql` - Database tables and schema
2. `supabase/rls_phase1.sql` - Row Level Security policies
3. `supabase/triggers_phase1.sql` - Column-level protections
4. `supabase/rpc_phase2_v2.sql` - RPC functions (Gemini-approved, with race condition fixes)

### 4. Verify Deployment

In your Supabase Dashboard:
- Navigate to **Database** → **Tables** and verify 6 tables exist with RLS enabled (green shield icon)
- Navigate to **Database** → **Functions** and verify 6 functions exist (1 helper + 5 RPCs)

---

## Architecture

### File Structure

```
/lib/supabase/
├── types.ts       # TypeScript types for database tables and RPCs
├── client.ts      # Browser Supabase client
├── server.ts      # Server Supabase client (for Server Components)
├── rpc.ts         # Type-safe RPC function wrappers
└── errors.ts      # Error parsing and handling

/hooks/
├── useOpenMicSlots.ts    # Hooks for slot claiming/unclaiming
├── useStudioBooking.ts   # Hook for studio appointments
└── useShowcaseLineup.ts  # Hook for admin lineup management

/components/examples/
├── EventSlotList.tsx         # Example slot list component
├── StudioBookingForm.tsx     # Example booking form
└── ShowcaseLineupEditor.tsx  # Example lineup editor

/lib/utils/
└── datetime.ts    # Date/time formatting utilities
```

### Client vs Server

- **Browser Client** (`lib/supabase/client.ts`): Use in Client Components
- **Server Client** (`lib/supabase/server.ts`): Use in Server Components, Server Actions, Route Handlers

Both clients respect RLS policies and work with the same RPC wrappers.

---

## RPC Functions

### 1. Claim Open Mic Slot

**Function**: `claimOpenMicSlot(client, slotId)`

Allows a performer to claim an available open mic slot.

**Usage**:

```typescript
import { supabase } from '@/lib/supabase/client';
import { claimOpenMicSlot } from '@/lib/supabase/rpc';

try {
  const slot = await claimOpenMicSlot(supabase, slotId);
  console.log('Claimed slot:', slot);
} catch (error) {
  console.error('Failed to claim slot:', error.message);
}
```

**Error Cases**:
- Slot not available
- User already has a slot in this event
- User not authenticated

---

### 2. Unclaim Open Mic Slot

**Function**: `unclaimOpenMicSlot(client, slotId)`

Allows a performer to relinquish a previously claimed slot.

**Usage**:

```typescript
import { supabase } from '@/lib/supabase/client';
import { unclaimOpenMicSlot } from '@/lib/supabase/rpc';

try {
  const slot = await unclaimOpenMicSlot(supabase, slotId);
  console.log('Unclaimed slot:', slot);
} catch (error) {
  console.error('Failed to unclaim slot:', error.message);
}
```

**Error Cases**:
- Slot not found
- Slot doesn't belong to current user

---

### 3. Get Available Slots

**Function**: `getAvailableSlotsForEvent(client, eventId)`

Retrieves all unclaimed slots for an event.

**Usage**:

```typescript
import { supabase } from '@/lib/supabase/client';
import { getAvailableSlotsForEvent } from '@/lib/supabase/rpc';

const slots = await getAvailableSlotsForEvent(supabase, eventId);
console.log(`${slots.length} slots available`);
```

**Returns**: Array of `EventSlot` objects (can be empty)

---

### 4. Book Studio Service

**Function**: `bookStudioService(client, serviceId, desiredTime)`

Books a studio service appointment with double-booking protection.

**Usage**:

```typescript
import { supabase } from '@/lib/supabase/client';
import { bookStudioService } from '@/lib/supabase/rpc';

try {
  const appointment = await bookStudioService(
    supabase,
    serviceId,
    '2025-01-15T14:00:00Z' // ISO timestamp
  );
  console.log('Booked:', appointment);
} catch (error) {
  console.error('Booking failed:', error.message);
}
```

**Error Cases**:
- Time slot already booked
- Service not found
- Appointment time not in future

---

### 5. Set Showcase Lineup

**Function**: `setShowcaseLineup(client, eventId, performerIds)`

Sets the performer lineup for a showcase event (Admin/Host only).

**Usage**:

```typescript
import { supabase } from '@/lib/supabase/client';
import { setShowcaseLineup } from '@/lib/supabase/rpc';

try {
  const slots = await setShowcaseLineup(supabase, eventId, [
    'performer-uuid-1',
    'performer-uuid-2',
    'performer-uuid-3',
  ]);
  console.log('Lineup updated:', slots);
} catch (error) {
  console.error('Failed to set lineup:', error.message);
}
```

**Error Cases**:
- User not authorized (not admin/host)
- Event not found or not a showcase
- Duplicate performer IDs
- Invalid performer IDs

---

## React Hooks

### useClaimSlot

Hook for claiming slots with loading/error states.

```typescript
import { useClaimSlot } from '@/hooks/useOpenMicSlots';

export function MyComponent() {
  const { claimSlot, isLoading, error, data, reset } = useClaimSlot();

  const handleClaim = async (slotId: string) => {
    const result = await claimSlot(slotId);
    if (result) {
      console.log('Success!', result);
    }
  };

  return (
    <div>
      {error && <p>Error: {error.message}</p>}
      <button onClick={() => handleClaim('slot-uuid')} disabled={isLoading}>
        {isLoading ? 'Claiming...' : 'Claim Slot'}
      </button>
    </div>
  );
}
```

### useAvailableSlots

Hook for fetching available slots with auto-refresh.

```typescript
import { useAvailableSlots } from '@/hooks/useOpenMicSlots';

export function SlotList({ eventId }: { eventId: string }) {
  const { slots, isLoading, error, refetch } = useAvailableSlots(
    eventId,
    true, // auto-refresh enabled
    30000 // refresh every 30 seconds
  );

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {slots.map((slot) => (
        <div key={slot.id}>{slot.slot_index}</div>
      ))}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

### useBookStudio

Hook for booking studio appointments.

```typescript
import { useBookStudio } from '@/hooks/useStudioBooking';

export function BookingForm() {
  const { bookStudio, isLoading, error, isDoubleBooking } = useBookStudio({
    onSuccess: (appointment) => {
      console.log('Booked!', appointment);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await bookStudio(serviceId, desiredTime);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <p>{isDoubleBooking ? 'Time slot taken!' : error.message}</p>
      )}
      <button type="submit" disabled={isLoading}>
        Book
      </button>
    </form>
  );
}
```

### useSetLineup

Hook for managing showcase lineups (Admin/Host only).

```typescript
import { useSetLineup } from '@/hooks/useShowcaseLineup';

export function LineupEditor() {
  const { setLineup, isLoading, error, isUnauthorized } = useSetLineup({
    onSuccess: (slots) => {
      console.log('Lineup updated!', slots);
    },
  });

  if (isUnauthorized) {
    return <p>You don't have permission to edit this lineup.</p>;
  }

  return (
    <button onClick={() => setLineup(eventId, performerIds)}>
      {isLoading ? 'Saving...' : 'Save Lineup'}
    </button>
  );
}
```

---

## Error Handling

### Error Types

All errors are parsed through `parseSupabaseError()` and return a `SupabaseRPCError`:

```typescript
export class SupabaseRPCError extends Error {
  code: string;
  details: string | null;
  hint: string | null;
}
```

### Common Error Messages

| Error | User Message |
|-------|--------------|
| Slot not available | "This slot is no longer available, or you already have a slot in this event." |
| Time slot already booked | "This time slot is already booked. Please choose a different time." |
| Unauthorized | "You do not have permission to perform this action." |
| Duplicate performers | "The same performer cannot be assigned to multiple slots." |
| Invalid JWT | "Invalid session. Please sign in again." |

### Error Checking Utilities

```typescript
import {
  isSlotNotAvailableError,
  isDoubleBookingError,
  isUnauthorizedError,
  isValidationError,
  isNetworkError,
} from '@/lib/supabase/errors';

try {
  await claimOpenMicSlot(supabase, slotId);
} catch (error) {
  if (isSlotNotAvailableError(error)) {
    console.log('Slot is taken');
  } else if (isNetworkError(error)) {
    console.log('Network issue');
  }
}
```

---

## Testing

### Manual Testing Checklist

#### Open Mic Slots
- [ ] Claim an available slot
- [ ] Try to claim a second slot in the same event (should fail)
- [ ] Unclaim a slot you own
- [ ] Try to unclaim someone else's slot (should fail)
- [ ] Refresh available slots list

#### Studio Booking
- [ ] Book a studio service for a future time
- [ ] Try to book the same time slot (should fail with double-booking error)
- [ ] Try to book a past time (should fail validation)
- [ ] Cancel and rebook

#### Showcase Lineup (Admin/Host)
- [ ] Set lineup with multiple performers
- [ ] Try to add duplicate performers (should fail)
- [ ] Try to add non-existent performer ID (should fail)
- [ ] Reorder performers
- [ ] Test as non-admin user (should fail authorization)

### Race Condition Testing

**Critical**: Test with concurrent requests to verify Gemini's race condition fixes:

```bash
# Terminal 1
curl -X POST https://your-api/claim-slot -d '{"slotId":"uuid"}'

# Terminal 2 (at the same time)
curl -X POST https://your-api/claim-slot -d '{"slotId":"uuid"}'
```

Expected: Only one request succeeds, the other gets "Slot not available" error.

---

## Deployment

### Pre-Deployment Checklist

- [ ] All 4 Supabase SQL files executed in order
- [ ] RLS enabled on all tables (verify in Supabase dashboard)
- [ ] 6 functions deployed (1 helper + 5 RPCs)
- [ ] Environment variables set in production
- [ ] Test authentication flow
- [ ] Verify error messages are user-friendly
- [ ] Test race condition scenarios

### Production Environment Variables

Set these in your deployment platform (Vercel, etc.):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Monitoring

Monitor these metrics in Supabase Dashboard:

- **Database** → **Performance**: Query times for RPC functions
- **Database** → **Locks**: Check for deadlocks (should be none with parent-table locking)
- **Auth**: User sessions and authentication errors
- **Logs**: RPC function errors and exceptions

---

## Troubleshooting

### "Function not found" Error

**Cause**: RPC function not deployed or wrong name

**Solution**:
1. Verify function exists in Supabase Dashboard → Database → Functions
2. Check function name matches exactly (e.g., `rpc_claim_open_mic_slot`)
3. Re-run `supabase/rpc_phase2_v2.sql`

### "Permission denied" Error

**Cause**: RLS policy blocking access

**Solution**:
1. Verify user is authenticated: `await supabase.auth.getUser()`
2. Check RLS policies in Supabase Dashboard → Database → Tables → [table] → Policies
3. Ensure `rls_phase1.sql` was executed

### "Slot not available" Despite Empty Slot

**Cause**: User already has a slot in the event

**Solution**: Check `event_slots` table for existing performer_id match

### Double-Booking Still Occurring

**Cause**: Using unpatched v1 RPC file

**Solution**: Ensure you deployed `rpc_phase2_v2.sql` (with Gemini fixes), not `rpc_phase2.sql`

---

## Support

For issues or questions:
1. Check this documentation
2. Review Supabase logs (Dashboard → Logs)
3. Verify all Phase 1 & Phase 2 SQL files are deployed
4. Test with different user roles (performer, host, admin)

---

## Appendix

### Type Definitions Reference

See `lib/supabase/types.ts` for complete type definitions.

### RPC Function Signatures

```sql
-- Phase 2 RPC Functions (v2 - with race condition fixes)
rpc_claim_open_mic_slot(slot_id UUID) RETURNS event_slots
rpc_unclaim_open_mic_slot(slot_id UUID) RETURNS event_slots
rpc_get_available_slots_for_event(event_id UUID) RETURNS SETOF event_slots
rpc_book_studio_service(service_id UUID, desired_time TIMESTAMPTZ) RETURNS studio_appointments
rpc_admin_set_showcase_lineup(event_id UUID, performer_ids UUID[]) RETURNS SETOF event_slots
```

### Security Notes

- All RPC functions use `SECURITY INVOKER` (respect RLS)
- Race conditions patched with FOR UPDATE locks (Gemini-approved)
- Admin operations validated with `is_admin()` helper
- No RLS bypass vulnerabilities

---

**Version**: 1.0
**Last Updated**: 2025-01-23
**Status**: Production Ready ✅
