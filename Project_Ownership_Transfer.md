# Project Ownership Transfer Plan (Hit-by-a-Bus Readiness)

**Project:** Denver Songwriters Collective  
**Repo:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective`  
**Last Updated:** 2026-03-01  
**Owner:** Sami Serrag  
**Status:** Draft

## 1. Purpose

This document defines how to transfer operational control of the website and related services if the primary owner is unavailable.  
Goal: keep the platform online, secure, and maintainable with minimal downtime.

## 2. Transfer Triggers

Use this plan if any of the following occur:
- Owner unreachable for `>72 hours` during active incident.
- Owner explicitly requests handoff.
- Legal/trustee instruction to transfer operational control.

## 3. Minimum Governance Requirements

- At least **2 active owners/admins** per critical platform.
- No shared human login accounts.
- MFA enabled for all owner/admin accounts.
- Recovery codes and backup keys stored in an approved secure vault.

## 4. System Ownership Matrix

| System | Primary Owner | Backup Owner | Current Access Method | MFA Required | Recovery Path |
|---|---|---|---|---|---|
| GitHub org/repo | TODO | TODO | SSH/PAT | Yes | Org owner recovery + security key backup |
| Vercel project/team | TODO | TODO | SSO/token | Yes | Team owner + backup email |
| Supabase project | TODO | TODO | Org login + service keys | Yes | Org owner recovery |
| OpenAI org/API | TODO | TODO | Org login + API keys | Yes | Org owner recovery + key rotation |
| Domain registrar | TODO | TODO | Registrar login | Yes | Registrar recovery flow |
| DNS provider | TODO | TODO | Provider login/API token | Yes | Provider recovery flow |
| Email provider (SMTP/admin inbox) | TODO | TODO | Provider login/app password | Yes | Provider recovery flow |
| Billing/finance | TODO | TODO | Account login | Yes | Financial admin recovery |

## 5. Secret and Key Custody

## 5.1 Secrets That Must Be Rotatable on Demand
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` / DB password
- SMTP/app password and email provider tokens
- Any webhook/provider API tokens

## 5.2 Storage Policy
- Store production secrets only in approved secret managers/platform env settings.
- Never store live secrets in tracked files.
- Local convenience files (for example `.env.vercel-check`) must be gitignored.

## 5.3 Rotation SOP (Emergency)
1. Revoke/rotate exposed keys first.
2. Update Vercel/Supabase/env stores.
3. Redeploy to invalidate old credentials.
4. Verify app health + logs + spend anomalies.

## 6. Break-Glass Access

Maintain a break-glass package with:
- Backup owner account(s) for each platform
- Recovery codes for MFA
- At least one backup hardware key
- This document + quick command/runbook references

Storage:
- Secure vault location: `TODO`
- Secondary offline location: `TODO`

## 7. Emergency Handoff Procedure

## 7.1 First 24 Hours
1. Confirm control of GitHub, Vercel, Supabase, domain/DNS, email.
2. Rotate high-risk secrets (OpenAI, Supabase service role, SMTP, DB).
3. Verify site uptime and login flows.
4. Check costs/abuse signals (OpenAI, Vercel, SMTP).

## 7.2 First 7 Days
1. Audit all org members and revoke unknown sessions/tokens.
2. Reissue operational API keys with least privilege.
3. Verify backup owner can deploy/rollback independently.
4. Run full production smoke tests.

## 7.3 First 30 Days
1. Formalize long-term ownership roles.
2. Refresh all recovery materials.
3. Run a tabletop incident drill and update this plan.

## 8. Event Creation AI Tract (Current Operational Notes)

Current state from latest production verification:
- Phase 8E smoke passed (chooser, host route, fallback, rollback, mobile checks).
- Host-facing conversational entry is feature-flagged.

Operational controls:
- Launch flag: `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY`
- Lab write flag: `NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES`

Rollback:
1. Set `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=false` (or remove).
2. Redeploy.
3. Verify `/dashboard/my-events/new` shows classic-only path.
4. Verify `/dashboard/my-events/new/conversational` redirects to `?classic=true`.

## 9. Quarterly Continuity Drill

Run every quarter and record date/result.

Checklist:
- Backup owner can log in to all critical systems.
- Backup owner can rotate one non-critical token successfully.
- Backup owner can deploy and rollback.
- MFA recovery path tested (without disabling security controls).
- This doc updated with current names, roles, and links.

## 10. Document Maintenance

- Owner: `TODO`
- Review cadence: Quarterly
- Last reviewed by: `TODO`
- Next review due: `TODO`
