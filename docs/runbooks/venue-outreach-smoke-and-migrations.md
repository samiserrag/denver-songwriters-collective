# Venue Outreach: Smoke Tests & Migration Verification

> **Purpose:** End-to-end verification checklist for the venue outreach workflow (ABC8-11).
> **Last Updated:** 2026-01-12

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
WHERE version IN ('20260111200000', '20260111210000', '20260112000000', '20260112100000')
ORDER BY version;
```

**Expected Result:**

| Version | Name |
|---------|------|
| 20260111200000 | ABC6 add date_key columns |
| 20260111210000 | ABC6 enforce constraints |
| 20260112000000 | ABC8 venue claiming |
| 20260112100000 | ABC10b RLS tightening |

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
- `Admins can manage all venue invites`
- `managers_see_venue_invites`
- `users_see_own_invites`

**NOT Expected:** `anyone_can_lookup_by_token` (removed in ABC10b)

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

---

*Runbook created 2026-01-12 as part of ABC11 completion.*
