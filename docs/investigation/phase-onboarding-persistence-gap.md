# Investigation #2 — Onboarding Persistence Gap

**Status:** INVESTIGATION COMPLETE
**Date:** January 2026
**Author:** Claude (Agent)
**Mode:** Investigation only — no code changes

---

## Executive Summary

The onboarding wizard collects 17 optional fields but only persists 5 to the database. This is **NOT intentional** — it is a regression introduced by commit `0d3d0c1` (December 26, 2025) when bypassing an RLS issue.

**Root Cause:** The hotfix to bypass RLS accidentally dropped fields from the API request body. The original code DID save all fields.

**Impact:** Users who complete onboarding with bio, social links, instruments, genres, tipping info, or collaboration preferences lose all that data. They must re-enter it in dashboard profile settings.

---

## Section A: Onboarding UI Payload Map

### Files Involved

| File | Purpose |
|------|---------|
| `web/src/app/onboarding/profile/page.tsx` | Onboarding wizard UI (839 lines) |
| `web/src/app/api/onboarding/route.ts` | API handler (56 lines) |

### State Variables in UI (All Fields Collected)

| Field | State Variable | Type | Required | Currently Persisted |
|-------|---------------|------|----------|---------------------|
| Name | `name` | string | **Yes** | ✅ Yes |
| Is Songwriter | `isSongwriter` | boolean | No | ✅ Yes |
| Is Host | `isHost` | boolean | No | ✅ Yes |
| Is Studio | `isStudio` | boolean | No | ✅ Yes |
| Is Fan | `isFan` | boolean | No | ✅ Yes |
| Bio | `bio` | string | No | ❌ **NO** |
| Instagram URL | `instagramUrl` | string | No | ❌ **NO** |
| Spotify URL | `spotifyUrl` | string | No | ❌ **NO** |
| YouTube URL | `youtubeUrl` | string | No | ❌ **NO** |
| Website URL | `websiteUrl` | string | No | ❌ **NO** |
| TikTok URL | `tiktokUrl` | string | No | ❌ **NO** |
| Venmo Handle | `venmoHandle` | string | No | ❌ **NO** |
| Cash App Handle | `cashappHandle` | string | No | ❌ **NO** |
| PayPal URL | `paypalUrl` | string | No | ❌ **NO** |
| Open to Collabs | `openToCollabs` | boolean | No | ❌ **NO** |
| Interested in Cowriting | `interestedInCowriting` | boolean | No | ❌ **NO** |
| Instruments | `instruments` | string[] | No | ❌ **NO** |
| Genres | `genres` | string[] | No | ❌ **NO** |

### Request Body Currently Sent

```typescript
// From onboarding/profile/page.tsx lines 121-127
body: JSON.stringify({
  full_name: name.trim() || null,
  is_songwriter: isSongwriter,
  is_host: isHost,
  is_studio: isStudio,
  is_fan: isFan,
})
```

**Note:** The UI collects all 17 fields in state (lines 17-49) but only sends 5 to the API.

---

## Section B: API Contract Analysis

### Current API Handler

**File:** `web/src/app/api/onboarding/route.ts`

```typescript
// Fields read from request body (lines 17-23)
const {
  full_name,
  is_songwriter = false,
  is_host = false,
  is_studio = false,
  is_fan = false
} = body;

// Fields written to database (lines 32-42)
.update({
  full_name: full_name || null,
  is_songwriter,
  is_host,
  is_studio,
  is_fan,
  onboarding_complete: true,
  updated_at: new Date().toISOString(),
})
```

### What Was Lost (Git Evidence)

**Commit:** `0d3d0c1` — "hotfix: bypass RLS for onboarding via service role API"
**Date:** December 26, 2025

The commit diff shows the **BEFORE** code that DID save all fields:

```typescript
// BEFORE: Original code saved all fields
const updates = {
  full_name: name || null,
  is_songwriter: isSongwriter,
  is_studio: isStudio,
  is_host: isHost,
  is_fan: isFan,
  bio: bio || null,
  instagram_url: instagramUrl || null,
  spotify_url: spotifyUrl || null,
  youtube_url: youtubeUrl || null,
  website_url: websiteUrl || null,
  tiktok_url: tiktokUrl || null,
  venmo_handle: venmoHandle || null,
  cashapp_handle: cashappHandle || null,
  paypal_url: paypalUrl || null,
  open_to_collabs: openToCollabs,
  interested_in_cowriting: interestedInCowriting,
  instruments: instruments.length > 0 ? instruments : null,
  genres: genres.length > 0 ? genres : null,
  onboarding_complete: true,
  updated_at: new Date().toISOString(),
};
```

