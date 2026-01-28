# Phase 4.96 — "Why Host on DSC?" Page STOP-GATE Investigation

**Date:** 2026-01-27
**Status:** Investigation complete

---

## 1. Existing Marketing/Public Page Patterns

### Example Pages Found

| Route | File | Pattern |
|-------|------|---------|
| `/about` | `app/about/page.tsx` | Narrative + CTA sections |
| `/get-involved` | `app/get-involved/page.tsx` | Grid cards + sections + CTAs |
| `/early-contributors` | `app/early-contributors/page.tsx` | Mission cards + guidance |

### Shared Layout Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `HeroSection` | `@/components/layout` | Hero with background image, vignette |
| `PageContainer` | `@/components/layout` | Centered content wrapper |
| `Button` | `@/components/ui` | All CTAs (variants: primary, secondary) |

### Standard Section Pattern

```tsx
<section className="space-y-6">
  <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)]">
    Section Title
  </h2>
  <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)]">
    Content
  </p>
  <div className="grid gap-6 sm:grid-cols-2">
    {/* cards with card-spotlight */}
  </div>
</section>
```

---

## 2. Canonical Join/Signup Route

**Primary signup route:** `/signup` (at `app/signup/page.tsx`)

- Client component form with email/password + Google + magic link
- On success redirects to `/auth/confirm-sent?email={encoded}`
- Referenced elsewhere as `/signup` not `/join`

---

## 3. Event-Invite Page Copy & CTAs

**File:** `app/event-invite/page.tsx`

Current "requires login" state (lines 168-231):

```tsx
if (requiresLogin) {
  return (
    // ...
    <h1>You've Been Invited!</h1>
    <p>Someone invited you to help host a happening on the Denver Songwriters Collective.</p>
    <p>Please log in or sign up (free) to accept this invite. We'll bring you right back here.</p>
    <button onClick={handleLoginRedirect}>Log In</button>
    <button onClick={handleSignupRedirect}>Sign Up (Free)</button>
  );
}
```

**Opportunity:** Add a "Learn more about hosting" link pointing to `/host`

---

## 4. EventInviteSection Email Template

**File:** `dashboard/my-events/[id]/_components/EventInviteSection.tsx`

Current template (lines 139-152):

```typescript
const getEmailTemplate = (url: string, expiresAt: string) => {
  return `You've been invited to help host "${eventTitle}" on Denver Songwriters Collective!

Click this link to accept:
${url}

This invite expires on ${expiryDate}.`;
};
```

**Opportunity:** Add `/host` URL with copy like:
"New to hosting? Learn what to expect: ${siteUrl}/host"

---

## 5. Files to Modify for Phase 4.96

| Task | File | Change |
|------|------|--------|
| A) Create page | `app/host/page.tsx` | NEW - public "Why host?" page |
| B.1) Update invite page | `app/event-invite/page.tsx` | Add "Learn more" link |
| B.2) Update invite page | `app/venue-invite/page.tsx` | Add "Learn more" link (for consistency) |
| B.3) Update template | `EventInviteSection.tsx` | Add host page URL to email template |

---

## 6. Page Structure for `/host`

Based on prompt requirements:

```
HeroSection
  └── Headline + subtitle

PageContainer
  └── Section: "What Hosts Do" (3 benefits)
  └── Section: "Two Ways to Host" (cards: Host own event / Claim existing)
  └── Section: "Lineup Display" (screenshot or mockup)
  └── Section: "FAQ" (collapsible or prose)
  └── Section: "Get Started" (CTAs to signup + happenings)
```

---

## 7. Copy Guidelines (from prompt)

- **Benefits:** 3 concise cards
- **Two modes:** "Create your own event" vs "Claim an existing open mic"
- **Lineup display:** Describe or show screenshot
- **FAQ:** Answer common hesitations
- **CTAs:** "Get Started" → `/signup`, "See Happenings" → `/happenings`

---

## 8. Approval Request

**Ready to proceed with:**

1. Create `/host` page following existing marketing page patterns
2. Update event-invite and venue-invite pages with "Learn more" link
3. Update EventInviteSection email template with host page URL

**Risk assessment:** Low - additive changes only, no database or API modifications

---

**STOP-GATE complete. Awaiting approval to proceed with implementation.**
