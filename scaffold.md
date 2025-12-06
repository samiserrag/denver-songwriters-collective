# THE DENVER SONGWRITERS COLLECTIVE (DSC) — MASTER CONTEXT FILE (FULL VERSION)
# Batch 1 of N — Architecture Overview

============================================================
SECTION 0 — BRAND INFORMATION
============================================================

- **Full Name:** The Denver Songwriters Collective
- **Short Name:** DSC
- **Tagline:** "Find your people. Find your stage. Find your songs."
- **Previous Name:** Open Mic Drop (deprecated)

============================================================
SECTION 1 — PROJECT OVERVIEW
============================================================

The Denver Songwriters Collective (DSC) is a modern, AI-first musician and community platform designed to support performers, hosts, studios, and audiences across cities. The system replaces legacy WordPress logic with a clean, modern, scalable architecture using Next.js 15, Supabase, Vercel, Expo, and AI-first development practices.

Core features include:
• Event listing and discovery  
• Booking and slot management  
• Showcase events  
• Studio listings and scheduling  
• Performer spotlights  
• Community feed  
• Admin dashboards  
• Multi-city support  
• AI-first development using Cursor, Continue.dev, Codex-Max, and Agent Builder  

This file is the canonical memory for all AI agents working on the project.

============================================================
SECTION 2 — COMPLETE ARCHITECTURE (2025 BEST PRACTICES)
============================================================

FRONTEND:
• Framework: Next.js 15  
• Routing: App Router  
• Rendering: React Server Components (RSC)  
• Styling: Tailwind CSS + shadcn/ui  
• Language: TypeScript  
• Layout: 12-column responsive grid  
• Page Types:
  – Landing page  
  – Event list  
  – Event detail  
  – Booking flows (open mic, showcase, studio)  
  – Artist profiles  
  – Studio profiles  
  – Host profiles  
  – Community feed  
  – User dashboard  
  – Admin dashboard  
  – Spotlight governance page  

BACKEND:
• Supabase (Postgres 16)  
• Supabase Auth (with RLS enabled)  
• Supabase Storage for media  
• Supabase Realtime for live updates  
• RPC functions for booking conflict prevention  

MOBILE:
• Expo + React Native  
• Shared Supabase backend  
• Feature parity with web for:
  – Event discovery  
  – Artist profiles  
  – Studio search  
  – Bookings  
  – User account  

HOSTING:
• Vercel for UI & API routes  
• Supabase for DB + Auth + Storage  
• Expo Go for development, EAS for production builds  

DEVELOPMENT TOOLS:
• Cursor IDE (agent mode with Codex-Max)  
• Continue.dev (local agent using API keys)  
• Claude Code (multi-file planning and refactoring)  
• OpenAI Agent Builder (structured execution)  
• v0.dev for component scaffolds  
• Figma AI for design mockups  
• GitHub for version control  

IMPORTANT CONSTRAINTS:
• No hallucinated UI, routes, file paths, or commands  
• All multi-file edits require plan → approval → execute  
• No destructive schema changes without simulation  
• RLS must always be enabled and validated  
• Booking logic must always pass conflict detection tests  
• Style tokens must be used consistently  
• No teal (unless explicitly chosen later)  
• All agents must load this context file before operating  

============================================================

[END OF BATCH 1 — Awaiting approval to append Batch 2]

# Batch 2 of N — Governance System & Event Overview

============================================================
SECTION 3 — GOVERNANCE SYSTEM (SPOTLIGHTS, ROLES, RULES)
============================================================

SPOTLIGHT GOVERNANCE:
• Spotlighted Artist selection uses a rotating advisory panel.
• Panel consists of:
  – The 3 most recently spotlighted artists
  – Sami (project lead)
  – One advisor (trusted reviewer)
• Past spotlights MAY nominate but do NOT vote.
• No public voting to prevent popularity bias.
• Spotlights remain archived permanently for historical continuity.
• Scales cleanly for additional cities.

