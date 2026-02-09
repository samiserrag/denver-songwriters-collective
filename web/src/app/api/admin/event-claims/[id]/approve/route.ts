import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getEventClaimApprovedEmail } from "@/lib/email/templates/eventClaimApproved";
import { getEventClaimRejectedEmail } from "@/lib/email/templates/eventClaimRejected";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, sessionUser.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: claim, error: claimError } = await supabase
      .from("event_claims")
      .select("id, event_id, requester_id, status")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (claim.status !== "pending") {
      return NextResponse.json(
        { error: `Claim is already ${claim.status}` },
        { status: 400 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, slug, title, host_id")
      .eq("id", claim.event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { data: requester } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", claim.requester_id)
      .maybeSingle();

    const autoRejectReason = "Event was already claimed by another user.";

    const rejectAndNotify = async (reason: string) => {
      await supabase
        .from("event_claims")
        .update({
          status: "rejected",
          reviewed_by: sessionUser.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", claim.id);

      if (requester?.email) {
        const rejectionEmail = getEventClaimRejectedEmail({
          userName: requester.full_name,
          eventTitle: event.title,
          reason,
        });

        await sendEmailWithPreferences({
          supabase,
          userId: claim.requester_id,
          templateKey: "eventClaimRejected",
          payload: {
            to: requester.email,
            subject: rejectionEmail.subject,
            html: rejectionEmail.html,
            text: rejectionEmail.text,
          },
          notification: {
            type: "claim_rejected",
            title: `Your claim for "${event.title}" was not approved`,
            message: `Reason: ${reason}. If you believe this is an error, contact an admin.`,
            link: "/happenings",
          },
        });
      }
    };

    // If event is already owned, auto-reject stale claim.
    if (event.host_id) {
      await rejectAndNotify(autoRejectReason);
      return NextResponse.json({
        success: true,
        autoRejected: true,
        message: autoRejectReason,
      });
    }

    const { error: approveError } = await supabase
      .from("event_claims")
      .update({
        status: "approved",
        reviewed_by: sessionUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", claim.id);

    if (approveError) {
      return NextResponse.json(
        { error: "Failed to approve claim" },
        { status: 500 }
      );
    }

    // Set canonical host if still unclaimed.
    const { data: updatedEventRows, error: setHostError } = await supabase
      .from("events")
      .update({ host_id: claim.requester_id })
      .eq("id", claim.event_id)
      .is("host_id", null)
      .select("id");

    if (setHostError || !updatedEventRows || updatedEventRows.length === 0) {
      await rejectAndNotify(autoRejectReason);
      return NextResponse.json({
        success: true,
        autoRejected: true,
        message: autoRejectReason,
      });
    }

    // Keep multi-host table in sync with canonical host assignment.
    const { error: hostError } = await supabase.from("event_hosts").insert({
      event_id: claim.event_id,
      user_id: claim.requester_id,
      role: "host",
      invitation_status: "accepted",
      invited_by: sessionUser.id,
    });

    if (hostError && hostError.code !== "23505") {
      console.error("[EventClaimApprove] Failed to sync event_hosts:", hostError);
    }

    if (requester?.email) {
      const approvedEmail = getEventClaimApprovedEmail({
        userName: requester.full_name,
        eventTitle: event.title,
        eventId: event.id,
        eventSlug: event.slug,
      });

      await sendEmailWithPreferences({
        supabase,
        userId: claim.requester_id,
        templateKey: "eventClaimApproved",
        payload: {
          to: requester.email,
          subject: approvedEmail.subject,
          html: approvedEmail.html,
          text: approvedEmail.text,
        },
        notification: {
          type: "claim_approved",
          title: `Your claim for "${event.title}" was approved!`,
          message: `You're now the host of "${event.title}". You can manage it from your dashboard.`,
          link: `/dashboard/my-events/${claim.event_id}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Claim approved.",
    });
  } catch (error) {
    console.error("[EventClaimApprove] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
