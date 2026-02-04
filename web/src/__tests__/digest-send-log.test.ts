/**
 * Tests for Digest Send Log — Idempotency Guard
 *
 * Phase: Email Safety Fixes (P1)
 *
 * Verifies:
 * 1. computeWeekKey() returns deterministic, correctly-formatted keys
 * 2. Same timestamp always produces same week key (idempotency)
 * 3. Week key format matches YYYY-Www pattern
 * 4. Different weeks produce different keys
 * 5. Both cron routes import the guard
 * 6. DigestType union covers both digest types
 * 7. Migration schema contracts
 */

import { describe, it, expect } from "vitest";
import { computeWeekKey, type DigestType, type LockResult } from "@/lib/digest/digestSendLog";

// ============================================================
// computeWeekKey — Deterministic Week Key
// ============================================================

describe("computeWeekKey", () => {
  it("returns a string in YYYY-Www format", () => {
    const key = computeWeekKey();
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("returns the same key for the same timestamp (idempotent)", () => {
    const date = new Date("2026-02-01T03:00:00Z"); // Sunday 3 AM UTC = Sat 8 PM Denver
    const key1 = computeWeekKey(date);
    const key2 = computeWeekKey(date);
    expect(key1).toBe(key2);
  });

  it("returns correct week key for a known date", () => {
    // Feb 1, 2026 is a Sunday
    // In Denver (UTC-7), Sunday 3:00 UTC = Saturday Jan 31 8:00 PM
    // ISO week: Jan 31 2026 is in W05 (week containing Thursday Jan 29)
    const date = new Date("2026-02-01T03:00:00Z");
    const key = computeWeekKey(date);
    expect(key).toBe("2026-W05");
  });

  it("returns different keys for different weeks", () => {
    const week1 = computeWeekKey(new Date("2026-02-01T03:00:00Z"));
    const week2 = computeWeekKey(new Date("2026-02-08T03:00:00Z"));
    expect(week1).not.toBe(week2);
  });

  it("handles MST (winter) correctly — Sunday 3:00 UTC = Saturday 8:00 PM Denver", () => {
    // Jan 4, 2026 (Sunday) 3:00 UTC = Jan 3, 2026 (Saturday) 8:00 PM MST
    // Saturday Jan 3 is in ISO week 1 of 2026
    const date = new Date("2026-01-04T03:00:00Z");
    const key = computeWeekKey(date);
    expect(key).toBe("2026-W01");
  });

  it("handles MDT (summer) correctly — Sunday 3:00 UTC = Saturday 9:00 PM Denver", () => {
    // Jul 5, 2026 (Sunday) 3:00 UTC = Jul 4, 2026 (Saturday) 9:00 PM MDT
    // Saturday Jul 4 is in ISO week 27 of 2026
    const date = new Date("2026-07-05T03:00:00Z");
    const key = computeWeekKey(date);
    expect(key).toBe("2026-W27");
  });

  it("produces consistent keys across retry scenarios", () => {
    // Simulate cron fire at 3:00 UTC and retry at 3:05 UTC on same Sunday
    const firstFire = computeWeekKey(new Date("2026-02-01T03:00:00Z"));
    const retry = computeWeekKey(new Date("2026-02-01T03:05:00Z"));
    expect(firstFire).toBe(retry);
  });

  it("produces consistent keys if retry happens hours later on same day", () => {
    // Simulate cron fire at 3:00 UTC and retry at 10:00 UTC on same Sunday
    const firstFire = computeWeekKey(new Date("2026-02-01T03:00:00Z"));
    const laterRetry = computeWeekKey(new Date("2026-02-01T10:00:00Z"));
    expect(firstFire).toBe(laterRetry);
  });

  it("handles year boundary correctly (Dec 29, 2025 → W01 of 2026)", () => {
    // Dec 29, 2025 is a Monday, which is in ISO week 1 of 2026
    // (ISO 8601: week 1 is the week containing the first Thursday of the year)
    const date = new Date("2025-12-29T12:00:00Z");
    const key = computeWeekKey(date);
    // Dec 29 Mon → nearest Thursday = Jan 1 → year = 2026, week = 1
    expect(key).toBe("2026-W01");
  });

  it("pads single-digit week numbers with leading zero", () => {
    // First full week of January
    const date = new Date("2026-01-05T12:00:00Z"); // Monday of W02
    const key = computeWeekKey(date);
    expect(key).toMatch(/W0\d$/);
  });
});

// ============================================================
// DigestType — Type Coverage
// ============================================================

describe("DigestType", () => {
  it("accepts weekly_open_mics", () => {
    const digestType: DigestType = "weekly_open_mics";
    expect(digestType).toBe("weekly_open_mics");
  });

  it("accepts weekly_happenings", () => {
    const digestType: DigestType = "weekly_happenings";
    expect(digestType).toBe("weekly_happenings");
  });
});

// ============================================================
// Cron Route Imports — Guard Integration
// ============================================================

describe("Cron route guard integration", () => {
  it("weekly-open-mics route imports digestSendLog", async () => {
    // Read the route file and verify it imports the guard
    const fs = await import("fs");
    const routePath = "src/app/api/cron/weekly-open-mics/route.ts";
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).toContain('import { claimDigestSendLock, computeWeekKey } from "@/lib/digest/digestSendLog"');
    expect(content).toContain("claimDigestSendLock(");
    expect(content).toContain("computeWeekKey()");
    expect(content).toContain('"weekly_open_mics"');
  });

  it("weekly-happenings route imports digestSendLog", async () => {
    const fs = await import("fs");
    const routePath = "src/app/api/cron/weekly-happenings/route.ts";
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).toContain('import { claimDigestSendLock, computeWeekKey } from "@/lib/digest/digestSendLog"');
    expect(content).toContain("claimDigestSendLock(");
    expect(content).toContain("computeWeekKey()");
    expect(content).toContain('"weekly_happenings"');
  });

  it("both routes return skipped:true when lock not acquired", async () => {
    const fs = await import("fs");

    const openMicsRoute = fs.readFileSync("src/app/api/cron/weekly-open-mics/route.ts", "utf-8");
    const happeningsRoute = fs.readFileSync("src/app/api/cron/weekly-happenings/route.ts", "utf-8");

    // Both routes check lock.acquired and return early if false
    expect(openMicsRoute).toContain("if (!lock.acquired)");
    expect(openMicsRoute).toContain("skipped: true");
    expect(happeningsRoute).toContain("if (!lock.acquired)");
    expect(happeningsRoute).toContain("skipped: true");
  });

  it("guard is placed after auth check and before email send", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/api/cron/weekly-open-mics/route.ts", "utf-8");

    // Find positions of key sections
    const authCheckPos = content.indexOf('authHeader !== `Bearer ${cronSecret}`');
    const lockClaimPos = content.indexOf("claimDigestSendLock(");
    // GTM-2: inline send loop replaced with sendDigestEmails() shared function
    const emailSendPos = content.indexOf("sendDigestEmails(");

    // Guard must be AFTER auth and BEFORE email send
    expect(authCheckPos).toBeGreaterThan(-1);
    expect(lockClaimPos).toBeGreaterThan(-1);
    expect(emailSendPos).toBeGreaterThan(-1);
    expect(lockClaimPos).toBeGreaterThan(authCheckPos);
    expect(emailSendPos).toBeGreaterThan(lockClaimPos);
  });
});