ROLES (SYSTEM-WIDE):
1. Guest (unauthenticated)
2. Artist (authenticated performer)
3. Host (creates/organizes events)
4. Studio (posts services + bookings)
5. Admin (Sami + designated helpers)
6. Superadmin (system-level control; limited use)

ROLE CAPABILITIES OVERVIEW:
• Guest:
  – View events
  – View artist/studio profiles
  – Read community feed
  – Cannot book or post

• Artist:
  – Maintain performer profile
  – Book slots (open mic)
  – View showcase assignments
  – Comment in feed
  – Receive spotlights (if selected)

• Host:
  – Create events
  – Manage bookings
  – Approve/deny showcase performers
  – Moderate comments for hosted events

• Studio:
  – Publish services
  – Offer booking calendar
  – Manage availability + pricing

• Admin:
  – Approve hosts
  – Approve studios
  – Override bookings
  – Manage spotlight cycles
  – View system logs

• Superadmin:
  – Restricted to foundational config (Sami only)

============================================================
SECTION 4 — EVENT SYSTEM (OVERVIEW)
============================================================

EVENT MODES:
1. SIMPLE OPEN MIC
2. SHOWCASE (CURATED)
3. STUDIO BOOKING

UNIVERSAL EVENT DATA MODEL (ABSTRACT):
• id
• title
• description
• type (open_mic | showcase | studio)
• venue_name
• venue_address
• start_time
• end_time
• host_id
• created_by
• cover_image_url
• tags
• city
• visibility (public | unlisted | admin-only)
• timezone
• created_at / updated_at

BOOKING RULES (APPLIES TO ALL EVENTS):
• Supabase RPC must check conflicts before accepting bookings.
• Cancellations allowed unless admin disables them.
• ICS invites created for bookings.
• Booking history preserved permanently.
• No duplicate bookings allowed in same time window.
• Graceful fallback if slot is taken between selection and commit.

============================================================

[END OF BATCH 2 — Batch 3 ready]

# Batch 3 of N — Event Types (Full Definitions)

============================================================
SECTION 5 — EVENT TYPES (FULL DETAIL)
============================================================

------------------------------------------------------------
1. SIMPLE OPEN MIC (DEFAULT COMMUNITY EVENT)
------------------------------------------------------------
DESCRIPTION:
A first‑come, first‑served event where performers claim predefined slots.

DATA MODEL (ADDITIONAL FIELDS):
• slot_count  
• slot_duration_minutes  
• allow_waitlist (boolean)  
• allow_cancellation (boolean)  

RULES:
• Artists select an open slot.
• Supabase RPC checks for slot conflicts.
• Artists may cancel unless the host/admin disables cancellation.
• ICS invite sent upon booking.
• Booking history stored permanently.

USER FLOW:
1. Artist opens event page  
2. Sees "Available Slots" grid  
3. Selects one  
4. RPC validates → Success or conflict message  
5. Confirmation screen + ICS invite  

ADMIN/HOST FLOW:
• Create event  
• Define slot count and length  
• Monitor bookings in dashboard  

------------------------------------------------------------
2. SHOWCASE (CURATED EVENT)
------------------------------------------------------------
DESCRIPTION:
A high‑quality, limited‑slot curated event with **3 featured performers**, each performing 25–30 minutes.

DATA MODEL:
• lineup_order  
• artist_ids (array)  
• show_theme (optional)  
• curated_by (admin/host)  

RULES:
• No public signup  
• Admin/host assigns performers  
• 3–4 performers max  
• Showcase permanently archived with media  

USER FLOW:
• Artists may be invited  
• Artist receives assignment notification  
• Artist page shows “Scheduled Showcase Performances”  

ARCHIVAL RULES:
• All past showcases remain on “Showcase History” page  
• Each showcase links to artist profiles and media  

------------------------------------------------------------
3. STUDIO BOOKING (SERVICE SCHEDULING)
------------------------------------------------------------
DESCRIPTION:
Studios offer bookable time blocks for recording, mixing, rehearsal, or services.

