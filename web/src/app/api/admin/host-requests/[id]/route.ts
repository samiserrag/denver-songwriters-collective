import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmail } from "@/lib/email";
import { getHostApprovalEmail, getHostRejectionEmail } from "@/lib/emailTemplates";

// PATCH - Approve or reject host request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { action, rejection_reason } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Use service role client for admin operations that bypass RLS
  const serviceClient = createServiceRoleClient();

  // Get the request
  const { data: hostRequest, error: fetchError } = await serviceClient
    .from("host_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !hostRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Get the user's email and profile info
  const [userDataRes, profileRes] = await Promise.all([
    serviceClient.auth.admin.getUserById(hostRequest.user_id),
    serviceClient.from("profiles").select("full_name").eq("id", hostRequest.user_id).single(),
  ]);
  const userEmail = userDataRes.data?.user?.email;
  const userName = profileRes.data?.full_name || "there";

  if (action === "approve") {
    // Update request status
    const { error: updateError } = await serviceClient
      .from("host_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating host request:", updateError);
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    // Add to approved hosts
    const { error: insertError } = await serviceClient
      .from("approved_hosts")
      .insert({
        user_id: hostRequest.user_id,
        approved_by: user.id,
      });

    if (insertError) {
      console.error("Error adding approved host:", insertError);
      return NextResponse.json({ error: "Failed to add approved host" }, { status: 500 });
    }

    // Send approval email
    if (userEmail) {
      try {
        const emailData = getHostApprovalEmail({ userName });
        await sendEmail({
          to: userEmail,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        });
      } catch (emailError) {
        console.error("Failed to send host approval email:", emailError);
        // Don't fail the approval if email fails
      }
    }
  } else {
    // Reject
    const { error: rejectError } = await serviceClient
      .from("host_requests")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason,
      })
      .eq("id", id);

    if (rejectError) {
      console.error("Error rejecting host request:", rejectError);
      return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
    }

    // Send rejection email
    if (userEmail) {
      try {
        const emailData = getHostRejectionEmail({ userName, reason: rejection_reason });
        await sendEmail({
          to: userEmail,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        });
      } catch (emailError) {
        console.error("Failed to send host rejection email:", emailError);
        // Don't fail the rejection if email fails
      }
    }
  }

  return NextResponse.json({ success: true });
}