**Conclusion:** The data loss was accidental, not intentional. The fix should restore the original behavior.

---

## Section C: Field Mapping Table (Schema Check)

All collected UI fields already have corresponding columns in the `profiles` table.

| UI Field | UI State | DB Column | Column Exists | Type Match |
|----------|----------|-----------|---------------|------------|
| Name | `name` | `full_name` | ✅ Yes | ✅ `string \| null` |
| Is Songwriter | `isSongwriter` | `is_songwriter` | ✅ Yes | ✅ `boolean \| null` |
| Is Host | `isHost` | `is_host` | ✅ Yes | ✅ `boolean \| null` |
| Is Studio | `isStudio` | `is_studio` | ✅ Yes | ✅ `boolean \| null` |
| Is Fan | `isFan` | `is_fan` | ✅ Yes | ✅ `boolean \| null` |
| Bio | `bio` | `bio` | ✅ Yes | ✅ `string \| null` |
| Instagram | `instagramUrl` | `instagram_url` | ✅ Yes | ✅ `string \| null` |
| Spotify | `spotifyUrl` | `spotify_url` | ✅ Yes | ✅ `string \| null` |
| YouTube | `youtubeUrl` | `youtube_url` | ✅ Yes | ✅ `string \| null` |
| Website | `websiteUrl` | `website_url` | ✅ Yes | ✅ `string \| null` |
| TikTok | `tiktokUrl` | `tiktok_url` | ✅ Yes | ✅ `string \| null` |
| Venmo | `venmoHandle` | `venmo_handle` | ✅ Yes | ✅ `string \| null` |
| Cash App | `cashappHandle` | `cashapp_handle` | ✅ Yes | ✅ `string \| null` |
| PayPal | `paypalUrl` | `paypal_url` | ✅ Yes | ✅ `string \| null` |
| Open to Collabs | `openToCollabs` | `open_to_collabs` | ✅ Yes | ✅ `boolean \| null` |
| Cowriting | `interestedInCowriting` | `interested_in_cowriting` | ✅ Yes | ✅ `boolean \| null` |
| Instruments | `instruments` | `instruments` | ✅ Yes | ✅ `string[] \| null` |
| Genres | `genres` | `genres` | ✅ Yes | ✅ `string[] \| null` |

**Result:** No schema changes required. All fields have existing columns with matching types.

---

## Section D: Minimal Safe Implementation Options

### Option 1: Persist All Existing Columns (NO SCHEMA CHANGE)

**Scope:** Restore original behavior — send all fields from UI to API, save all to DB.

**Files to Change:**

| File | Change |
|------|--------|
| `app/onboarding/profile/page.tsx` | Update `fetch()` body to include all 17 fields |
| `app/api/onboarding/route.ts` | Update destructure + update call to include all 17 fields |

**Implementation:**

1. **UI Change** (`onboarding/profile/page.tsx` lines 118-128):
```typescript
body: JSON.stringify({
  full_name: name.trim() || null,
  is_songwriter: isSongwriter,
  is_host: isHost,
  is_studio: isStudio,
  is_fan: isFan,
  bio: bio || null,
  instagram_url: instagramUrl || null,
  spotify_url: spotifyUrl || null,
  youtube_url: youtubeUrl || null,
  website_url: websiteUrl || null,
  tiktok_url: tiktokUrl || null,
  venmo_handle: venmoHandle || null,
  cashapp_handle: cashappHandle || null,
  paypal_url: paypalUrl || null,
  open_to_collabs: openToCollabs,
  interested_in_cowriting: interestedInCowriting,
  instruments: instruments.length > 0 ? instruments : null,
  genres: genres.length > 0 ? genres : null,
})
```

2. **API Change** (`api/onboarding/route.ts` lines 17-42):
```typescript
const {
  full_name,
  is_songwriter = false,
  is_host = false,
  is_studio = false,
  is_fan = false,
  bio,
  instagram_url,
  spotify_url,
  youtube_url,
  website_url,
  tiktok_url,
  venmo_handle,
  cashapp_handle,
  paypal_url,
  open_to_collabs = false,
  interested_in_cowriting = false,
  instruments,
  genres,
} = body;

// Update call includes all fields
.update({
  full_name: full_name || null,
  is_songwriter,
  is_host,
  is_studio,
  is_fan,
  bio: bio || null,
  instagram_url: instagram_url || null,
  spotify_url: spotify_url || null,
  youtube_url: youtube_url || null,
  website_url: website_url || null,
  tiktok_url: tiktok_url || null,
  venmo_handle: venmo_handle || null,
  cashapp_handle: cashapp_handle || null,
  paypal_url: paypal_url || null,
  open_to_collabs,
  interested_in_cowriting,
  instruments: instruments?.length > 0 ? instruments : null,
  genres: genres?.length > 0 ? genres : null,
  onboarding_complete: true,
  updated_at: new Date().toISOString(),
})
```

