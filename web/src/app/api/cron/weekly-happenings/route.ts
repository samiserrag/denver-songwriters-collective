/**
 * Weekly Happenings Cron Handler
 *
 * Triggered by Vercel Cron at 20 23 * * 0 (Sunday 23:20 UTC)
 * MST (winter): Sunday 4:20 PM Denver | MDT (summer): Sunday 5:20 PM Denver
 * Manual seasonal adjustment: use 22:20 UTC for MDT 4:20 PM, 23:20 UTC for MST 4:20 PM.
 * Sends weekly digest emails covering ALL event types to all opted-in users.
 *
 * Control hierarchy (GTM-2):
 * 1. Env var kill switch OFF → skip (emergency override, highest priority)
 * 2. DB digest_settings toggle → primary control (admin panel)
 * 3. Idempotency guard → automatic duplicate prevention
 *
 * GTM-3: Editorial resolution happens AFTER lock acquisition (Delta 1).
 * This prevents wasted DB queries for editorial references on retries
 * where the lock was already claimed by a previous invocation.
 *
 * Flow: kill switch → auth → DB toggle → fetch happenings/recipients →
 *       claim lock → (if locked: skip) → resolve editorial → send emails
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isDigestPersonalizationEnabled,
  isWeeklyHappeningsDigestEnabled,
} from "@/lib/featureFlags";
import {
  getUpcomingHappenings,
  getDigestRecipients,
  personalizeDigestRecipients,
} from "@/lib/digest/weeklyHappenings";
import { getWeeklyHappeningsDigestEmail } from "@/lib/email/templates/weeklyHappeningsDigest";
import { claimDigestSendLock, computeWeekKey } from "@/lib/digest/digestSendLog";
import { isDigestEnabled } from "@/lib/digest/digestSettings";
import { sendDigestEmails } from "@/lib/digest/sendDigest";
import {
  getEditorial,
  resolveEditorial,
  type ResolvedEditorial,
} from "@/lib/digest/digestEditorial";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for sending all emails

/**
 * GET /api/cron/weekly-happenings
 *
 * Cron endpoint for sending weekly happenings digest.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // ============================================================
  // Kill Switch Check (emergency override — env var)
  // ============================================================
  if (!isWeeklyHappeningsDigestEnabled()) {
    console.log("[WeeklyHappenings] Env var kill switch OFF - skipping");
    return NextResponse.json(
      { success: true, message: "Kill switch disabled", sent: 0 },
      { status: 200 }
    );
  }

  // ============================================================
  // Auth Check (CRON_SECRET)
  // ============================================================
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[WeeklyHappenings] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[WeeklyHappenings] Unauthorized request");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ============================================================
  // Main Logic
  // ============================================================
  try {
    const supabase = createServiceRoleClient();

    // ============================================================
    // DB Toggle Check (primary control — admin panel)
    // ============================================================
    const dbEnabled = await isDigestEnabled(supabase, "weekly_happenings");
    if (!dbEnabled) {
      console.log("[WeeklyHappenings] DB toggle OFF - skipping");
      return NextResponse.json(
        { success: true, message: "Digest disabled in admin settings", sent: 0 },
        { status: 200 }
      );
    }

    // ============================================================
    // Idempotency Guard — prevent duplicate sends
    // ============================================================
    const weekKey = computeWeekKey();
    console.log(`[WeeklyHappenings] Week key: ${weekKey}`);

    // Fetch happenings for the week (all event types)
    console.log("[WeeklyHappenings] Fetching upcoming happenings...");
    const digestData = await getUpcomingHappenings(supabase);
    console.log(`[WeeklyHappenings] Found ${digestData.totalCount} happenings across ${digestData.venueCount} venues`);

    // Fetch recipients
    console.log("[WeeklyHappenings] Fetching recipients...");
    const recipients = await getDigestRecipients(supabase);
    console.log(`[WeeklyHappenings] Found ${recipients.length} eligible recipients`);

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: true, message: "No eligible recipients", sent: 0 },
        { status: 200 }
      );
    }

    const personalizationEnabled = isDigestPersonalizationEnabled();
    const personalized = await personalizeDigestRecipients(
      supabase,
      recipients,
      digestData,
      {
        enabled: personalizationEnabled,
        logPrefix: "[WeeklyHappenings]",
      }
    );
    const recipientsToSend = personalized.recipients;

    if (personalizationEnabled) {
      console.log(
        `[WeeklyHappenings] Personalization enabled: ${personalized.personalizedCount} personalized, ${personalized.skippedCount} skipped`
      );
    }

    if (recipientsToSend.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No recipients after personalization filters",
          sent: 0,
          skippedByFilters: personalized.skippedCount,
        },
        { status: 200 }
      );
    }

    // Attempt to claim idempotency lock before sending
    const lock = await claimDigestSendLock(
      supabase,
      "weekly_happenings",
      recipientsToSend.length,
      weekKey
    );

    if (!lock.acquired) {
      if (lock.reason === "lock_error") {
        console.error(`[WeeklyHappenings] Idempotency lock error for ${weekKey}; skipping send to prevent duplicates`);
        return NextResponse.json(
          { error: "Idempotency lock error", skipped: true, reason: "lock_error", weekKey },
          { status: 500 }
        );
      }
      console.log(`[WeeklyHappenings] Already sent for ${weekKey} — skipping`);
      return NextResponse.json(
        { success: true, message: `Already sent for ${weekKey}`, sent: 0, skipped: true, reason: "already_sent" },
        { status: 200 }
      );
    }

    // ============================================================
    // GTM-3: Resolve editorial AFTER lock (Delta 1)
    // Editorial resolution involves extra DB queries (events, profiles,
    // venues, blog posts, gallery albums). Only do this work if we
    // actually acquired the lock — prevents wasted queries on retries.
    // ============================================================
    let resolvedEditorial: ResolvedEditorial | undefined;
    try {
      const editorial = await getEditorial(supabase, weekKey, "weekly_happenings");
      if (editorial) {
        console.log(`[WeeklyHappenings] Found editorial for ${weekKey}, resolving references...`);
        resolvedEditorial = await resolveEditorial(supabase, editorial);
        console.log("[WeeklyHappenings] Editorial resolved successfully");
      } else {
        console.log(`[WeeklyHappenings] No editorial for ${weekKey} — sending without editorial`);
      }
    } catch (editorialError) {
      // Editorial failure is non-fatal — send digest without editorial
      console.warn("[WeeklyHappenings] Editorial resolution failed, sending without editorial:", editorialError);
    }

    // Send emails to all recipients using shared send function
    const result = await sendDigestEmails({
      mode: "full",
      recipients: recipientsToSend,
      buildEmail: (recipient) => {
        const recipientDigestData =
          personalized.digestByUserId.get(recipient.userId) || digestData;

        return getWeeklyHappeningsDigestEmail({
          firstName: recipient.firstName,
          userId: recipient.userId,
          byDate: recipientDigestData.byDate,
          totalCount: recipientDigestData.totalCount,
          venueCount: recipientDigestData.venueCount,
          editorial: resolvedEditorial,
        });
      },
      templateName: "weeklyHappeningsDigest",
      logPrefix: "[WeeklyHappenings]",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Weekly happenings digest sent",
        sent: result.sent,
        failed: result.failed,
        totalHappenings: digestData.totalCount,
        totalVenues: digestData.venueCount,
        personalizationEnabled,
        personalizedRecipients: personalized.personalizedCount,
        skippedByFilters: personalized.skippedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[WeeklyHappenings] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
