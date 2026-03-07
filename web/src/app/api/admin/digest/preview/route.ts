/**
 * Admin Digest Preview API
 *
 * GET /api/admin/digest/preview?type=weekly_happenings&week_key=2026-W06
 *
 * Returns the HTML preview of a digest email (dry run, no emails sent).
 * Uses the shared sendDigestEmails in dryRun mode.
 *
 * GTM-3: Includes editorial content for the specified week_key (optional).
 *        If no week_key provided, defaults to current week.
 *
 * Admin-only.
 *
 * Phase: GTM-2, GTM-3
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  getUpcomingHappenings,
  getDigestRecipients,
  type DigestRecipient,
  personalizeDigestRecipients,
} from "@/lib/digest/weeklyHappenings";
import { getUpcomingOpenMics, getDigestRecipients as getOpenMicRecipients } from "@/lib/digest/weeklyOpenMics";
import { getWeeklyHappeningsDigestEmail } from "@/lib/email/templates/weeklyHappeningsDigest";
import { getWeeklyOpenMicsDigestEmail } from "@/lib/email/templates/weeklyOpenMicsDigest";
import { sendDigestEmails } from "@/lib/digest/sendDigest";
import { computeWeekKey, type DigestType } from "@/lib/digest/digestSendLog";
import { isDigestPersonalizationEnabled } from "@/lib/featureFlags";
import {
  getEditorial,
  resolveEditorialWithDiagnostics,
  type ResolvedEditorial,
  type EditorialUnresolved,
} from "@/lib/digest/digestEditorial";
import {
  getSavedHappeningsFiltersForUsers,
  hasDigestApplicableFilters,
  toDigestApplicableFilters,
} from "@/lib/happenings/savedFilters";

export const dynamic = "force-dynamic";

type PreviewReasonCode =
  | "gated_out_by_preferences"
  | "no_saved_filters"
  | "no_digest_applicable_filters"
  | "zero_matches_after_filters";

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
      const personalizationEnabled = isDigestPersonalizationEnabled();
      const targetUserId = request.nextUrl.searchParams.get("user_id")?.trim() || null;

      // Targeted per-user preview path (admin-only, dry-run only).
      // Personalization is always forced ON here so admins can validate safely
      // before enabling DIGEST_PERSONALIZATION_ENABLED for production sends.
      if (targetUserId) {
        const { data: targetProfile, error: targetProfileError } = await serviceClient
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", targetUserId)
          .maybeSingle();

        if (targetProfileError) {
          return NextResponse.json(
            { error: "Failed to load target user profile" },
            { status: 500 }
          );
        }

        if (!targetProfile) {
          return NextResponse.json(
            { error: "Target user not found" },
            { status: 404 }
          );
        }

        const { data: preferenceRow, error: preferenceError } = await serviceClient
          .from("notification_preferences")
          .select("email_enabled, email_digests")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (preferenceError) {
          return NextResponse.json(
            { error: "Failed to load target user preferences" },
            { status: 500 }
          );
        }

        const emailEnabled = preferenceRow?.email_enabled ?? true;
        const emailDigests = preferenceRow?.email_digests ?? true;
        const wouldBeExcludedFromSend = !targetProfile.email || !emailEnabled || !emailDigests;

        const savedByUserId = await getSavedHappeningsFiltersForUsers(serviceClient, [targetUserId]);
        const saved = savedByUserId.get(targetUserId) || null;
        const digestApplicableFilters = saved ? toDigestApplicableFilters(saved.filters) : {};
        const hasDigestFilters = hasDigestApplicableFilters(digestApplicableFilters);
        const appliedFilterKeys = Object.entries(digestApplicableFilters)
          .filter(([, value]) => {
            if (Array.isArray(value)) return value.length > 0;
            return Boolean(value);
          })
          .map(([key]) => key);

        const reasonCodes: PreviewReasonCode[] = [];
        if (wouldBeExcludedFromSend) {
          reasonCodes.push("gated_out_by_preferences");
        }
        if (!saved) {
          reasonCodes.push("no_saved_filters");
        } else if (!hasDigestFilters) {
          reasonCodes.push("no_digest_applicable_filters");
        }

        const targetRecipient: DigestRecipient = {
          userId: targetUserId,
          email: targetProfile.email || `preview+${targetUserId}@no-email.local`,
          firstName: targetProfile.full_name?.split(" ")[0] || null,
        };

        const personalized = await personalizeDigestRecipients(
          serviceClient,
          [targetRecipient],
          digestData,
          {
            enabled: true,
            logPrefix: "[AdminPreviewUser]",
          }
        );

        const previewRecipient = personalized.recipients[0];
        if (!previewRecipient) {
          reasonCodes.push("zero_matches_after_filters");
          return NextResponse.json({
            recipientUserId: targetUserId,
            recipientEmail: targetProfile.email,
            noMatchesForUser: true,
            reasonCodes,
            savedFiltersRaw: saved?.filters || {},
            digestApplicableFilters,
            appliedFilterKeys,
            totalHappenings: 0,
            totalVenues: 0,
            dateRange: digestData.dateRange,
            personalizationFlagState: personalizationEnabled,
            personalizationAppliedInPreview: true,
            personalizedRecipients: personalized.personalizedCount,
            skippedByFilters: personalized.skippedCount,
            emailEnabled,
            emailDigests,
            wouldBeExcludedFromSend,
          });
        }

        const recipientDigestData =
          personalized.digestByUserId.get(previewRecipient.userId) || digestData;

        // GTM-3: Resolve editorial for preview
        const weekKey = request.nextUrl.searchParams.get("week_key") || computeWeekKey();
        let resolvedEditorial: ResolvedEditorial | undefined;
        let unresolved: EditorialUnresolved[] = [];
        try {
          const editorial = await getEditorial(serviceClient, weekKey, "weekly_happenings");
          if (editorial) {
            const result = await resolveEditorialWithDiagnostics(serviceClient, editorial);
            resolvedEditorial = result.resolved;
            unresolved = result.unresolved;
            const galleryUnresolved = editorial.gallery_feature_ref
              && !resolvedEditorial.galleryFeature
              && unresolved.some((item) => item.field === "gallery_feature_ref");
            if (galleryUnresolved && editorial.updated_by) {
              resolvedEditorial.galleryFeature = {
                title: "Gallery unavailable (unpublished)",
                url: "",
              };
            }
          }
        } catch (editorialError) {
          console.warn("[AdminPreviewUser] Editorial resolution failed:", editorialError);
        }

        const previewEmail = getWeeklyHappeningsDigestEmail({
          firstName: previewRecipient.firstName,
          userId: previewRecipient.userId,
          byDate: recipientDigestData.byDate,
          totalCount: recipientDigestData.totalCount,
          venueCount: recipientDigestData.venueCount,
          editorial: resolvedEditorial,
        });

        return NextResponse.json({
          recipientUserId: targetUserId,
          recipientEmail: targetProfile.email,
          subject: previewEmail.subject,
          html: previewEmail.html,
          text: previewEmail.text,
          noMatchesForUser: false,
          reasonCodes,
          savedFiltersRaw: saved?.filters || {},
          digestApplicableFilters,
          appliedFilterKeys,
          totalHappenings: recipientDigestData.totalCount,
          totalVenues: recipientDigestData.venueCount,
          dateRange: recipientDigestData.dateRange,
          weekKey,
          unresolved,
          personalizationFlagState: personalizationEnabled,
          personalizationAppliedInPreview: true,
          personalizedRecipients: personalized.personalizedCount,
          skippedByFilters: personalized.skippedCount,
          emailEnabled,
          emailDigests,
          wouldBeExcludedFromSend,
        });
      }

      const recipients = await getDigestRecipients(serviceClient);
      const personalized = await personalizeDigestRecipients(
        serviceClient,
        recipients,
        digestData,
        {
          enabled: personalizationEnabled,
          logPrefix: "[AdminPreview]",
        }
      );
      const recipientsToPreview = personalized.recipients;

      if (recipientsToPreview.length === 0) {
        return NextResponse.json(
          {
            error: personalizationEnabled
              ? "No recipients after personalization filters"
              : "No eligible recipients found",
            skippedByFilters: personalized.skippedCount,
          },
          { status: 404 }
        );
      }

      // GTM-3: Resolve editorial for preview
      const weekKey = request.nextUrl.searchParams.get("week_key") || computeWeekKey();
      let resolvedEditorial: ResolvedEditorial | undefined;
      let unresolved: EditorialUnresolved[] = [];
      try {
        const editorial = await getEditorial(serviceClient, weekKey, "weekly_happenings");
        if (editorial) {
          const result = await resolveEditorialWithDiagnostics(serviceClient, editorial);
          resolvedEditorial = result.resolved;
          unresolved = result.unresolved;
          const galleryUnresolved = editorial.gallery_feature_ref
            && !resolvedEditorial.galleryFeature
            && unresolved.some((item) => item.field === "gallery_feature_ref");
          if (galleryUnresolved && editorial.updated_by) {
            resolvedEditorial.galleryFeature = {
              title: "Gallery unavailable (unpublished)",
              url: "",
            };
          }
        }
      } catch (editorialError) {
        console.warn("[AdminPreview] Editorial resolution failed:", editorialError);
      }

      const result = await sendDigestEmails({
        mode: "dryRun",
        recipients: recipientsToPreview,
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
        logPrefix: "[AdminPreview]",
      });

      return NextResponse.json({
        subject: result.previewSubject,
        html: result.previewHtml,
        recipientCount: result.total,
        totalHappenings: digestData.totalCount,
        totalVenues: digestData.venueCount,
        hasEditorial: !!resolvedEditorial,
        weekKey,
        unresolved,
        personalizationEnabled,
        personalizedRecipients: personalized.personalizedCount,
        skippedByFilters: personalized.skippedCount,
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
