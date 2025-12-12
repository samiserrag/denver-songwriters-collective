# Unified Members Directory - Implementation Plan

## Overview
Replace separate `/performers` and `/studios` pages with a unified `/members` directory that displays all member types (performers, hosts, studios, fans) in a single searchable/filterable interface.

## Current State
- **Separate pages**: `/performers`, `/studios`, `/spotlight`
- **Card components**: `PerformerCard`, `StudioCard`, `HostCard` (different layouts)
- **Database roles**: `performer`, `host`, `studio`, `admin`, `fan`
- **Profile fields available**: `genres[]`, `instruments[]`, `available_for_hire`, `interested_in_cowriting`, `song_links[]`, `is_featured`, `is_host`
- **Navigation**: Header has separate "Performers" and "Studios" links

## Implementation Steps

### Step 1: Create Unified MemberCard Component
**File**: `web/src/components/members/MemberCard.tsx`

Create a versatile card component that handles all member types:
- Display avatar/image with fallback initials
- Show role badge (Performer, Studio, Host, Fan)
- Display name, bio, location
- Show relevant tags: genres, instruments, specialties
- Availability indicators (available for hire, interested in cowriting)
- Spotlight badge for featured members
- Social links
- Link to appropriate detail page (`/performers/[id]`, `/studios/[id]`)

### Step 2: Create Members Grid Component
**File**: `web/src/components/members/MembersGrid.tsx`

Grid layout component that renders MemberCards with responsive columns.

### Step 3: Create Filter Components
**File**: `web/src/components/members/MemberFilters.tsx`

Client-side filter controls:
- **Role filter**: Checkboxes for Performer, Studio, Host, Fan
- **Availability filters**: Available for hire, Interested in cowriting
- **Genre filter**: Multi-select dropdown from available genres
- **Instrument filter**: Multi-select dropdown from available instruments
- **Search**: Text search for name/bio

### Step 4: Create Members Page
**File**: `web/src/app/members/page.tsx`

Server component that:
- Fetches all profiles with role != 'admin'
- Passes data to client components for filtering
- Orders by: is_featured DESC, featured_rank ASC, full_name ASC
- Uses MembersGrid with MemberFilters

### Step 5: Add Member Type Definition
**File**: `web/src/types/index.ts`

Add unified `Member` type:
```typescript
export interface Member {
  id: string;
  name: string;
  role: 'performer' | 'host' | 'studio' | 'fan';
  isHost?: boolean;  // performers can also be hosts
  bio?: string;
  genres?: string[];
  instruments?: string[];
  specialties?: string[];
  location?: string;
  avatarUrl?: string;
  isSpotlight?: boolean;
  socialLinks?: SocialLinks;
  availableForHire?: boolean;
  interestedInCowriting?: boolean;
  songLinks?: string[];
}
```

### Step 6: Update Navigation
**File**: `web/src/components/navigation/header.tsx`

Replace:
```typescript
{ href: "/performers", label: "Performers" },
{ href: "/studios", label: "Studios" },
```
With:
```typescript
{ href: "/members", label: "Members" },
```

### Step 7: Add Redirects for Old URLs
**File**: `web/next.config.js` (or create redirect routes)

Add redirects:
- `/performers` -> `/members?role=performer`
- `/studios` -> `/members?role=studio`

This preserves any bookmarked/linked URLs.

### Step 8: Keep Detail Pages
Maintain existing detail pages:
- `/performers/[id]` - Keep as-is for performer profiles
- `/studios/[id]` - Keep as-is for studio profiles

The MemberCard will link to the appropriate detail page based on role.

## Database Considerations
No database changes required. Existing `profiles` table has all needed fields:
- `role` (user_role ENUM)
- `is_host` (boolean)
- `genres` (text[])
- `instruments` (text[])
- `specialties` (text[])
- `available_for_hire` (boolean)
- `interested_in_cowriting` (boolean)
- `song_links` (text[])
- `is_featured`, `featured_rank`

## File Summary

| Action | File Path |
|--------|-----------|
| CREATE | `web/src/components/members/MemberCard.tsx` |
| CREATE | `web/src/components/members/MembersGrid.tsx` |
| CREATE | `web/src/components/members/MemberFilters.tsx` |
| CREATE | `web/src/components/members/index.ts` |
| CREATE | `web/src/app/members/page.tsx` |
| MODIFY | `web/src/types/index.ts` (add Member type) |
| MODIFY | `web/src/components/navigation/header.tsx` (update nav) |
| MODIFY | `web/next.config.js` (add redirects) |

## Out of Scope (for future consideration)
- Removing `/performers` and `/studios` pages (keep for now with redirects)
- Homepage clutter reduction (separate task)
- Open mic button clarity (separate task)
- Monthly highlights section (separate task)
- Color scheme changes (separate task)
