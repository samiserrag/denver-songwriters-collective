# GPT Consultation: Supabase getSession() to getUser() Migration

## Context

We have a Next.js 16 + Supabase application (The Colorado Songwriters Collective) that uses `supabase.auth.getSession()` in **60 files** across the codebase. Supabase is warning us that this is insecure:

```
Using the user object as returned from supabase.auth.getSession() or from some
supabase.auth.onAuthStateChange() events could be insecure! This value comes
directly from the storage medium (usually cookies on the server) and may not be
authentic. Use supabase.auth.getUser() instead which authenticates the data by
contacting the Supabase Auth server.
```

## Technical Details

**Stack:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase (PostgreSQL + Auth + RLS)
- Vercel deployment

**Current Pattern:**
```typescript
// In API routes
const supabase = await createSupabaseServerClient();
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const userId = session.user.id;
```

**Recommended Pattern:**
```typescript
const supabase = await createSupabaseServerClient();
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const userId = user.id;
```

## File Categories (60 files)

### API Routes (17 files)
Critical - these handle data mutations:
- `app/api/events/[id]/rsvp/route.ts`
- `app/api/events/[id]/comments/route.ts`
- `app/api/my-events/route.ts`
- `app/api/my-events/[id]/route.ts`
- `app/api/my-events/[id]/rsvps/route.ts`
- `app/api/my-events/[id]/cohosts/route.ts`
- `app/api/invitations/[id]/route.ts`
- `app/api/invitations/route.ts`
- `app/api/notifications/route.ts`
- `app/api/host-requests/route.ts`
- `app/auth/callback/route.ts`

### Protected Dashboard Pages (30+ files)
Server components that check auth:
- `app/(protected)/dashboard/page.tsx`
- `app/(protected)/dashboard/layout.tsx`
- `app/(protected)/dashboard/my-events/page.tsx`
- `app/(protected)/dashboard/my-rsvps/page.tsx`
- `app/(protected)/dashboard/notifications/page.tsx`
- `app/(protected)/dashboard/admin/*.tsx` (many admin pages)
- etc.

### Client Components (10+ files)
React components that use auth:
- `components/events/RSVPButton.tsx`
- `components/events/RSVPSection.tsx`
- `components/events/EventSuggestionForm.tsx`
- `components/blog/BlogComments.tsx`
- `components/blog/BlogInteractions.tsx`
- `components/hosts/RequestHostButton.tsx`
- `lib/auth/useAuth.ts` (custom hook)

### Public Pages with Optional Auth (5+ files)
- `app/page.tsx`
- `app/events/[id]/page.tsx`
- `app/blog/[slug]/page.tsx`
- `app/favorites/page.tsx`

## Questions for GPT

1. **Migration Strategy**: What's the safest incremental approach to migrate 60 files from `getSession()` to `getUser()` without breaking the app?

2. **Performance Implications**: `getUser()` makes a round-trip to Supabase Auth server on every call. How do we mitigate latency for:
   - Server components that need auth on initial render
   - Client components that check auth frequently
   - API routes that need to verify auth

3. **Caching Strategy**: Can/should we cache the `getUser()` result? Supabase uses JWT tokens with expiry. What's the recommended caching approach?

4. **Client vs Server**: For client components, should we:
   - Use `getSession()` (faster, from cookie) and accept the risk?
   - Use `getUser()` (slower, verified) for security?
   - Use a hybrid approach?

5. **Protected Routes Pattern**: We have a `(protected)` route group. Should we:
   - Verify auth once in `layout.tsx` and pass down?
   - Verify auth in each page separately?
   - Use middleware for auth?

6. **RLS Consideration**: Our database uses Row-Level Security. Since RLS policies use the JWT from the request, does `getSession()` vs `getUser()` affect RLS enforcement?

7. **Breaking Changes**: Are there any edge cases where switching from `session.user` to `user` would break functionality (different properties, null handling, etc.)?

## Current Auth Setup

```typescript
// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

```typescript
// lib/auth/useAuth.ts (client hook)
export function useAuth() {
  const supabase = useSupabaseClient()
  // Currently uses getSession() internally
}
```

## Desired Outcome

A clear, prioritized migration plan that:
1. Identifies which files are highest risk (need immediate migration)
2. Provides a pattern/helper that minimizes code changes
3. Addresses performance concerns
4. Can be implemented incrementally without breaking production
