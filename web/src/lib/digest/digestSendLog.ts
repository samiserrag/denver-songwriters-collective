/**
 * Digest Send Log — Idempotency Guard
 *
 * Prevents duplicate weekly digest emails by using a database unique
 * constraint on (digest_type, week_key) as an idempotency lock.
 *
 * How it works:
 * 1. Before sending, attempt INSERT into digest_send_log
 * 2. If INSERT succeeds → this is the first run, proceed with sending
 * 3. If INSERT fails (unique violation) → already sent this week, skip
 * 4. If INSERT fails (any other error) → fail-closed, do NOT send
 *
 * The week_key is deterministic: ISO week number in America/Denver timezone.
 * This ensures the same cron invocation always produces the same key,
 * regardless of retries or race conditions.
 *
 * Phase: Email Safety Fixes (P1)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DigestType = "weekly_open_mics" | "weekly_happenings";

/**
 * Compute the deterministic week key for a given date in America/Denver timezone.
 *
 * Format: "YYYY-Www" (e.g., "2026-W05")
 *
 * Uses the Denver-local date to determine the ISO week, ensuring that
 * a cron firing at Sunday 3:00 UTC (Saturday 8:00 PM Denver) and any
 * retries on Sunday morning Denver time produce the same week key.
 */
export function computeWeekKey(date: Date = new Date()): string {
  // Get the date components in America/Denver timezone
  const denverDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Denver" })
  );

  // ISO week number calculation
  // ISO 8601: Week 1 is the week containing the first Thursday of the year
  const target = new Date(denverDate.valueOf());
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = target.getDay() || 7; // Convert Sunday=0 to 7
  target.setDate(target.getDate() + 4 - dayNum);

  // Get first day of year
  const yearStart = new Date(target.getFullYear(), 0, 1);

  // Calculate full weeks between yearStart and nearest Thursday
  const weekNum = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  const year = target.getFullYear();
  const paddedWeek = String(weekNum).padStart(2, "0");

  return `${year}-W${paddedWeek}`;
}

export type LockResult = {
  acquired: boolean;
  reason: "acquired" | "already_sent" | "lock_error";
};

/**
 * Attempt to claim the send lock for a digest type and week.
 *
 * Uses INSERT with the unique constraint as an atomic lock.
 * If the row already exists, the INSERT fails and we know
 * this digest was already sent.
 *
 * Fail-closed: any unexpected DB error returns acquired=false
 * with reason="lock_error". Callers MUST NOT send emails on lock_error.
 */
export async function claimDigestSendLock(
  supabase: SupabaseClient,
  digestType: DigestType,
  recipientCount: number,
  weekKey?: string
): Promise<LockResult> {
  const effectiveWeekKey = weekKey ?? computeWeekKey();

  const { error } = await supabase.from("digest_send_log" as string).insert({
    digest_type: digestType,
    week_key: effectiveWeekKey,
    recipient_count: recipientCount,
  });

  if (error) {
    // Unique constraint violation = already sent
    if (error.code === "23505") {
      return { acquired: false, reason: "already_sent" };
    }
    // Fail-closed: unexpected DB error blocks sending to prevent duplicates
    console.error(
      `[DigestSendLog] Idempotency lock error for ${digestType}/${effectiveWeekKey}; skipping send.`,
      error
    );
    return { acquired: false, reason: "lock_error" };
  }

  return { acquired: true, reason: "acquired" };
}

/**
 * Check if a digest has already been sent for the given week.
 * Read-only check — does not acquire the lock.
 *
 * @returns true if already sent, false if not yet sent
 */
export async function hasAlreadySentDigest(
  supabase: SupabaseClient,
  digestType: DigestType,
  weekKey?: string
): Promise<boolean> {
  const effectiveWeekKey = weekKey ?? computeWeekKey();

  const { data, error } = await supabase
    .from("digest_send_log" as string)
    .select("id")
    .eq("digest_type", digestType)
    .eq("week_key", effectiveWeekKey)
    .maybeSingle();

  if (error) {
    console.error(
      `[DigestSendLog] Error checking send status for ${digestType}/${effectiveWeekKey}:`,
      error
    );
    // Fail-closed: if we can't check, report as already sent to block sending
    return true;
  }

  return data !== null;
}
