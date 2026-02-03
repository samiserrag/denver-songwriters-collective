# Security Invariants (Supabase + CI)

This project enforces a strict, defense-in-depth security posture around
Supabase Row Level Security (RLS), database privileges, and SECURITY DEFINER usage.

These rules are **non-negotiable** and enforced in CI.

---

## Threat Model Addressed

This codebase explicitly defends against:
- Accidental or implicit data exposure via Supabase's REST/Data API
- Privilege escalation through SECURITY DEFINER functions
- Silent regressions from default Postgres / Supabase grants
- "Works locally" schema drift introduced by migrations or manual changes

---

## Enforced Invariants (CI-Guarded)

Every push / PR is checked for the following:

1. **All public tables MUST have RLS enabled**
   - No exceptions.
   - CI fails if any `public` table has RLS disabled.

2. **SECURITY DEFINER functions MUST NOT be callable by `anon` or `public`**
   - Only explicitly allowlisted functions may be callable.
   - Allowlist is intentionally tiny and documented.
   - Prefer server-only RPCs or SECURITY INVOKER functions.

3. **Postgres-owned views MUST use `SECURITY INVOKER`**
   - Postgres-owned views without `security_invoker=true` are treated as
     privilege-escalation risks.
   - Only allowlisted views may bypass this (rare).

4. **Dangerous table privileges are forbidden**
   - `TRUNCATE`, `TRIGGER`, `REFERENCES` are revoked from `anon` and `authenticated`.
   - Default privileges are locked to prevent future drift.
   - CI fails if these privileges reappear.

---

## Tooling

- **CI Tripwire**
  `web/scripts/security/supabase-rls-tripwire.mjs`
  Enforces all invariants above.

- **Human Posture Check**
  `web/scripts/security/security-posture.mjs`
  Quick local summary of the current security state.

- **Governance & Allowlists**
  `web/scripts/security/README.md`
  Defines when (and how) allowlists may be extended.

---

## Allowlist Policy (Strict)

Allowlisting is a last resort.

Before adding an allowlist entry, contributors must document:
1. Why the function/view must be accessible
2. Why safer alternatives were rejected
3. Who approved the exception

**Approval Required:** Sami
**Self-approval is not allowed.**

---

## If CI Fails

Do **not** immediately add an allowlist entry.

Instead:
1. Identify which invariant failed
2. Fix the root cause (RLS, permissions, function design, view ownership)
3. Only consider allowlisting if no safer alternative exists

See: `web/scripts/security/README.md#when-ci-fails`

---

## Summary

This project treats database security as **code**, not configuration.

If you are unsure whether a change is safe:
**assume it is not** and ask before merging.