DATA MODEL ADDITIONS:
• studio_id  
• service_type (recording/mixing/rehearsal/etc.)  
• hourly_rate  
• min_hours  
• max_hours  
• blackout_dates  

RULES:
• Artists choose a time block  
• Supabase RPC checks time conflict  
• Studios may set pricing and availability  
• ICS invite created  
• Payment integration optional (Phase 3+)  

USER FLOW:
1. Artist opens studio profile  
2. Browses service offerings  
3. Selects date → sees availability  
4. Books time → RPC conflict check  
5. Confirmation + ICS  

------------------------------------------------------------
EVENT FILTERING (GLOBAL)
------------------------------------------------------------
Users can filter events by:
• city  
• event type  
• venue  
• host  
• date  
• “featured” flag  

============================================================

[END OF BATCH 3 — Batch 4 ready]

# Batch 4 of N — ASCII Wireframes (Landing, Event List, Event Detail)

============================================================
SECTION 6 — ASCII WIREFRAMES
============================================================

------------------------------------------------------------
LANDING PAGE — ASCII WIREFRAME (FINAL)
------------------------------------------------------------
────────────────────────────────────────────────────────────
                      OPEN MIC DROP
────────────────────────────────────────────────────────────
HERO SECTION (FULL-WIDTH GRADIENT: NAVY → BLACK)
------------------------------------------------------------
[ LOGO ]         “A COMMUNITY FOR SONGWRITERS”
                 BOLD HEADLINE — MODERN SANS
                 SUBHEAD: “Events • Artists • Studios • Community”
                 [ VIEW EVENTS ]  [ JOIN THE COMMUNITY ]

SPOTLIGHT ROW (3 FEATURED ARTISTS — 4:5 RATIO)
------------------------------------------------------------
[ Artist Card 1 ]  [ Artist Card 2 ]  [ Artist Card 3 ]
• Photo  
• Name  
• Genre / City  
• One-sentence description  
• Link → Artist Profile  

EVENTS PREVIEW (UPCOMING EVENTS)
------------------------------------------------------------
[ Event Banner 1 — 16:9 ]
  Title
  Date • Venue • City
  [ VIEW EVENT ]

[ Event Banner 2 ]

COMMUNITY PREVIEW (LATEST FEED POSTS)
------------------------------------------------------------
• Post 1 (artist avatar + text snippet)
• Post 2
• Post 3
[ VIEW COMMUNITY FEED ]

STUDIO PARTNERS (HORIZONTAL SCROLLER)
------------------------------------------------------------
[ Studio Card 1 ]  [ Studio Card 2 ]  [ Studio Card 3 ]
• Logo  
• Services preview  
• [ VIEW STUDIO ]

FOOTER
------------------------------------------------------------
Links: About • Events • Artists • Studios • Community • Contact
Social: IG • YT • Spotify  
© Open Mic Drop

────────────────────────────────────────────────────────────



------------------------------------------------------------
EVENT LIST PAGE — ASCII WIREFRAME
------------------------------------------------------------
────────────────────────────────────────────────────────────
                    EVENTS IN DENVER
────────────────────────────────────────────────────────────

FILTER BAR:
------------------------------------------------------------
[ City ▼ ]  [ Type ▼ ]  [ Host ▼ ]  [ Date ▼ ]  [ Reset Filters ]

EVENT GRID:
------------------------------------------------------------
[ Event Card ]
• Image (16:9)
• Title
• Date • Time • Venue
• Type badge: OPEN MIC / SHOWCASE / STUDIO
• [ VIEW ]

[ Event Card ]
...

PAGINATION:
[ 1 ] [ 2 ] [ Next → ]

────────────────────────────────────────────────────────────



------------------------------------------------------------
EVENT DETAIL PAGE — ASCII WIREFRAME
------------------------------------------------------------
────────────────────────────────────────────────────────────
[ EVENT BANNER IMAGE — 16:9 ]
────────────────────────────────────────────────────────────

