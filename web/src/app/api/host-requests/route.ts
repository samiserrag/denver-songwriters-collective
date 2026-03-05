import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ADMIN_EMAIL, sendEmail } from "@/lib/email";
import { sendAdminEmailWithPreferences } from "@/lib/email/sendWithPreferences";

interface AdminRecipient {
  userId: string | null;
  email: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function resolveAdminRecipients(
  supabase: SupabaseClient<Database>
): Promise<AdminRecipient[]> {
  const fallback: AdminRecipient = { userId: null, email: ADMIN_EMAIL };
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")
    .not("email", "is", null);

  if (error) {
    console.error("[HostRequest] Failed to resolve admin recipients:", error);
    return [fallback];
  }

  const byEmail = new Map<string, AdminRecipient>();
  for (const row of data || []) {
    const email = row.email?.trim();
    if (!email) continue;
    byEmail.set(normalizeEmail(email), { userId: row.id, email });
  }

  if (!byEmail.has(normalizeEmail(ADMIN_EMAIL))) {
    byEmail.set(normalizeEmail(ADMIN_EMAIL), fallback);
  }

  return [...byEmail.values()];
}

// POST - Create host request
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await request.json();

  // Check if already an approved host
  const { data: existingHost } = await supabase
    .from("approved_hosts")
    .select()
    .eq("user_id", sessionUser.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingHost) {
    return NextResponse.json(
      { error: "Already an approved host" },
      { status: 400 }
    );
  }

  // Check for pending request
  const { data: pendingRequest } = await supabase
    .from("host_requests")
    .select()
    .eq("user_id", sessionUser.id)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingRequest) {
    return NextResponse.json(
      { error: "Request already pending" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("host_requests")
    .insert({
      user_id: sessionUser.id,
      message,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", sessionUser.id)
    .maybeSingle();
  const requesterName = requesterProfile?.full_name || sessionUser.email || "A member";
  const requesterEmail = requesterProfile?.email || sessionUser.email || "unknown";
  const requestMessage =
    typeof message === "string" && message.trim().length > 0
      ? message.trim().slice(0, 500)
      : "No message provided.";

  const subject = `[CSC Host Request] ${requesterName} requested host access`;
  const html = `
    <p>A new host request was submitted.</p>
    <p><strong>Requester:</strong> ${requesterName}</p>
    <p><strong>Email:</strong> ${requesterEmail}</p>
    <p><strong>Message:</strong> ${requestMessage}</p>
    <p><a href="https://coloradosongwriterscollective.org/dashboard/admin/claims">Review in admin dashboard</a></p>
  `;
  const text = [
    "A new host request was submitted.",
    `Requester: ${requesterName}`,
    `Email: ${requesterEmail}`,
    `Message: ${requestMessage}`,
    "Review: https://coloradosongwriterscollective.org/dashboard/admin/claims",
  ].join("\n");

  try {
    const serviceClient = createServiceRoleClient();
    const recipients = await resolveAdminRecipients(serviceClient);
    const payloadBase = { subject, html, text, templateName: "adminEventClaimNotification" as const };

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        sendAdminEmailWithPreferences(
          serviceClient,
          recipient.userId,
          "adminEventClaimNotification",
          { ...payloadBase, to: recipient.email }
        )
      )
    );
    const failedCount = results.filter((r) => r.status === "rejected").length;
    if (failedCount > 0) {
      console.error(`[HostRequest] Failed to send ${failedCount} admin host request emails`);
    }
  } catch (emailError) {
    console.error("[HostRequest] Failed to send admin host request emails, using fallback:", emailError);
    try {
      await sendEmail({ to: ADMIN_EMAIL, subject, html, text, templateName: "adminEventClaimNotification" });
    } catch (fallbackError) {
      console.error("[HostRequest] Fallback host request email failed:", fallbackError);
    }
  }

  return NextResponse.json(data);
}

// GET - Get user's host request status
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if approved host
  const { data: hostStatus } = await supabase
    .from("approved_hosts")
    .select("*")
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (hostStatus) {
    return NextResponse.json({ isHost: true, status: hostStatus.status });
  }

  // Check for request
  const { data: hostRequest } = await supabase
    .from("host_requests")
    .select("*")
    .eq("user_id", sessionUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    isHost: false,
    request: hostRequest || null,
  });
}