**Risks:**
- None — restoring original behavior
- All fields remain optional (null-safe)
- Schema already supports all fields

**Tests to Add:**
- Unit test: API accepts all 17 fields
- Unit test: Empty optional fields stored as null
- Unit test: Arrays stored correctly
- Integration test: Full onboarding flow persists all data

**Keeping Everything Optional:**
- All fields default to `null` or `false` in destructure
- UI already marks only "name" as required
- All DB columns are nullable

---

### Option 2: Add Schema for Missing Fields (NOT NEEDED)

**Status:** NOT APPLICABLE

All fields already exist in the `profiles` table. No schema changes are required.

This option would only be relevant if we wanted to add NEW fields not currently in the schema (e.g., `favorite_venues`, `performance_history`, etc.).

---

## Explicit UNKNOWNs

| # | Unknown | Impact | Resolution Path |
|---|---------|--------|-----------------|
| 1 | Was data loss reported by any user? | May need to communicate fix | Check support channels |
| 2 | How many users completed onboarding since Dec 26? | Determines affected population | Query `profiles WHERE onboarding_complete = true AND updated_at > '2025-12-26'` |
| 3 | Should we add URL validation for social links? | Prevents bad data | Product decision (can defer) |

---

## STOP-GATE Section

### Decisions Sami Must Make Next

1. **Proceed with Option 1?**
   - This is a bug fix, not a feature
   - Restores original intended behavior
   - No schema changes needed
   - **Recommendation:** Approve

2. **URL Validation for Social Links?**
   - Current: No validation (accepts any string)
   - Dashboard profile edit also has no validation
   - **Recommendation:** Defer (match existing dashboard behavior)

3. **Notify Affected Users?**
   - Users who onboarded since Dec 26 lost optional data
   - Could send email: "We fixed a bug, please complete your profile"
   - **Recommendation:** Defer (low priority, optional data)

### Safest Next Implementation Slice

**Single PR: Restore onboarding field persistence**

Scope:
1. Update `onboarding/profile/page.tsx` to send all 17 fields
2. Update `api/onboarding/route.ts` to accept and save all 17 fields
3. Add tests for full field persistence
4. Also update `handleSkip()` function (same pattern)

Effort: ~1 hour
Risk: Very low (restoring original behavior)
Test: Create test account, complete onboarding with all fields, verify all saved

### Risks + Regressions to Guard

| Risk | Mitigation |
|------|------------|
| API body too large | Not a concern — JSON is small (<2KB) |
| Type mismatches | All types already match schema |
| Null handling | Use `|| null` pattern (already proven) |
| Breaking existing users | No — all fields are optional, additive only |

---

## Files Referenced in This Investigation

| File | Purpose |
|------|---------|
| `web/src/app/onboarding/profile/page.tsx` | Onboarding wizard (UI state + submit logic) |
| `web/src/app/api/onboarding/route.ts` | API handler (fields read/written) |
| `web/src/app/(protected)/dashboard/profile/page.tsx` | Dashboard profile edit (reference for field handling) |
| `web/src/lib/supabase/database.types.ts` | Schema types (profiles table columns) |
| Git commit `0d3d0c1` | Hotfix that introduced the regression |

---

## Appendix: Dashboard Profile Edit (Reference)

The dashboard profile edit page (`dashboard/profile/page.tsx`) successfully saves all the same fields. The update call structure can be used as a reference:

```typescript
// From dashboard/profile/page.tsx lines 268-299
const updates = {
  full_name: formData.full_name || null,
  bio: formData.bio || null,
  is_songwriter: formData.is_songwriter,
  is_host: formData.is_host,
  is_studio: formData.is_studio,
  is_fan: formData.is_fan,
  instagram_url: formData.instagram_url || null,
  spotify_url: formData.spotify_url || null,
  youtube_url: formData.youtube_url || null,
  website_url: formData.website_url || null,
  tiktok_url: formData.tiktok_url || null,
  venmo_handle: formData.venmo_handle || null,
  cashapp_handle: formData.cashapp_handle || null,
  paypal_url: formData.paypal_url || null,
  open_to_collabs: formData.open_to_collabs,
  interested_in_cowriting: formData.interested_in_cowriting,
  genres: formData.genres.length > 0 ? formData.genres : null,
  instruments: formData.instruments.length > 0 ? formData.instruments : null,
  // ... additional fields
};
```

This proves the pattern works and all fields save correctly when included.