TITLE: “Open Mic at Skylark Lounge”
DATE/TIME: Fri, May 12 • 7:00 PM  
VENUE: Skylark Lounge • 140 S Broadway, Denver  
HOSTED BY: John D. (Host Profile Link)

BUTTONS:
[ CLAIM SLOT ] (Open Mic)
[ APPLY TO PERFORM ] (Showcase)
[ BOOK TIME ] (Studio)

EVENT DESCRIPTION:
------------------------------------------------------------
Paragraph describing event, vibe, genre focus, expectations.

SLOT / LINEUP SECTION:
------------------------------------------------------------
SIMPLE OPEN MIC MODE EXAMPLE:
[ Slot 1 — Taken ]
[ Slot 2 — Available ]
[ Slot 3 — Available ]
...
[ Slot N — Taken ]

SHOWCASE MODE EXAMPLE:
Spotlight Performers:
• Artist 1 — 7:00 PM  
• Artist 2 — 7:40 PM  
• Artist 3 — 8:20 PM  

STUDIO BOOKING MODE EXAMPLE:
Calendar selector → Availability grid → Book button

MAP SECTION:
------------------------------------------------------------
[ GOOGLE MAPS EMBED PLACEHOLDER ]

SHARE SECTION:
------------------------------------------------------------
Share: IG • FB • X • Link

────────────────────────────────────────────────────────────

[END OF BATCH 4 — Batch 5 ready]

# Batch 5 of N — Storyboards (All Flows)

============================================================
SECTION 7 — STORYBOARDS
============================================================

------------------------------------------------------------
ARTIST PROFILE — STORYBOARD
------------------------------------------------------------
User visits Artist Profile page:

1. HEADER
   • Artist name (big, bold)
   • Genre • City
   • Follow button (Phase 3+)

2. HERO IMAGE / PHOTO
   • 4:5 portrait
   • Optional video teaser (Phase 3+)

3. ABOUT SECTION
   • One‑sentence intro
   • Longer bio
   • Influences, style, notable performances

4. MEDIA SECTION
   • Embedded YouTube, Spotify, SoundCloud
   • Up to 6 featured tracks/videos

5. UPCOMING PERFORMANCES
   • Cards linking to events featuring this artist

6. PAST PERFORMANCES
   • Showcase archive entries
   • Open mic appearances (if enabled)

7. LINKS
   • Website
   • IG / TikTok / YouTube
   • Contact or booking link

------------------------------------------------------------
STUDIO PROFILE — STORYBOARD
------------------------------------------------------------
1. HEADER
   • Studio name
   • Location, logo
   • “Book Now” CTA

2. GALLERY
   • 4–8 images of studio space
   • Optional video walkthrough

3. SERVICES
   • Recording
   • Mixing
   • Rehearsal rooms
   • Lessons / coaching
   • Pricing shown per service

4. AVAILABILITY CALENDAR
   • Date picker
   • Hours available
   • Click → Book Time

5. ENGINEER / STAFF BIOS
   • Optional section

6. REVIEWS (Phase 3+)

------------------------------------------------------------
HOST DASHBOARD — STORYBOARD
------------------------------------------------------------
1. OVERVIEW
   • Your upcoming events
   • Total bookings
   • Messages (Phase 3+)

2. CREATE EVENT BUTTON
   • Opens Event Creation flow

3. EVENT MANAGEMENT
   • Edit event
   • View lineup
   • Approve/deny showcase performers
   • Export attendee list
   • Send announcements

4. STATS (Phase 3+)
   • Attendance history
   • Booking patterns

------------------------------------------------------------
USER DASHBOARD — STORYBOARD
------------------------------------------------------------
1. YOUR BOOKINGS
   • Upcoming slots
   • Studio reservations
   • Showcase assignments

2. PROFILE STATUS
   • Artist profile completion indicator
   • Quick “edit profile” link

3. COMMUNITY ACTIVITY
   • Posts you’ve made
   • Spotlights you’re featured in

