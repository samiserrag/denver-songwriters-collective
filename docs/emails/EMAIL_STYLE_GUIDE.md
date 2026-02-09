# DSC Email Style Guide

**Last Updated:** December 2025
**Purpose:** Single source of truth for DSC transactional email voice, tone, and formatting.

## Shared Email Image Assets

- Header image (public): `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/public/images/CSC Email Header1.png`
- Use this path when coordinating email template updates across agents and tooling.

---

## Email Voice (Summary)

> **Short, warm, and excited they're participating.**

See also: [Copy Tone Guide](../copy-tone-guide.md) for full site-wide guidance.

---

## Voice & Tone

### The DSC Voice

Think of DSC emails as coming from a **friendly stage manager** — someone who:

- Knows your name and genuinely wants you to have a great night
- Gives you exactly the info you need, when you need it
- Stays calm even when things change
- Celebrates your wins without being over-the-top
- Respects your time (no fluff, no upsells)

### Core Principles

| Principle | Do | Don't |
|-----------|-----|-------|
| **Warm** | "Great news! You're confirmed..." | "Your registration has been processed." |
| **Human** | "We can't wait to hear you play!" | "Thank you for your submission." |
| **Calm** | "If plans change, no worries—" | "URGENT: Action required immediately!" |
| **Clear** | "Your spot is #3 on the lineup." | "Your queue position has been assigned." |
| **Respectful** | One email per action | Multiple follow-ups, reminders |

### Tone Ladder

Use the appropriate tone based on context:

| Context | Tone | Example |
|---------|------|---------|
| **Celebration** | Enthusiastic, warm | "You're on the lineup!" |
| **Confirmation** | Friendly, clear | "All set. See you there!" |
| **Action needed** | Calm urgency | "A spot opened up—confirm by..." |
| **Bad news** | Empathetic, constructive | "We weren't able to approve...but you're welcome to..." |
| **Transactional** | Neutral, helpful | "Here's your verification code." |

---

## Personalization Rules

### Greeting

Always personalize when possible, with a graceful fallback:

```typescript
// Pattern
function getGreeting(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0
    ? `Hi ${escapeHtml(trimmed)},`
    : "Hi there,";
}
```

**Examples:**
- With name: "Hi Sarah,"
- Without name: "Hi there,"

**Never:**
- "Dear Valued Customer,"
- "Hello User,"
- "Hi undefined,"

### Name Handling

- Always escape HTML in names (prevent XSS)
- Trim whitespace before checking
- Empty string = use fallback
- Null/undefined = use fallback

---

## Humor Rules

### When Humor is OK

- Helper text and encouragement lines
- Success/celebration moments
- Low-stakes friendly asides

**Good examples:**
- "We can't wait to hear you play!"
- "Spots open up more often than you'd think—keep an eye on your inbox!"
- "Show up a few minutes early to check in with the host."

### When Humor is NOT OK

- Times, dates, and deadlines (must be crystal clear)
- Status information (confirmed/waitlist/cancelled)
- Error messages or bad news
- Action instructions

**Bad examples:**
- "Your spot is probably slot #3 or thereabouts 😅"
- "You've got about 24ish hours to confirm"
- "Oopsie! Something went wrong"

### Warm Closers (use where appropriate)

These phrases add warmth without being over-the-top:

- "Can't wait to hear you — see you soon!"
- "Should be a good one. See you soon!"
- "Hope to see you there!"
- "Questions? Reach out to your host or post a comment on the event page."

---

## CTA (Call-to-Action) Rules

### Primary CTA

Every email should have **one** clear primary action:

```typescript
// Primary CTA button
createButton("Confirm my spot", confirmUrl, "green")
createButton("View Event Details", eventUrl, "gold")
```

**Button text rules:**
- Use first-person verbs: "Confirm my spot" not "Confirm your spot"
- Be specific: "View Event Details" not just "Click Here"
- Keep it short: 2-4 words

### Secondary Links

For optional/alternative actions, use text links:

```typescript
createSecondaryLink("I can't make it", cancelUrl)
createSecondaryLink("Remove me from the waitlist", cancelUrl)
```

**Secondary link rules:**
- Position below primary CTA
- Use softer language
- Make consequences clear

### Link Hierarchy

```
[PRIMARY BUTTON - Big, colored, prominent]

Secondary link (plain text, smaller)

---
Footer links (unsubscribe, contact, etc.)
```

---

## Footer Rules

### Standard Footer

Every transactional email includes:

```html
— The Colorado Songwriters Collective

You can reply directly to this email if you need anything.

coloradosongwriterscollective.org
```

### Key Footer Principles

1. **Reply-friendly**: Always include "You can reply directly to this email"
2. **Why they got it**: Context should be clear from the body
3. **No legalese**: Skip the "You received this because..." disclaimers
4. **One link**: Site URL only (no social media in transactional)

### Newsletter-Only Footer

For newsletter/marketing emails (not transactional), add:
- Unsubscribe link (required by law)
- Privacy policy link
- Physical address (CAN-SPAM compliance)

---

## Forbidden Phrases

Never use these phrases in DSC emails:

| Forbidden | Why | Use Instead |
|-----------|-----|-------------|
| "This is an automated message" | Dehumanizing | (omit entirely) |
| "Do not reply to this email" | Unfriendly | "You can reply directly..." |
| "noreply@..." | Cold, corporate | Real email address |
| "System notification" | Robotic | Describe the actual event |
| "Action required" in subject | Spammy | Be specific about the action |
| "Dear [Title] [Name]" | Too formal | "Hi [Name]," |
| "We regret to inform you" | Stiff | "Unfortunately..." |
| "Click here" | Vague, accessibility issue | "[Specific action]" |
| "Unsubscribe" in transactional | Inappropriate | (only for marketing emails) |

---

## Subject Line Guidelines

### Sender Identity Pattern

All user-facing emails end with: `— The Colorado Songwriters Collective`

This ensures recipients always know who's emailing them.

### Structure

```
[Outcome/Status]: [Event Title] — The Colorado Songwriters Collective
```

**Good examples:**
- "You're on the lineup for Open Mic at The Walnut Room — The Colorado Songwriters Collective"
- "A spot just opened up at Songwriter Showcase — The Colorado Songwriters Collective"
- "Your code for Friday Night Open Mic — The Colorado Songwriters Collective"
- "Reminder: Open Mic is tonight! — The Colorado Songwriters Collective"

**Bad examples:**
- "[DSC] RSVP Confirmation - ID#12345"
- "Action Required: Confirm Your Registration"
- "The Colorado Songwriters Collective Notification"

### Rules

1. **Include event title** when relevant
2. **Lead with outcome**, not action
3. **End with sender identity** (— The Colorado Songwriters Collective)
4. **No ALL CAPS** (except abbreviations)
5. **No emojis** in transactional emails

---

## Urgency & Deadlines

### Time-Sensitive Messages

When action has a deadline, be crystal clear:

```html
<!-- Good: Clear deadline box -->
<div style="background-color: #f59e0b15; border: 1px solid #f59e0b30; ...">
  Confirm by Wed, Dec 18 at 2:30 PM MST to lock in your spot.
</div>
```

### Formatting Deadlines

- Always include day of week: "Wed, Dec 18"
- Always include time with timezone: "2:30 PM MST"
- Use 12-hour format with AM/PM
- Repeat deadline in plain text version

### Urgency Without Panic

| Urgency Level | Language |
|--------------|----------|
| High (hours) | "Confirm by [time] to lock in your spot." |
| Medium (days) | "You have until [date] to confirm." |
| Reminder | "Just a reminder—[event] is tomorrow!" |

---

## Visual Design Tokens

### Colors

```css
/* Background */
--email-bg-page: #0a0a0a;
--email-bg-card: #171717;
--email-bg-subtle: #262626;

/* Text */
--email-text-primary: #ffffff;
--email-text-secondary: #a3a3a3;
--email-text-muted: #737373;
--email-text-accent: #d4a853;

/* Status */
--email-success: #22c55e;
--email-warning: #f59e0b;
--email-error: #ef4444;

/* Buttons */
--email-button-gold: linear-gradient(135deg, #d4a853, #b8943f);
--email-button-green: linear-gradient(135deg, #22c55e, #16a34a);
--email-button-text-on-gold: #0a0a0a;
--email-button-text-on-green: #ffffff;
```

### Typography

```css
/* Font stack (email-safe) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Sizes */
--email-text-sm: 13px;
--email-text-base: 15px;
--email-text-lg: 16px;
--email-heading: 18px;
--email-code: 32px;
```

---

## Template Checklist

Before shipping any email template, verify:

### Content
- [ ] Greeting uses name fallback correctly
- [ ] Subject includes event title (where relevant)
- [ ] One clear primary CTA
- [ ] No forbidden phrases
- [ ] Deadline formatted with day/date/time/timezone
- [ ] Plain text version matches HTML content

### Technical
- [ ] HTML escapes all user input
- [ ] No full email addresses in body
- [ ] No tokens/secrets logged
- [ ] Both `html` and `text` versions provided
- [ ] Links are absolute URLs (not relative)

### Accessibility
- [ ] Alt text for any images (we avoid images)
- [ ] Links are descriptive (not "click here")
- [ ] Color alone doesn't convey meaning
- [ ] Code blocks have high contrast

---

## Examples

### Good: Guest Slot Confirmation

```
Subject: You're on the lineup for Open Mic at The Walnut Room — The Colorado Songwriters Collective

Hi Sarah,

Great news! You're confirmed for Open Mic at The Walnut Room.

You've got slot #3.

[Green success box]
You're on the lineup!

Can't wait to hear you — see you soon!

Questions? Reach out to your host or post a comment on the event page.

I can't make it [link]

---
— The Colorado Songwriters Collective
You can reply directly to this email if you need anything.
```

### Good: Waitlist Offer

```
Subject: A spot just opened up at Songwriter Showcase — The Colorado Songwriters Collective

Hi there,

Good news! A spot just opened up at Songwriter Showcase,
and you're next in line.

[Warning box]
Confirm by Wed, Dec 18 at 2:30 PM MST to lock in your spot.

[GREEN BUTTON: Confirm my spot]

If you can't make it, no worries—just let us know so we can
offer the spot to someone else.

I can't make it [link]

---
— The Colorado Songwriters Collective
You can reply directly to this email if you need anything.
```

---

## Related Files

- `web/src/lib/email/render.ts` - Layout and styling utilities
- `web/src/lib/email/templates/` - Individual template files
- `web/src/lib/email/registry.ts` - Template registry
- `docs/emails/EMAIL_INVENTORY.md` - All email use cases
