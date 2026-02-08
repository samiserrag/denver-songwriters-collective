# Venue Outreach: Smoke Tests & Migration Verification

> **Purpose:** End-to-end verification checklist for the venue outreach workflow (ABC8-11).
> **Last Updated:** 2026-01-15

---

## A. Production Smoke Checklist

### A1. Create Invite Flow (Admin)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Admin → Venues → select any venue | Venue detail page loads |
| 2 | Click "Create Invite Link" button | Modal opens with email/expiry options |
| 3 | Enter optional email restriction, select expiry (default 7 days) | Fields populated |
| 4 | Click "Create Invite" | Success state shows one-time invite URL |
| 5 | Click "Copy URL" button | URL copied to clipboard |
| 6 | Click "Copy Email Template" button | Pre-formatted email copied |
| 7 | Close modal (X or "Done") | Modal closes, invite appears in "Active Invites" list |

### A2. Accept Invite Flow (New Manager)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open incognito/private window | Fresh session |
| 2 | Paste invite URL from A1 | `/venue-invite?token=...` page loads |
| 3 | If not logged in, click "Log in" | Redirected to login with token preserved |
| 4 | Log in or sign up | Returns to invite page |
| 5 | Page auto-accepts invite | Success message: "You now have manager access to this venue!" |
| 6 | Click "View Venue" or "Go to My Venues" | Navigates to appropriate page |
| 7 | Confirm venue appears in My Venues dashboard | Venue listed with "manager" role |

### A3. Verify Acceptance (Admin)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Return to admin venue detail page (A1) | Page refreshes |
| 2 | Check "Active Invites" section | Accepted invite no longer shown |
| 3 | Check "Venue Managers" section | New manager listed with "Granted via invite" |
| 4 | Check admin notifications (bell icon) | "Venue invite accepted" notification present |

### A4. Revoke Invite Flow (Admin)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create another invite (repeat A1) | New invite created |
| 2 | Click "Revoke" button on the invite | Confirmation modal opens |
| 3 | Optionally enter reason | Reason field populated |
| 4 | Click "Revoke Invite" | Modal closes, invite removed from list |
| 5 | Attempt to use revoked invite URL | Error: "This invite has been revoked" |

### A5. Email Restriction Enforcement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create invite with email restriction (e.g., "test@example.com") | Invite created with restriction |
| 2 | Try to accept with different email account | Error: "This invite is restricted to a different email address" |
| 3 | Accept with matching email account | Success |

---

## B. Migration Verification Checklist

### B1. Required Migration History

Run this query to verify all ABC migrations are applied:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version IN ('20260111200000', '20260111210000', '20260112000000', '20260112100000', '20260113210000', '20260114000000')
ORDER BY version;
```

**Expected Result:**

| Version | Name |
|---------|------|
| 20260111200000 | ABC6 add date_key columns |
| 20260111210000 | ABC6 enforce constraints |
| 20260112000000 | ABC8 venue claiming |
| 20260112100000 | ABC10b RLS tightening |
| 20260113210000 | Fix venue_invites RLS INSERT |
| 20260114000000 | Fix venue_invites users policy |

### B2. Table Existence Check

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('venue_managers', 'venue_claims', 'venue_invites')
ORDER BY table_name;
```

**Expected:** All 3 tables exist.

### B3. RLS Policy Check

```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'venue_invites'
ORDER BY policyname;
```

**Expected Policies:**
- `Admins can manage all venue invites` (with both USING and WITH CHECK clauses)
- `managers_see_venue_invites`

**NOT Expected:**
- `anyone_can_lookup_by_token` (removed in ABC10b)
- `users_see_own_invites` (removed in 20260114000000 - queried auth.users which lacks SELECT permission)

### B4. Handling "Already Exists" Errors

If `npx supabase db push` shows "already exists" errors:

1. This is normal if migrations were applied directly via psql
2. Capture the full output for audit
3. Verify the migration is recorded in `supabase_migrations.schema_migrations`:
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations WHERE version = '<migration_version>';
   ```
4. If not recorded, add manually:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('<version>', '<filename>.sql');
   ```

