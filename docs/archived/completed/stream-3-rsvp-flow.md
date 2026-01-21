# Stream 3: RSVP & Booking System

## Overview

End-to-end event signup flow with calendar integration, cancellation UX, and waitlist management.

## Phases Completed

### Phase 1: Calendar & Confirmation UX

- **AddToCalendarButton component** — Google, Apple, Outlook calendar links
- **.ics file download** for Apple Calendar
- **Enhanced RSVPButton** with confirmation messaging

### Phase 2: My RSVPs Dashboard

- **Route**: `/dashboard/my-rsvps`
- **Tabs**: Upcoming, Past, Cancelled
- **RSVPCard component** with status badges
- **Cancel button** with inline confirmation

### Phase 3: Enhanced Cancellation

- Cancel via URL param (`?cancel=true`)
- **CancelRSVPModal** with focus trap and accessible design
- **RSVPSection** wrapper for authentication handling
- Email cancel link integration

### Phase 3.5: 24-Hour Waitlist Claim Window

- **Migration**: `supabase/migrations/20251216000002_add_offer_expires_at.sql`
- **New column**: `event_rsvps.offer_expires_at`
- **New status value**: `"offered"`
- **Promotion flow**: cancel → offer next waitlist → 24-hour window
- **Opportunistic expiration check** (no cron required)
- **Countdown timer** in UI

## Flow Diagram

```
User RSVPs → confirmed (if capacity) OR waitlist
              ↓
Confirmed user cancels
              ↓
Next waitlist person gets status="offered", offer_expires_at=now+24h
              ↓
User sees countdown, clicks Confirm → status="confirmed"
              OR
24h passes → opportunistic check demotes to waitlist, promotes next
```

## Database Schema

### New Column on `event_rsvps`

```sql
ALTER TABLE event_rsvps
ADD COLUMN offer_expires_at TIMESTAMPTZ NULL;

-- Partial index for efficient expired offer queries
CREATE INDEX idx_event_rsvps_offer_expires
ON event_rsvps(offer_expires_at)
WHERE offer_expires_at IS NOT NULL;

-- Composite index for "find expired offers for this event" query
CREATE INDEX idx_event_rsvps_event_status_expires
ON event_rsvps(event_id, status, offer_expires_at)
WHERE offer_expires_at IS NOT NULL;
```

### RSVP Status Values

| Status | Description |
|--------|-------------|
| `confirmed` | User has a confirmed spot |
| `waitlist` | User is on the waitlist |
| `offered` | User was promoted from waitlist, has 24h to confirm |
| `cancelled` | User cancelled their RSVP |

## Key Files

### Components

| File | Purpose |
|------|---------|
| `src/components/events/RSVPButton.tsx` | Main RSVP action button with status handling |
| `src/components/events/RSVPCard.tsx` | RSVP display card for dashboard |
| `src/components/events/RSVPSection.tsx` | Wrapper handling auth and offer confirmation |
| `src/components/events/CancelRSVPModal.tsx` | Accessible cancellation modal |
| `src/components/events/AddToCalendarButton.tsx` | Calendar integration dropdown |

### Server Logic

| File | Purpose |
|------|---------|
| `src/lib/waitlistOffer.ts` | Server-side waitlist promotion logic |
| `src/lib/waitlistOfferClient.ts` | Client-safe utilities (expiry calculation, formatting) |
| `src/app/api/events/[id]/rsvp/route.ts` | RSVP API endpoint |

### Pages

| File | Purpose |
|------|---------|
| `src/app/(protected)/dashboard/my-rsvps/page.tsx` | My RSVPs dashboard |
| `src/app/events/[id]/page.tsx` | Event detail (includes RSVPSection) |

## API Endpoints

### POST `/api/events/[id]/rsvp`

**Body**: `{ action: "rsvp" | "cancel" | "confirm" }`

**Actions**:
- `rsvp` — Create new RSVP (confirmed or waitlist based on capacity)
- `cancel` — Cancel existing RSVP, promote next waitlist person
- `confirm` — Accept an offered spot (only valid if status="offered")

**Response**:
```json
{
  "success": true,
  "status": "confirmed" | "waitlist" | "offered" | "cancelled",
  "waitlistPosition": 3,
  "offerExpiresAt": "2025-12-17T14:30:00Z"
}
```

## Waitlist Offer Logic

### `processExpiredOffers(supabase, eventId)`

Called opportunistically on page loads and mutations:
1. Finds all RSVPs where `status='offered'` AND `offer_expires_at < now()`
2. For each expired offer:
   - Gets last waitlist position
   - Updates expired offer to `status='waitlist'` with new position
   - Promotes next waitlist person (excluding the one just demoted)

### `promoteNextWaitlistPerson(supabase, eventId)`

1. Gets person with lowest `waitlist_position` where `status='waitlist'`
2. Updates their status to `offered`
3. Sets `offer_expires_at` to now + 24 hours
4. Clears `waitlist_position`

### `sendOfferNotifications(supabase, eventId, userId, offerExpiresAt)`

1. Fetches event details
2. Sends in-app notification via `create_user_notification` RPC
3. Sends email with waitlist promotion template

### `confirmOffer(supabase, eventId, userId)`

1. Validates user has `status='offered'`
2. Checks offer hasn't expired
3. Updates to `status='confirmed'`, clears `offer_expires_at`

## Client Utilities

### `waitlistOfferClient.ts`

```typescript
// Calculate offer expiration (24 hours from now)
export function calculateOfferExpiry(): string

// Check if offer has expired
export function isOfferExpired(offerExpiresAt: string | null): boolean

// Get milliseconds until expiry
export function getTimeUntilExpiry(offerExpiresAt: string | null): number

// Format as "23h 45m" or "45m"
export function formatTimeRemaining(offerExpiresAt: string | null): string
```

## Security

- All mutations validate `auth.uid()` server-side
- Users can only cancel/confirm their own RSVPs
- Offer expiration checked opportunistically (no cron attack surface)
- RLS policies prevent cross-user data access

## UI States

### RSVPButton States

| User State | Button Display |
|------------|----------------|
| Not logged in | "Sign in to RSVP" |
| No RSVP | "RSVP" |
| Confirmed | "You're Going" with cancel option |
| Waitlist | "On Waitlist (#3)" with cancel option |
| Offered | "Confirm Your Spot" with countdown timer |

### Offer Countdown Display

When `status='offered'`, shows:
- "A spot opened up! Confirm within **23h 45m**"
- Prominent "Confirm My Spot" button
- Updates every minute