4. SETTINGS
   • Notifications
   • Social links
   • Account info

------------------------------------------------------------
COMMUNITY FEED — STORYBOARD
------------------------------------------------------------
1. NEW POST INPUT
   • Text box
   • Add media (image, audio snippet, video link)

2. FEED ITEMS
   • Artist avatar + name
   • Timestamp
   • Text body
   • Embedded media

3. REACTIONS (Phase 3+)
   • Like
   • Comment
   • Share

4. FILTERS
   • Artists you follow
   • Recent
   • Most popular

------------------------------------------------------------
SPOTLIGHT GOVERNANCE PAGE — STORYBOARD
------------------------------------------------------------
1. CURRENT SPOTLIGHT PANEL
   • Names + photos of 3 spotlight artists
   • Sami
   • Advisor

2. NOMINATION INPUT
   • Past spotlight artists can nominate new candidates

3. CURRENT CYCLE LIST
   • Artists eligible
   • Notes
   • Short summaries

4. DECISION RECORD
   • Transparent history of past spotlight selections

------------------------------------------------------------
ADMIN DASHBOARD — STORYBOARD
------------------------------------------------------------
1. SYSTEM OVERVIEW
   • Total users
   • Artists
   • Studios
   • Hosts
   • Events
   • Active bookings

2. EVENT MANAGEMENT
   • Approve hosts
   • Approve studios
   • Manage spotlight system
   • Override bookings
   • Edit event metadata

3. LOGS
   • Booking conflicts
   • Failed RPC attempts
   • Studio cancellations

4. SETTINGS
   • RLS modes
   • Feature toggles
   • City support

------------------------------------------------------------
EVENT CREATION — STORYBOARD (ALL MODES)
------------------------------------------------------------
FLOW 1 — CREATE NEW EVENT
1. Choose event type:
   • Open Mic
   • Showcase
   • Studio Booking

2. Enter event basics:
   • Title
   • Description
   • City
   • Venue name + address
   • Start & end time

3. Mode-specific setup:
   • OPEN MIC:
     – Slot count
     – Slot length
     – Cancellation allowed?
   • SHOWCASE:
     – Add performers
     – Set order & times
     – Add theme
   • STUDIO:
     – Service type
     – Pricing
     – Min/max hours
     – Blackout dates

4. Finalize + publish event

============================================================

[END OF BATCH 5 — Batch 6 ready]

# Batch 6 of N — Additional System Context

============================================================
SECTION 8 — ADDITIONAL SYSTEM NOTES
============================================================

• This batch placeholder is added to allow GitHub push while the remaining context batches are prepared.
• No functional schema, UI, or logic changes are introduced here.
• Future batches will include:
  – Full Supabase schema
  – RPC definitions
  – RLS policy templates
  – Next.js file tree
  – API route definitions
  – Component scaffolding
  – Deployment instructions
  – Mobile (Expo) structure
  – Integration tests
  – Future Phase directives

[END OF BATCH 6 — Full batches continue next]

# Batch 7 of N — Supabase Schema, RPC Functions, RLS Policies

============================================================
SECTION 9 — SUPABASE SCHEMA (FULL)
============================================================

-- USERS TABLE
Table: users
• id (uuid, pk)
• email (text)
• role (text: guest|artist|host|studio|admin|superadmin)
• display_name (text)
• avatar_url (text)
• city (text)
• bio (text)
• socials (jsonb)
• created_at (timestamp)

-- ARTISTS TABLE
Table: artists
• id (uuid, pk → users.id)
• genre (text)
• influences (text)
• one_liner (text)
• media_links (jsonb)

-- STUDIOS TABLE
Table: studios
• id (uuid, pk)
• owner_id (uuid → users.id)
• name (text)
• address (text)
• city (text)
• images (jsonb)
• services (jsonb)
• hourly_rate (numeric)
• created_at (timestamp)

