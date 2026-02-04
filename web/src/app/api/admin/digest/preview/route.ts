/**
 * Admin Digest Preview API
 *
 * GET /api/admin/digest/preview?type=weekly_happenings
 *
 * Returns the HTML preview of a digest email (dry run, no emails sent).
 * Uses the shared sendDigestEmails in dryRun mode.
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
import type { DigestType } from "@/lib/digest/digestSendLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  const digestType = request.nextUrl.searchParams.get("type") as DigestType | null;
  if (!digestType || !["weekly_happenings", "weekly_open_mics"].includes(digestType)) {
    return NextResponse.json(
      { error: "Invalid or missing type parameter" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    if (digestType === "weekly_happenings") {
      const digestData = await getUpcomingHappenings(serviceClient);
      const recipients = await getDigestRecipients(serviceClient);

      if (recipients.length === 0) {
        return NextResponse.json(
          { error: "No eligible recipients found" },
          { status: 404 }
        );
      }

      const result = await sendDigestEmails({
        mode: "dryRun",
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
        logPrefix: "[AdminPreview]",
      });

      return NextResponse.json({
        subject: result.previewSubject,
        html: result.previewHtml,
        recipientCount: result.total,
        totalHappenings: digestData.totalCount,
        totalVenues: digestData.venueCount,
      });
    } else {
      const digestData = await getUpcomingOpenMics(serviceClient);
      const recipients = await getOpenMicRecipients(serviceClient);

      if (recipients.length === 0) {
        return NextResponse.json(
          { error: "No eligible recipients found" },
          { status: 404 }
        );
      }

      const result = await sendDigestEmails({
        mode: "dryRun",
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
        logPrefix: "[AdminPreview]",
      });

      return NextResponse.json({
        subject: result.previewSubject,
        html: result.previewHtml,
        recipientCount: result.total,
        totalOpenMics: digestData.totalCount,
        totalVenues: digestData.venueCount,
      });
    }
  } catch (error) {
    console.error("[AdminDigestPreview] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
