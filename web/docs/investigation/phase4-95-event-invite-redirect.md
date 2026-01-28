# Phase 4.95 — Event Invite Redirect Preservation

**Status:** STOP-GATE Investigation Complete
**Date:** January 2026
**Author:** Repo Agent

---

## Problem Statement

When a non-member clicks an event invite link and must sign up, the system does not automatically return them to the invite acceptance page after signup/onboarding. They must manually revisit the original invite link.

---

## Investigation Findings

### 1. Param Name Mismatch (Root Cause #1)

**Event invite page** (`/event-invite`) sends:
```typescript
router.push(`/login?redirect=/event-invite?token=${encodeURIComponent(token)}`);
```

**Login page** reads:
```typescript
const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
```

**Bug:** Event invite sends `redirect` but login reads `redirectTo`. The params don't match, so login always redirects to `/dashboard`.

### 2. Onboarding Gate Drops Redirect (Root Cause #2)

Even if param names matched, the auth callback and onboarding flow don't preserve the redirect:

**Auth callback** (`/auth/callback/route.ts`):
- For email signup: Hardcoded redirect to `/onboarding/profile?signup=1`
- For Google OAuth: Hardcoded redirect to `/onboarding/profile?google=1`
- For magic link: Hardcoded redirect to `/onboarding/profile?magic=1`
- No `next` param passed through to onboarding

**Onboarding page** (`/onboarding/profile/page.tsx`):
- After completion: Hardcoded redirect to `/dashboard?welcome=1`
- No preservation of any redirect params

### 3. Email Auth Flows Can't Pass Custom Params (Root Cause #3)

Email-based auth flows use Supabase's `emailRedirectTo` which only accepts a single URL:
```typescript
// signUp.ts
const redirectTo = `${window.location.origin}/auth/callback?type=signup`;
```

The email link goes directly to this hardcoded URL. There's no way to pass the invite token URL through the email confirmation link.

---

## Files Involved

| File | Role | Issue |
|------|------|-------|
| `web/src/app/event-invite/page.tsx` | Invite acceptance page | Uses `redirect` param (wrong name) |
| `web/src/app/login/page.tsx` | Login handler | Reads `redirectTo` param (name mismatch) |
| `web/src/app/auth/callback/route.ts` | Auth callback | Hardcoded onboarding redirects |
| `web/src/app/onboarding/profile/page.tsx` | Onboarding form | Hardcoded dashboard redirect |
| `web/src/lib/auth/signUp.ts` | Email signup | Hardcoded callback URL |
| `web/src/lib/auth/magic.ts` | Magic link | Hardcoded callback URL |
| `web/src/lib/auth/google.ts` | Google OAuth | Hardcoded callback URL |

---

## Comparison with Venue Invites

Venue invites (`/venue-invite/page.tsx`) use the **exact same pattern**:
```typescript
router.push(`/login?redirect=/venue-invite?token=${encodeURIComponent(token)}`);
```

They have the **same bug** — using `redirect` instead of `redirectTo`. Venue invites don't work correctly either for new signups.

---

## Ranked Fix Options

### Option A: Cookie/localStorage + Param Fix (Recommended)

**Approach:**
1. Fix param name (`redirect` → `redirectTo`)
2. Store invite URL in localStorage before redirecting to login
3. After auth completion, check localStorage for pending redirect
4. Auto-clear after use

**Pros:**
- Works for ALL auth methods (email, Google, magic link)
- Survives the onboarding gate
- Simple to implement
- No need to modify email templates or Supabase config

**Cons:**
- Requires client-side storage
- Won't work if user clears storage or uses different browser

### Option B: Pass `next` Param Through Onboarding

**Approach:**
1. Fix param name mismatch
2. Modify auth callback to pass `next` param to onboarding
3. Modify onboarding to read and preserve `next` param
4. Forward to `next` after onboarding completion

**Pros:**
- Pure URL-based solution
- No client storage needed

**Cons:**
- Doesn't work for email-based auth (email link is hardcoded)
- Requires changes to multiple auth paths
- Complex to maintain

### Option C: Hybrid (Chosen Approach)

**Approach:**
1. Fix param name mismatch immediately
2. Use localStorage to store pending invite URL
3. Check for pending redirect in:
   - Login page (after login)
   - Onboarding page (after completion)
   - Auth callback (after email confirmation)
4. Auto-clear storage after successful redirect

**Why Chosen:**
- Handles all auth methods uniformly
- Simple to understand and maintain
- Matches the pattern used by other apps
- Gracefully degrades (if storage fails, user can re-click link)

---

## Implementation Plan

### Step 1: Fix Param Name Mismatch
- Change `redirect` → `redirectTo` in event invite page
- Change `redirect` → `redirectTo` in venue invite page (parity)

### Step 2: Add Pending Invite Storage
- Create `lib/auth/pendingRedirect.ts` helper
- Store URL in localStorage with key `dsc_pending_auth_redirect`
- Auto-expire after 1 hour (safety)

### Step 3: Check for Pending Redirect
- Login page: Check and redirect after successful login
- Onboarding: Check and redirect after completion
- Auth callback: Check and redirect for returning users

### Step 4: Add Pre-Auth Messaging
- Event invite page: Show clear message before redirect
- Explain that user will return automatically after auth

---

## Security Considerations

- **Token exposure:** Token is in URL params, visible in browser history. This is acceptable for invite tokens (same as password reset links).
- **localStorage:** Only stores the full URL, not parsed tokens. Cleared after use.
- **Expiry:** 1-hour expiry prevents stale redirects.

---

## Test Coverage Required

1. Login with pending redirect → should redirect to invite
2. Signup → email confirm → onboarding → should redirect to invite
3. Google OAuth → onboarding → should redirect to invite
4. Magic link → should redirect to invite
5. No pending redirect → should go to dashboard
6. Expired pending redirect → should go to dashboard

---

## STOP-GATE Approval

This investigation is complete. Ready to proceed with implementation using **Option C (Hybrid)**.
