# PostgreSQL RLS Soft-Delete Pitfall

**Date:** January 2026
**Status:** Resolved
**Affects:** Any table using soft-delete (`is_deleted` column) with RLS

---

## The Problem

When implementing soft-delete with PostgreSQL Row Level Security (RLS), a subtle but critical issue can occur:

**Symptom:** Users receive "new row violates row-level security policy" error when trying to delete their own records, even when they have explicit DELETE/UPDATE permissions.

**Root Cause:** The SELECT policy filters out deleted rows (`is_deleted = false`), which blocks UPDATE operations.

---

## Why This Happens

PostgreSQL RLS has a key constraint: **UPDATE operations require the row to be visible via SELECT both before AND after the update**.

### The Problematic Pattern

```sql
-- SELECT policy: Only show non-deleted rows
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (is_deleted = false);

-- UPDATE policy: Allow soft-delete (set is_deleted = true)
CREATE POLICY "comments_update" ON comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (is_deleted = true);
```

### What Goes Wrong

1. User tries to "delete" their comment (soft-delete via UPDATE)
2. UPDATE sets `is_deleted = true`
3. PostgreSQL checks: "Is the new row visible under SELECT policies?"
4. SELECT policy says: Only `is_deleted = false` is visible
5. The updated row has `is_deleted = true`, so it's NOT visible
6. PostgreSQL rejects: "new row violates row-level security policy"

---

## The Solution

Add a **second SELECT policy** that allows "managers" (people who can soft-delete) to see rows regardless of `is_deleted` status:

```sql
-- Public SELECT: Anyone can see non-deleted rows
CREATE POLICY "comments_select_public" ON comments
  FOR SELECT TO authenticated
  USING (is_deleted = false);

-- Manager SELECT: Managers can see ALL their manageable rows
CREATE POLICY "comments_select_own" ON comments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()           -- Author
    OR public.is_admin()           -- Admin
    OR owner_id = auth.uid()       -- Content owner
  );
  -- NOTE: No is_deleted filter! Managers see deleted rows too.

-- UPDATE: Same managers can soft-delete
CREATE POLICY "comments_update_soft_delete" ON comments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR owner_id = auth.uid()
  )
  WITH CHECK (is_deleted = true);
```

### Why This Works

1. User tries to soft-delete their comment
2. UPDATE sets `is_deleted = true`
3. PostgreSQL checks SELECT visibility for new row
4. `comments_select_public` says NO (is_deleted = true)
5. But `comments_select_own` says YES (user_id matches)
6. Row is visible via at least one policy, so UPDATE succeeds

---

## Key Principles

1. **SELECT policies combine with OR logic** - A row is visible if ANY SELECT policy allows it.

2. **Managers need unrestricted SELECT** - Anyone who can modify `is_deleted` must be able to see rows regardless of that column's value.

3. **Public can still have filtered SELECT** - Regular users only see `is_deleted = false`, hiding "deleted" content from public view.

4. **Client-side filtering still required** - The manager SELECT policy shows deleted rows to managers. If you don't want managers to see deleted rows in the UI, filter client-side with `.eq('is_deleted', false)`.

---

## Real-World Application

This pattern was applied to `gallery_album_comments` and `gallery_photo_comments` tables in the Denver Songwriters Collective codebase.

**Migration:** `supabase/migrations/20260101071347_fix_gallery_comments_rls_admin_check.sql`

**Regression Tests:** `web/src/__tests__/gallery-comments-soft-delete-rls.test.ts`

The fix allows:
- Comment authors to delete their own comments
- Admins to delete any comment
- Album/image owners to delete comments on their content

---

## Testing Checklist

When implementing soft-delete with RLS:

- [ ] Two SELECT policies exist (public + manager)
- [ ] Public SELECT filters `is_deleted = false`
- [ ] Manager SELECT does NOT filter by `is_deleted`
- [ ] Manager SELECT matches UPDATE USING clause exactly
- [ ] Client queries include `.eq('is_deleted', false)` for public views
- [ ] Verify UPDATE works for: author, admin, content owner