// ============================================================
// Fail-Closed Behavior
// ============================================================

describe("Fail-closed behavior", () => {
  it("LockResult type has three valid reason values", () => {
    const acquired: LockResult = { acquired: true, reason: "acquired" };
    const alreadySent: LockResult = { acquired: false, reason: "already_sent" };
    const lockError: LockResult = { acquired: false, reason: "lock_error" };

    expect(acquired.acquired).toBe(true);
    expect(alreadySent.acquired).toBe(false);
    expect(lockError.acquired).toBe(false);
  });

  it("both routes return 500 with reason=lock_error on DB errors", async () => {
    const fs = await import("fs");

    const openMicsRoute = fs.readFileSync("src/app/api/cron/weekly-open-mics/route.ts", "utf-8");
    const happeningsRoute = fs.readFileSync("src/app/api/cron/weekly-happenings/route.ts", "utf-8");

    for (const content of [openMicsRoute, happeningsRoute]) {
      // lock_error branch returns 500
      expect(content).toContain('reason === "lock_error"');
      expect(content).toContain('reason: "lock_error"');
      expect(content).toContain("{ status: 500 }");
      // already_sent branch returns 200
      expect(content).toContain('reason: "already_sent"');
    }
  });

  it("claimDigestSendLock returns lock_error (not acquired) on unexpected errors — no emails sent", async () => {
    // Verify the helper code returns acquired:false on non-23505 errors
    const fs = await import("fs");
    const helperContent = fs.readFileSync("src/lib/digest/digestSendLog.ts", "utf-8");

    // On non-unique error: returns acquired: false, reason: "lock_error"
    expect(helperContent).toContain('return { acquired: false, reason: "lock_error" }');
    // On unique constraint (23505): returns acquired: false, reason: "already_sent"
    expect(helperContent).toContain('return { acquired: false, reason: "already_sent" }');
    // On success: returns acquired: true
    expect(helperContent).toContain('return { acquired: true, reason: "acquired" }');
    // claimDigestSendLock must NOT contain bare "return true" (fail-open pattern)
    // Extract only the claimDigestSendLock function body for this check
    const fnStart = helperContent.indexOf("export async function claimDigestSendLock");
    const fnEnd = helperContent.indexOf("\nexport", fnStart + 1);
    const fnBody = helperContent.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);
    expect(fnBody).not.toContain("return true");
  });

  it("no email sending occurs after lock_error — routes return before email send", async () => {
    const fs = await import("fs");
    const openMicsRoute = fs.readFileSync("src/app/api/cron/weekly-open-mics/route.ts", "utf-8");

    // The lock_error return statement must come BEFORE the email sending call
    const lockErrorReturnPos = openMicsRoute.indexOf('reason: "lock_error"');
    // GTM-2: inline send loop replaced with sendDigestEmails() shared function
    const emailSendPos = openMicsRoute.indexOf("sendDigestEmails(");

    expect(lockErrorReturnPos).toBeGreaterThan(-1);
    expect(emailSendPos).toBeGreaterThan(-1);
    expect(lockErrorReturnPos).toBeLessThan(emailSendPos);
  });
});

// ============================================================
// Migration Schema Contract
// ============================================================

describe("Migration schema contract", () => {
  it("migration file exists with correct table definition", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationsDir = path.resolve("../supabase/migrations");

    // Find the digest_send_log migration
    const files = fs.readdirSync(migrationsDir);
    const migration = files.find((f: string) => f.includes("digest_send_log"));

    expect(migration).toBeDefined();
    expect(migration).toMatch(/^\d{14}_digest_send_log\.sql$/);

    const content = fs.readFileSync(path.join(migrationsDir, migration!), "utf-8");

    // Table creation
    expect(content).toContain("CREATE TABLE IF NOT EXISTS public.digest_send_log");

    // Required columns
    expect(content).toContain("digest_type TEXT NOT NULL");
    expect(content).toContain("week_key TEXT NOT NULL");
    expect(content).toContain("sent_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    expect(content).toContain("recipient_count INTEGER NOT NULL DEFAULT 0");

    // Unique constraint (idempotency key)
    expect(content).toContain("UNIQUE (digest_type, week_key)");

    // RLS enabled (server-only table)
    expect(content).toContain("ENABLE ROW LEVEL SECURITY");
  });
});