---

## C. Build/Type Sync Guardrail

### C1. TypeScript Database Type Errors

If TypeScript fails with `.from("table_name")` not found:

1. **Check if table exists in production:**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'table_name';
   ```

2. **Regenerate database types:**
   ```bash
   npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts
   ```

3. **Verify table is in regenerated types:**
   ```bash
   grep -n "table_name:" web/src/lib/supabase/database.types.ts
   ```

4. **Commit and push the regenerated types file.**

### C2. Type Generation Best Practices

- Always regenerate types after applying migrations that add/modify tables
- Run `npm run build` locally before pushing to verify compilation
- Keep `database.types.ts` in version control (not gitignored)

---

## D. Troubleshooting

### D1. Invite Not Appearing After Creation

- Check browser console for API errors
- Verify admin role: `checkAdminRole()` must pass
- Check RLS: Admin must have SELECT on venue_invites

### D2. Acceptance Fails with 401

- Token in URL may be corrupted (spaces, truncation)
- User must be logged in
- Check if invite is expired or revoked

### D3. Manager Not Appearing After Acceptance

- Acceptance may have succeeded but grant failed (check rollback)
- Verify venue_managers RLS allows INSERT
- Check for duplicate active grants (409 Conflict)

### D4. Notification Not Received

- `created_by` may be NULL on older invites
- Check `create_user_notification` function exists and has correct search_path
- Verify notification preferences aren't blocking

### D5. "Invalid or expired invite" After Token Copy

This error occurs when the accept endpoint cannot find the invite by token hash.

**Root Cause (Fixed 2026-01-15):** The accept endpoint was using the user session client to query `venue_invites`, but RLS blocked the query because the user isn't a venue manager yet (that's what the invite grants).

**Verification Checklist:**

1. Confirm accept endpoint uses `createServiceRoleClient()`:
   ```typescript
   // In app/api/venue-invites/accept/route.ts
   import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

   const serviceClient = createServiceRoleClient();
   const { data: invite } = await serviceClient
     .from("venue_invites")
     .select(...)
     .eq("token_hash", tokenHash)
     .single();
   ```

2. Confirm ALL RLS-protected operations use `serviceClient`:
   - `venue_invites` lookup by token hash
   - `venue_managers` existence check
   - `venue_invites` accepted_at/accepted_by update
   - `venue_managers` INSERT (grant access)
   - `create_user_notification` RPC call

3. If using user session client (`supabase` from `createSupabaseServerClient()`), the query will fail because:
   - User isn't in `venue_managers` yet (invite grants this)
   - RLS policy `managers_see_venue_invites` requires active manager status

### D6. Localhost URLs in Invite Links

Invite URLs showing `localhost:3000` instead of production domain.

**Root Cause (Fixed 2026-01-15):** Direct use of `process.env.NEXT_PUBLIC_SITE_URL` fell back to localhost when env var wasn't set in Vercel.

**Fix:** Import centralized `SITE_URL` constant from email render module:

```typescript
// In app/api/admin/venues/[id]/invite/route.ts
import { SITE_URL } from "@/lib/email/render";

const inviteUrl = `${SITE_URL}/venue-invite?token=${token}`;
```

**SITE_URL Resolution Order** (from `lib/email/render.ts`):

1. `process.env.PUBLIC_SITE_URL`
2. `process.env.NEXT_PUBLIC_SITE_URL`
3. Fallback: `https://coloradosongwriterscollective.org`

**Vercel Environment Setup:**

Ensure one of these is set in Vercel → Project → Settings → Environment Variables:
- `NEXT_PUBLIC_SITE_URL=https://coloradosongwriterscollective.org`

---

*Runbook created 2026-01-12 as part of ABC11 completion.*
*Updated 2026-01-15: Added D5/D6 troubleshooting for service-role fix and URL env.*
