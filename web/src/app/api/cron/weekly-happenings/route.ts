/**
 * Weekly Happenings Cron Handler
 *
 * Triggered by Vercel Cron at 0 3 * * 0 (Sunday 3:00 AM UTC = 8:00 PM Denver MST)
 * Sends weekly digest emails covering ALL event types to all opted-in users.
 *
 * GTM-1 MVP:
 * - Kill switch: ENABLE_WEEKLY_HAPPENINGS_DIGEST must be "true"
 * - Auth: CRON_SECRET header required
 * - All recipients get the same email (no personalization)
 * - Includes all 9 event types
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { isWeeklyHappeningsDigestEnabled } from "@/lib/featureFlags";
import { sendEmail } from "@/lib/email/mailer";
import {
  getUpcomingHappenings,
  getDigestRecipients,
} from "@/lib/digest/weeklyHappenings";
import { getWeeklyHappeningsDigestEmail } from "@/lib/email/templates/weeklyHappeningsDigest";

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
  // Kill Switch Check
  // ============================================================
  if (!isWeeklyHappeningsDigestEnabled()) {
    console.log("[WeeklyHappenings] Kill switch OFF - skipping");
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

    // Send emails to all recipients
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      // Build email with recipient's name
      const email = getWeeklyHappeningsDigestEmail({
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
        templateName: "weeklyHappeningsDigest",
      });

      if (sent) {
        sentCount++;
      } else {
        failedCount++;
      }

      // Small delay to avoid overwhelming SMTP
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[WeeklyHappenings] Complete: ${sentCount} sent, ${failedCount} failed`);

    return NextResponse.json(
      {
        success: true,
        message: "Weekly happenings digest sent",
        sent: sentCount,
        failed: failedCount,
        totalHappenings: digestData.totalCount,
        totalVenues: digestData.venueCount,
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
