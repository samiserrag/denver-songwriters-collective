/**
 * Weekly Open Mics Cron Handler
 *
 * Triggered by Vercel Cron at 0 3 * * 0 (Sunday 3:00 AM UTC = 8:00 PM Denver MST)
 * Sends personalized weekly digest emails to all opted-in users.
 *
 * Phase 1 MVP:
 * - Kill switch: ENABLE_WEEKLY_DIGEST must be "true"
 * - Auth: CRON_SECRET header required
 * - All recipients get the same email (no personalization)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { isWeeklyDigestEnabled } from "@/lib/featureFlags";
import { sendEmail } from "@/lib/email/mailer";
import {
  getUpcomingOpenMics,
  getDigestRecipients,
} from "@/lib/digest/weeklyOpenMics";
import { getWeeklyOpenMicsDigestEmail } from "@/lib/email/templates/weeklyOpenMicsDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for sending all emails

/**
 * GET /api/cron/weekly-open-mics
 *
 * Cron endpoint for sending weekly open mics digest.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // ============================================================
  // Kill Switch Check
  // ============================================================
  if (!isWeeklyDigestEnabled()) {
    console.log("[WeeklyOpenMics] Kill switch OFF - skipping");
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
    console.error("[WeeklyOpenMics] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[WeeklyOpenMics] Unauthorized request");
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

    // Fetch open mics for the week
    console.log("[WeeklyOpenMics] Fetching upcoming open mics...");
    const digestData = await getUpcomingOpenMics(supabase);
    console.log(`[WeeklyOpenMics] Found ${digestData.totalCount} open mics across ${digestData.venueCount} venues`);

    // Fetch recipients
    console.log("[WeeklyOpenMics] Fetching recipients...");
    const recipients = await getDigestRecipients(supabase);
    console.log(`[WeeklyOpenMics] Found ${recipients.length} eligible recipients`);

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: true, message: "No eligible recipients", sent: 0 },
        { status: 200 }
      );
    }

    // Send emails to all recipients
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      // Build email with recipient's name
      const email = getWeeklyOpenMicsDigestEmail({
        firstName: recipient.firstName,
        byDate: digestData.byDate,
        totalCount: digestData.totalCount,
        venueCount: digestData.venueCount,
      });

      // Send email
      const sent = await sendEmail({
        to: recipient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        templateName: "weeklyOpenMicsDigest",
      });

      if (sent) {
        sentCount++;
      } else {
        failedCount++;
      }

      // Small delay to avoid overwhelming SMTP
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[WeeklyOpenMics] Complete: ${sentCount} sent, ${failedCount} failed`);

    return NextResponse.json(
      {
        success: true,
        message: "Weekly digest sent",
        sent: sentCount,
        failed: failedCount,
        totalOpenMics: digestData.totalCount,
        totalVenues: digestData.venueCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[WeeklyOpenMics] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
