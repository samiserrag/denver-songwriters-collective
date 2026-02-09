import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getEventClaimRejectedEmail } from "@/lib/email/templates/eventClaimRejected";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => ({}));
    const rejectionReason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 500)
        : null;

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

    const { data: event } = await supabase
      .from("events")
      .select("id, slug, title")
      .eq("id", claim.event_id)
      .maybeSingle();

    const eventTitle = event?.title || "the event";

    const { error: rejectError } = await supabase
      .from("event_claims")
      .update({
        status: "rejected",
        reviewed_by: sessionUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq("id", claim.id);

    if (rejectError) {
      return NextResponse.json(
        { error: "Failed to reject claim" },
        { status: 500 }
      );
    }

    const { data: requester } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", claim.requester_id)
      .maybeSingle();

    if (requester?.email) {
      const rejectedEmail = getEventClaimRejectedEmail({
        userName: requester.full_name,
        eventTitle,
        reason: rejectionReason || undefined,
      });

      await sendEmailWithPreferences({
        supabase,
        userId: claim.requester_id,
        templateKey: "eventClaimRejected",
        payload: {
          to: requester.email,
          subject: rejectedEmail.subject,
          html: rejectedEmail.html,
          text: rejectedEmail.text,
        },
        notification: {
          type: "claim_rejected",
          title: `Your claim for "${eventTitle}" was not approved`,
          message: rejectionReason
            ? `Reason: ${rejectionReason}. If you believe this is an error, contact an admin.`
            : "If you believe this is an error, contact an admin.",
          link: "/happenings",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Claim rejected.",
    });
  } catch (error) {
    console.error("[EventClaimReject] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