-- EVENTS TABLE
Table: events
• id (uuid, pk)
• type (text: open_mic|showcase|studio)
• title (text)
• description (text)
• venue_name (text)
• venue_address (text)
• city (text)
• start_time (timestamptz)
• end_time (timestamptz)
• host_id (uuid → users.id)
• cover_image_url (text)
• tags (text[])
• visibility (text)
• created_at (timestamp)

-- BOOKINGS TABLE
Table: bookings
• id (uuid, pk)
• event_id (uuid → events.id)
• artist_id (uuid → users.id)
• slot_number (int)
• start_time (timestamptz)
• end_time (timestamptz)
• status (text: confirmed|cancelled)
• created_at (timestamp)

============================================================
SECTION 10 — RPC FUNCTIONS
============================================================

-- check_booking_conflict(event_id, start_time, end_time)
Logic:
1. Query existing bookings for event_id
2. Return TRUE if overlap exists
3. Else return FALSE

-- create_booking_secure(event_id, artist_id, slot_number)
Logic:
1. Begin transaction
2. Check conflicts
3. If conflict → rollback
4. Insert booking
5. Commit

============================================================
SECTION 11 — RLS POLICIES (TEMPLATES)
============================================================

POLICY: Artists may read events
→ allow select on events where visibility = 'public'

POLICY: Artists may insert bookings for public events
→ allow insert on bookings where auth.uid() = artist_id

POLICY: Hosts may update their own events
→ allow update where host_id = auth.uid()

POLICY: Admin override mode
→ allow all for role = admin or superadmin

============================================================

# Batch 8 of N — Next.js File Tree + API Routes

============================================================
SECTION 12 — NEXT.JS PROJECT STRUCTURE
============================================================

/app
  /layout.tsx
  /page.tsx
  /events
    /page.tsx
    /[id]
      /page.tsx
  /artists
    /[id]
      /page.tsx
  /studios
    /[id]
      /page.tsx
  /dashboard
    /page.tsx
  /admin
    /page.tsx
  /api
    /events
      route.ts
    /bookings
      route.ts
    /artists
      route.ts
    /studios
      route.ts

============================================================
SECTION 13 — API ROUTE DEFINITIONS
============================================================

/api/events:
  GET — list events
  POST — create event (host/admin)
/api/bookings:
  POST — create booking (uses RPC check)
/api/artists:
  GET — fetch artist profile
/api/studios:
  GET — fetch studio profile

============================================================

# Batch 9 of N — Expo Mobile Architecture

============================================================
SECTION 14 — EXPO STRUCTURE
============================================================

/app
  /home
  /events
  /event/[id]
  /artists/[id]
  /studios/[id]
  /bookings
  /account

NAVIGATION:
• Tab Navigator:
  – Home
  – Events
  – Studios
  – Community
  – Account

SHARED LOGIC WITH WEB:
• Supabase client
• Session management
• Universal components (buttons, cards)

============================================================

# Batch 10 of N — Deployment, CI/CD, Agents

============================================================
SECTION 15 — DEPLOYMENT
============================================================

WEB:
• Vercel → connect GitHub repo → auto deploy on push

DATABASE:
• Supabase → load schema → enable RLS → test RPC

MOBILE:
• Expo EAS Build → submit to iOS/Android stores

============================================================
SECTION 16 — CONTINUE.DEV SETUP
============================================================

Add file: .continue/config.json

{
  "apiKeys": {
    "openai": "YOUR_KEY_HERE",
    "anthropic": "YOUR_KEY_HERE"
  },
  "model": "gpt-5.1-codex-max",
  "contextFiles": [
    "scaffold.md"
  ]
}

============================================================
SECTION 17 — AGENT BUILDER DIRECTIVE
============================================================

Agent must:
• Load scaffold.md and follow all constraints
• Use Plan → Execute steps
• Avoid destructive changes
• Generate diffs for multi-file edits
• Follow style tokens
• Preserve booking logic integrity

============================================================

# END OF MASTER CONTEXT FILE (FULLY GENERATED)
