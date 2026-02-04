/**
 * Admin Digest Send API
 *
 * POST /api/admin/digest/send
 * Body: { digestType: "weekly_happenings" | "weekly_open_mics", mode: "full" | "test" }
 *
 * Modes:
 * - "full": Send to all recipients. Respects idempotency lock (same as cron).
 * - "test": Send to the admin only. Bypasses idempotency lock. Prepends [TEST] to subject.
 *
 * Admin-only.
 *
 * Phase: GTM-2
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { getUpcomingHappenings, getDigestRecipients } from "@/lib/digest/weeklyHappenings";
import { getUpcomingOpenMics, getDigestRecipients as getOpenMicRecipients } from "@/lib/digest/weeklyOpenMics";
import { getWeeklyHappeningsDigestEmail } from "@/lib/email/templates/weeklyHappeningsDigest";
import { getWeeklyOpenMicsDigestEmail } from "@/lib/email/templates/weeklyOpenMicsDigest";
import { sendDigestEmails } from "@/lib/digest/sendDigest";
import { claimDigestSendLock, computeWeekKey } from "@/lib/digest/digestSendLog";
import type { DigestType } from "@/lib/digest/digestSendLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { digestType, mode } = body as {
    digestType: DigestType;
    mode: "full" | "test";
  };

  if (!digestType || !["weekly_happenings", "weekly_open_mics"].includes(digestType)) {
    return NextResponse.json(
      { error: "Invalid digestType" },
      { status: 400 }
    );
  }

  if (!mode || !["full", "test"].includes(mode)) {
    return NextResponse.json(
      { error: "Invalid mode. Must be 'full' or 'test'" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    // Get admin's email for test mode
    const { data: adminProfile } = await serviceClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    if (!adminProfile?.email) {
      return NextResponse.json(
        { error: "Admin profile or email not found" },
        { status: 400 }
      );
    }

    // For test mode, send only to the admin
    if (mode === "test") {
      const adminRecipient = {
        userId: user.id,
        email: adminProfile.email,
        firstName: adminProfile.full_name?.split(" ")[0] || null,
      };

      if (digestType === "weekly_happenings") {
        const digestData = await getUpcomingHappenings(serviceClient);

        const result = await sendDigestEmails({
          mode: "test",
          recipients: [adminRecipient],
          buildEmail: (recipient) =>
            getWeeklyHappeningsDigestEmail({
              firstName: recipient.firstName,
              userId: recipient.userId,
              byDate: digestData.byDate,
              totalCount: digestData.totalCount,
              venueCount: digestData.venueCount,
            }),
          templateName: "weeklyHappeningsDigest",
          logPrefix: "[AdminTestSend]",
        });

        return NextResponse.json({
          success: true,
          mode: "test",
          sent: result.sent,
          failed: result.failed,
          sentTo: adminProfile.email,
        });
      } else {
        const digestData = await getUpcomingOpenMics(serviceClient);

        const result = await sendDigestEmails({
          mode: "test",
          recipients: [adminRecipient],
          buildEmail: (recipient) =>
            getWeeklyOpenMicsDigestEmail({
              firstName: recipient.firstName,
              userId: recipient.userId,
              byDate: digestData.byDate,
              totalCount: digestData.totalCount,
              venueCount: digestData.venueCount,
            }),
          templateName: "weeklyOpenMicsDigest",
          logPrefix: "[AdminTestSend]",
        });

        return NextResponse.json({
          success: true,
          mode: "test",
          sent: result.sent,
          failed: result.failed,
          sentTo: adminProfile.email,
        });
      }
    }

    // Full mode — respects idempotency lock
    const weekKey = computeWeekKey();

    if (digestType === "weekly_happenings") {
      const digestData = await getUpcomingHappenings(serviceClient);
      const recipients = await getDigestRecipients(serviceClient);

      if (recipients.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No eligible recipients",
          sent: 0,
        });
      }

      // Attempt idempotency lock
      const lock = await claimDigestSendLock(
        serviceClient,
        "weekly_happenings",
        recipients.length,
        weekKey
      );

      if (!lock.acquired) {
        return NextResponse.json({
          success: false,
          message:
            lock.reason === "already_sent"
              ? `Already sent for ${weekKey}. Use "Send test to me" to preview without the lock.`
              : "Idempotency lock error. Try again later.",
          skipped: true,
          reason: lock.reason,
          weekKey,
        });
      }

      const result = await sendDigestEmails({
        mode: "full",
        recipients,
        buildEmail: (recipient) =>
          getWeeklyHappeningsDigestEmail({
            firstName: recipient.firstName,
            userId: recipient.userId,
            byDate: digestData.byDate,
            totalCount: digestData.totalCount,
            venueCount: digestData.venueCount,
          }),
        templateName: "weeklyHappeningsDigest",
        logPrefix: "[AdminFullSend]",
      });

      return NextResponse.json({
        success: true,
        mode: "full",
        sent: result.sent,
        failed: result.failed,
        total: result.total,
        weekKey,
      });
    } else {
      const digestData = await getUpcomingOpenMics(serviceClient);
      const recipients = await getOpenMicRecipients(serviceClient);

      if (recipients.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No eligible recipients",
          sent: 0,
        });
      }

      const lock = await claimDigestSendLock(
        serviceClient,
        "weekly_open_mics",
        recipients.length,
        weekKey
      );

      if (!lock.acquired) {
        return NextResponse.json({
          success: false,
          message:
            lock.reason === "already_sent"
              ? `Already sent for ${weekKey}. Use "Send test to me" to preview without the lock.`
              : "Idempotency lock error. Try again later.",
          skipped: true,
          reason: lock.reason,
          weekKey,
        });
      }

      const result = await sendDigestEmails({
        mode: "full",
        recipients,
        buildEmail: (recipient) =>
          getWeeklyOpenMicsDigestEmail({
            firstName: recipient.firstName,
            userId: recipient.userId,
            byDate: digestData.byDate,
            totalCount: digestData.totalCount,
            venueCount: digestData.venueCount,
          }),
        templateName: "weeklyOpenMicsDigest",
        logPrefix: "[AdminFullSend]",
      });

      return NextResponse.json({
        success: true,
        mode: "full",
        sent: result.sent,
        failed: result.failed,
        total: result.total,
        weekKey,
      });
    }
  } catch (error) {
    console.error("[AdminDigestSend] Error:", error);
    return NextResponse.json(
      { error: "Failed to send digest" },
      { status: 500 }
    );
  }
}
