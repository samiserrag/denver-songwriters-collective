# Invite-20 Admin Runbook

> **Version:** 1.0
> **Last Updated:** 2026-01-17
> **Status:** READY (awaiting Sami's go-ahead)
> **Owner:** Sami Serrag

This runbook guides the first external test user cohort (Invite-20). It covers user selection, invite methods, onboarding expectations, feedback capture, and exit criteria.

---

## 1. Cohort Composition

### Target Mix (20 Users)

| Role | Count | Selection Criteria | Goals |
|------|-------|-------------------|-------|
| **Songwriters/Performers** | 8 | Active Denver-area performers who attend open mics | Test discovery, RSVP, profile creation, performer slot signup |
| **Open Mic Hosts** | 4 | Current hosts of known Denver open mics | Test event claiming, happening creation, lineup management |
| **Venue Managers** | 3 | Contacts at venues hosting open mics | Test venue claiming via invite, venue profile editing |
| **Original Music Fans** | 3 | Friends/family who attend shows but don't perform | Test fan-only onboarding path, discovery, RSVP as audience |
| **Multi-Role (Host + Performer)** | 2 | Hosts who also perform at other open mics | Test combined identity flows, multi-role dashboard |

### Role Distribution Rationale

- **40% Performers (8):** Primary user type, validates core discovery + RSVP flow
- **20% Hosts (4):** Tests event management, most complex permission set
- **15% Venue Managers (3):** Tests venue invite flow, lowest-friction entry
- **15% Fans (3):** Validates minimal onboarding path works correctly
- **10% Multi-Role (2):** Edge case coverage for combined identities

---

## 2. Invite Methods by Role

### Authoritative Invite Flow Matrix

| Role | Invite Method | URL/Entry Point | Admin Action Required |
|------|---------------|-----------------|----------------------|
| **Songwriter/Performer** | Direct signup link | `denversongwriterscollective.org/signup` | None (self-service) |
| **Open Mic Host** | Direct signup link + personal outreach | `/signup` → selects "Host" → pending approval | Admin approves host request |
| **Venue Manager** | Admin-created venue invite link | `/venue-invite?token={token}` | Admin creates invite via `/dashboard/admin/venues/[id]` |
| **Fan** | Direct signup link | `/signup` → selects "Fan" only | None (self-service) |
| **Multi-Role** | Direct signup link | `/signup` → selects multiple roles | Admin approves host request if Host selected |

### Invite Message Templates

#### Template A: Songwriter/Performer

```
Subject: You're invited to beta test the Denver Songwriters Collective

Hey [Name],

I'm building a platform for Denver songwriters and performers to discover open mics,
connect with each other, and find what's happening in the local music scene.

I'd love your feedback as a beta tester. Here's your invite link:
https://denversongwriterscollective.org/signup

When you sign up, select "Songwriter / Performer" and complete your profile.
Then explore the happenings, RSVP to one, and let me know what you think!

Takes about 5 minutes to get started.

— Sami
```

#### Template B: Open Mic Host

```
Subject: Claim your open mic on Denver Songwriters Collective

Hey [Name],

I've been working on a platform to help Denver open mic hosts manage their events
and connect with performers. [Event Name] is already listed — I'd love for you
to claim it and take over management.

Sign up here: https://denversongwriterscollective.org/signup

Select "Open Mic Host / Organizer" during signup. I'll approve your host request
right away, then you can claim [Event Name] and manage signups.

Let me know if you have any questions!

— Sami
```

#### Template C: Venue Manager

```
Subject: Manage [Venue Name] on Denver Songwriters Collective

Hey [Name],

I'm inviting you to manage [Venue Name]'s profile on Denver Songwriters Collective.
You'll be able to update venue info, see upcoming happenings, and connect with hosts.

Click here to accept: [INVITE_URL]

(This link expires in 7 days and can only be used once.)

— Sami
```

#### Template D: Fan

```
Subject: Beta test Denver Songwriters Collective

Hey [Name],

I'm building a site to help people discover local music happenings in Denver —
open mics, showcases, song circles, and more.

I'd love your feedback as someone who enjoys live music. Sign up here:
https://denversongwriterscollective.org/signup

Select "Original Music Fan" and check out what's happening this week!

— Sami
```

---

## 3. Onboarding Expectations Checklist

### Pre-Invite Verification (Admin)

Before sending any invites, verify:

- [ ] All P0 items in BACKLOG.md are DONE
- [ ] Quality gates passing (lint, tests, build)
- [ ] Production smoke tests pass (SMOKE-PROD.md tests 16-21)
- [ ] DSC TEST events visible in `/happenings?type=dsc`
- [ ] Getting Started prompts appear for Host identity users
- [ ] Venue invite flow works end-to-end (Test 20)

### Per-User Onboarding Checklist

Track completion for each invited user:

| # | User | Role | Invited | Signed Up | Profile Done | First Action | Feedback |
|---|------|------|---------|-----------|--------------|--------------|----------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| ... | | | | | | | |
| 20 | | | | | | | |

**First Action by Role:**
- Songwriter: RSVP'd to a happening OR viewed 3+ happenings
- Host: Claimed an event OR created a new happening
- Venue Manager: Accepted invite AND edited venue profile
- Fan: RSVP'd to a happening OR viewed 3+ happenings

---

## 4. Feedback Capture Template

### Feedback Collection Method

- **Primary:** Direct message (text, email, or voice)
- **Secondary:** In-person conversation at an open mic
- **Format:** Unstructured initially, then guided prompts if needed

### 6 Feedback Prompts

Send these prompts 3-5 days after signup (Day 3-5):

```
Quick feedback on Denver Songwriters Collective (2 min):

1. What was your first impression when you landed on the site?

2. Did you find what you were looking for? If not, what were you trying to find?

3. Was there anything confusing or frustrating during signup or profile setup?

4. On a scale of 1-5, how likely are you to use this to find/manage open mics? Why?

5. What ONE feature would make this way more useful for you?

6. Anything else you want to share?
```

### Feedback Recording Format

For each user, record:

```
## Feedback: [Name] ([Role])
**Date:** YYYY-MM-DD
**Method:** [text/email/call/in-person]

### Raw Feedback
[Paste their responses]

### Key Insights
- [Insight 1]
- [Insight 2]

### Action Items
- [ ] [Specific fix or feature request]

### Sentiment
[Positive / Neutral / Negative / Mixed]
```

Store feedback in: `docs/feedback/invite-20/[name].md` (create folder when first feedback arrives)

---

## 5. Exit Criteria & Pass/Fail Rules

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Signup completion rate** | ≥80% (16/20) | Invited users who complete signup |
| **Profile completion rate** | ≥70% (14/20) | Signed up users who complete profile |
| **First action rate** | ≥60% (12/20) | Users who take role-appropriate first action |
| **Critical bugs found** | 0 P0 bugs | Bugs that block core flows |
| **Feedback response rate** | ≥50% (10/20) | Users who respond to feedback prompts |

### Pass Criteria (ALL must be true)

- [ ] ≥16 users complete signup
- [ ] ≥12 users complete at least one role-appropriate action
- [ ] 0 P0 bugs blocking core user flows
- [ ] ≥10 users provide actionable feedback
- [ ] No security incidents or data leaks

### Fail Criteria (ANY triggers pause)

- [ ] <12 users complete signup after Day 7
- [ ] ≥3 users report same blocking bug
- [ ] Any data leak or security issue
- [ ] Admin approval flow broken (hosts can't get approved)
- [ ] Venue invite flow broken (managers can't accept)

### Exit Decision Matrix

| Scenario | Action |
|----------|--------|
| All pass criteria met | Proceed to broader rollout planning |
| 1-2 metrics below target but no blockers | Extend timeline by 3 days, targeted outreach |
| Any fail criteria triggered | PAUSE invites, fix issues, restart timeline |
| Security incident | IMMEDIATE PAUSE, incident response, full audit |

---

## 6. Timeline

### Day 0: Invite Day

| Time | Action |
|------|--------|
| Morning | Final smoke test (SMOKE-PROD.md) |
| Morning | Prepare invite messages using templates |
| Afternoon | Send invites in batches (5 at a time, 30 min apart) |
| Evening | Log all invites sent in tracking spreadsheet |

### Day 1-2: Monitor & Support

- Monitor signups in Supabase dashboard
- Respond to any questions within 4 hours
- Approve host requests same-day
- Note any friction points reported

### Day 3: Nudge Day

Send nudge to users who:
- Signed up but didn't complete profile
- Haven't taken first action yet

```
Hey [Name],

Noticed you signed up — thanks! Quick question: did you run into any issues
getting started? Happy to help if something wasn't clear.

— Sami
```

### Day 4-5: Feedback Collection

- Send feedback prompts (Section 4) to users who completed first action
- For users who haven't engaged, send lighter prompt:
  ```
  Hey, was there something missing that kept you from exploring more?
  Even a one-line answer helps!
  ```

### Day 7: Close & Assess

| Task | Owner |
|------|-------|
| Compile all feedback into summary doc | Sami |
| Calculate success metrics | Sami |
| Identify top 3 issues to fix | Sami |
| Make pass/fail decision | Sami |
| Document lessons learned | Sami |

### Post-Day 7: Reporting

Create summary document: `docs/feedback/invite-20/SUMMARY.md`

Contents:
1. Metrics achieved vs targets
2. Top feedback themes
3. Bugs found (with fix status)
4. Recommendations for next cohort
5. Pass/fail decision rationale

---

## 7. Emergency Procedures

### If Core Flow Breaks (P0 Bug)

1. **Pause invites immediately** (don't send more)
2. Post in this doc: "PAUSED: [reason]"
3. Fix the bug (follow GOVERNANCE.md stop-gate protocol)
4. Re-run smoke tests
5. Resume invites only after fix deployed and verified

### If User Reports Security Issue

1. **Acknowledge immediately**: "Thanks for reporting, investigating now"
2. Assess severity (data exposure? auth bypass?)
3. If data exposed: Notify affected users within 24 hours
4. Fix and deploy
5. Post-mortem in `docs/incidents/`

### If Admin Can't Approve Hosts

Workaround (temporary):
1. Direct database update via Supabase dashboard
2. Update `approved_hosts` table manually
3. File P0 bug to fix approval UI

---

## 8. Appendix: Pre-Flight Checklist

Run through before Day 0:

### Technical

- [ ] `npm run lint` — 0 warnings
- [ ] `npm run test -- --run` — all passing
- [ ] `npm run build` — success
- [ ] Production site loads (`denversongwriterscollective.org`)
- [ ] SMOKE-PROD.md tests 16-21 pass

### Content

- [ ] DSC TEST events visible in happenings
- [ ] At least 5 upcoming happenings in next 7 days
- [ ] Homepage hero readable (contrast fix deployed)
- [ ] All invite templates reviewed and personalized

### Admin Access

- [ ] Can access `/dashboard/admin/`
- [ ] Can approve host requests
- [ ] Can create venue invites
- [ ] Can view user signups in Supabase

### Contingency

- [ ] Know how to pause invites (just don't send more)
- [ ] Have backup contact method for users (phone?)
- [ ] Know how to direct-fix database if UI breaks

---

*This runbook is READY for execution. Sami controls the go-ahead date.*
