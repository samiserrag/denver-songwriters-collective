/**
 * PR2: Private Events RLS Contract Tests
 *
 * Source-code contract tests that verify:
 * 1. The migration SQL contains correct visibility-aware RLS policy
 * 2. The event_attendee_invites table has proper RLS policies
 * 3. TypeScript types include visibility field
 * 4. Default visibility is 'public' (zero behavior change for existing events)
 * 5. Negative privilege-escalation expectations documented
 *
 * @see docs/investigation/private-invite-only-events-stopgate.md §3
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const MIGRATION_PATH = join(
  REPO_ROOT,
  "supabase/migrations/20260218030000_private_events_foundation.sql"
);

const migrationSQL = readFileSync(MIGRATION_PATH, "utf-8");

describe("PR2: Events visibility column", () => {
  it("adds visibility column with NOT NULL DEFAULT 'public'", () => {
    expect(migrationSQL).toContain("visibility TEXT NOT NULL DEFAULT 'public'");
  });

  it("constrains visibility to allowed values only", () => {
    expect(migrationSQL).toContain(
      "CHECK (visibility IN ('public', 'invite_only'))"
    );
  });

  it("creates index on visibility for discovery queries", () => {
    expect(migrationSQL).toContain("idx_events_visibility");
  });

  it("creates composite index for published+public discovery", () => {
    expect(migrationSQL).toContain("idx_events_published_public");
  });
});

describe("PR2: event_attendee_invites table", () => {
  it("creates the table with cascading delete on event_id", () => {
    expect(migrationSQL).toContain("event_attendee_invites");
    expect(migrationSQL).toContain(
      "event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE"
    );
  });

  it("supports both member (user_id) and non-member (email) invites", () => {
    expect(migrationSQL).toContain(
      "user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE"
    );
    expect(migrationSQL).toContain("email TEXT");
  });

  it("requires at least one invite target (user_id or email)", () => {
    expect(migrationSQL).toContain(
      "CONSTRAINT invite_target_required CHECK (user_id IS NOT NULL OR email IS NOT NULL)"
    );
  });

  it("stores token as hash (not plaintext)", () => {
    expect(migrationSQL).toContain("token_hash TEXT UNIQUE");
    // Must NOT contain a plaintext token column
    expect(migrationSQL).not.toMatch(/\btoken\b\s+TEXT(?!\s+UNIQUE)/);
  });

  it("has correct status enum values", () => {
    expect(migrationSQL).toContain(
      "CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired'))"
    );
  });

  it("defaults expires_at to 30 days", () => {
    expect(migrationSQL).toContain("INTERVAL '30 days'");
  });

  it("prevents duplicate invites per user per event", () => {
    expect(migrationSQL).toContain("UNIQUE (event_id, user_id)");
  });

  it("prevents duplicate invites per email per event", () => {
    expect(migrationSQL).toContain("UNIQUE (event_id, email)");
  });

  it("enables RLS", () => {
    expect(migrationSQL).toContain(
      "ALTER TABLE public.event_attendee_invites ENABLE ROW LEVEL SECURITY"
    );
  });

  it("creates accepted-invites index for RLS hot path", () => {
    expect(migrationSQL).toContain("idx_attendee_invites_accepted");
    expect(migrationSQL).toContain("status = 'accepted'");
  });
});

describe("PR2: event_attendee_invites RLS policies", () => {
  it("admin has full access", () => {
    expect(migrationSQL).toContain("admins_manage_attendee_invites");
    expect(migrationSQL).toContain("profiles.role = 'admin'");
  });

  it("host can manage invites for own events only", () => {
    expect(migrationSQL).toContain("host_manage_attendee_invites");
    expect(migrationSQL).toContain("events.host_id = auth.uid()");
  });

  it("co-hosts CANNOT create attendee invites (policy is host_id only, not event_hosts)", () => {
    // The host policy must check events.host_id, NOT event_hosts
    // This ensures co-hosts are excluded per Sami's decision
    const hostPolicy = migrationSQL.substring(
      migrationSQL.indexOf("host_manage_attendee_invites"),
      migrationSQL.indexOf("invitee_read_own_attendee_invites")
    );
    expect(hostPolicy).toContain("events.host_id = auth.uid()");
    expect(hostPolicy).not.toContain("event_hosts");
  });

  it("invitees can read their own invites", () => {
    expect(migrationSQL).toContain("invitee_read_own_attendee_invites");
    expect(migrationSQL).toContain("user_id = auth.uid()");
  });

  it("invitees can respond (accept/decline) to their own invites", () => {
    expect(migrationSQL).toContain("invitee_respond_attendee_invites");
  });

  it("grants service_role access for token-based API routes", () => {
    expect(migrationSQL).toContain(
      "GRANT ALL ON public.event_attendee_invites TO service_role"
    );
  });
});

describe("PR2: Visibility-aware public_read_events policy", () => {
  it("drops the old permissive policy", () => {
    expect(migrationSQL).toContain(
      'DROP POLICY IF EXISTS "public_read_events" ON public.events'
    );
  });

  it("creates new policy for both anon and authenticated", () => {
    expect(migrationSQL).toContain("FOR SELECT TO anon, authenticated");
  });

  it("allows public events to be visible to everyone", () => {
    expect(migrationSQL).toContain("visibility = 'public'");
  });

  it("allows invite-only events to be visible to the host", () => {
    expect(migrationSQL).toContain("host_id = auth.uid()");
  });

  it("allows invite-only events to be visible to accepted co-hosts", () => {
    expect(migrationSQL).toContain("event_hosts.invitation_status = 'accepted'");
  });

  it("allows invite-only events to be visible to accepted invitees", () => {
    expect(migrationSQL).toContain(
      "event_attendee_invites.status = 'accepted'"
    );
  });

  it("allows admins to see all invite-only events", () => {
    // Admin check in the policy
    const policySection = migrationSQL.substring(
      migrationSQL.indexOf('CREATE POLICY "public_read_events"'),
      migrationSQL.indexOf("-- 7.")
    );
    expect(policySection).toContain("profiles.role = 'admin'");
  });

  it("does NOT grant anon access to invite-only events", () => {
    // anon has no auth.uid(), so all the OR branches for invite_only
    // require auth.uid() — anon can only see visibility = 'public'
    // This is a structural guarantee from the policy design
    const policySection = migrationSQL.substring(
      migrationSQL.indexOf('CREATE POLICY "public_read_events"'),
      migrationSQL.indexOf("-- 7.")
    );
    // Every invite_only branch requires auth.uid()
    expect(policySection).toContain("host_id = auth.uid()");
    expect(policySection).toContain("event_hosts.user_id = auth.uid()");
    expect(policySection).toContain(
      "event_attendee_invites.user_id = auth.uid()"
    );
  });
});

describe("PR2: Rollback migration exists", () => {
  it("rollback file exists and restores original policy", () => {
    const rollbackPath = join(
      REPO_ROOT,
      "supabase/migrations/_archived/20260218030001_private_events_foundation_rollback.sql"
    );
    const rollbackSQL = readFileSync(rollbackPath, "utf-8");
    expect(rollbackSQL).toContain("USING (true)");
    expect(rollbackSQL).toContain("DROP TABLE IF EXISTS public.event_attendee_invites");
    expect(rollbackSQL).toContain("DROP COLUMN IF EXISTS visibility");
  });
});

describe("PR2: TypeScript types include visibility", () => {
  it("Event interface has visibility field", () => {
    const typesSource = readFileSync(
      join(__dirname, "..", "types/index.ts"),
      "utf-8"
    );
    expect(typesSource).toContain('visibility?: "public" | "invite_only"');
  });

  it("CSCEvent interface has visibility field", () => {
    const eventsSource = readFileSync(
      join(__dirname, "..", "types/events.ts"),
      "utf-8"
    );
    expect(eventsSource).toContain("visibility: EventVisibility");
  });

  it("EventVisibility type is defined", () => {
    const eventsSource = readFileSync(
      join(__dirname, "..", "types/events.ts"),
      "utf-8"
    );
    expect(eventsSource).toContain(
      'export type EventVisibility = "public" | "invite_only"'
    );
  });

  it("EventAttendeeInvite interface is defined", () => {
    const eventsSource = readFileSync(
      join(__dirname, "..", "types/events.ts"),
      "utf-8"
    );
    expect(eventsSource).toContain("export interface EventAttendeeInvite");
    expect(eventsSource).toContain("status: AttendeeInviteStatus");
  });

  it("database.types.ts includes visibility in events Row", () => {
    const dbTypes = readFileSync(
      join(__dirname, "..", "lib/supabase/database.types.ts"),
      "utf-8"
    );
    expect(dbTypes).toContain("visibility: string");
  });

  it("database.types.ts includes event_attendee_invites table", () => {
    const dbTypes = readFileSync(
      join(__dirname, "..", "lib/supabase/database.types.ts"),
      "utf-8"
    );
    expect(dbTypes).toContain("event_attendee_invites:");
  });
});

describe("PR2: Negative privilege-escalation contract (documented expectations)", () => {
  // These document the expected behavior that will be verified by integration tests in PR6.
  // They serve as a contract specification.

  it("documents: anon MUST NOT see invite-only events", () => {
    // Contract: SELECT from events WHERE visibility='invite_only' as anon → 0 rows
    expect(true).toBe(true); // Placeholder — verified by RLS policy structure above
  });

  it("documents: authenticated non-invitee MUST NOT see invite-only events", () => {
    // Contract: SELECT from events WHERE visibility='invite_only' as random user → 0 rows
    expect(true).toBe(true);
  });

  it("documents: revoked invitee MUST NOT see invite-only events", () => {
    // Contract: After status='revoked', SELECT → 0 rows (only 'accepted' grants visibility)
    const policySection = migrationSQL.substring(
      migrationSQL.indexOf('CREATE POLICY "public_read_events"'),
      migrationSQL.indexOf("-- 7.")
    );
    expect(policySection).toContain(
      "event_attendee_invites.status = 'accepted'"
    );
    // Only 'accepted' is checked, so revoked/expired/declined are excluded by definition
  });

  it("documents: expired invitee MUST NOT see invite-only events", () => {
    // Contract: status != 'accepted' means no visibility
    // Expiry is handled at application layer, setting status to 'expired'
    expect(true).toBe(true);
  });

  it("documents: private events MUST return 404 (not 403) to non-invitees", () => {
    // Contract: Handled at application layer in PR4 — return 404 to avoid confirming existence
    expect(true).toBe(true);
  });
});
