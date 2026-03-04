import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { notifications } from "@/lib/notifications";
import {
  ADMIN_EMAIL,
  getAdminEventClaimNotificationEmail,
  sendEmail,
} from "@/lib/email";
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
    console.error("[EventClaim] Failed to resolve admin recipients:", error);
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { message?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const rawMessage = body.message?.trim() || "";
    const message = rawMessage.length > 500 ? rawMessage.slice(0, 500) : rawMessage || null;

    // Verify event exists and is still unclaimed.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, slug, title, host_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Happening not found" }, { status: 404 });
    }

    if (event.host_id) {
      return NextResponse.json(
        { error: "This happening already has a host." },
        { status: 409 }
      );
    }

    // Check for existing pending claim by this user.
    const { data: existingClaim } = await supabase
      .from("event_claims")
      .select("id")
      .eq("event_id", event.id)
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        { error: "You already have a pending claim for this happening." },
        { status: 409 }
      );
    }

    const { data: claim, error: claimError } = await supabase
      .from("event_claims")
      .insert({
        event_id: event.id,
        requester_id: sessionUser.id,
        message,
      })
      .select("id")
      .single();

    if (claimError || !claim) {
      if (claimError?.code === "23505") {
        return NextResponse.json(
          { error: "You already have a pending claim for this happening." },
          { status: 409 }
        );
      }

      console.error("[EventClaim] Insert error:", claimError);
      return NextResponse.json(
        { error: "Failed to submit claim" },
        { status: 500 }
      );
    }

    // Fetch requester's display name for admin notification copy.
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", sessionUser.id)
      .maybeSingle();
    const requesterName = requesterProfile?.full_name || "A member";

    // Fire-and-forget notification side effects.
    try {
      await notifications.hostClaim(supabase, {
        userId: sessionUser.id,
        userName: requesterName,
        openMicName: event.title,
        openMicId: event.id,
      });
    } catch (notifyError) {
      console.error("[EventClaim] Failed to create admin notification:", notifyError);
    }

    try {
      const adminEmail = getAdminEventClaimNotificationEmail({
        requesterName,
        eventTitle: event.title,
        eventId: event.id,
        eventSlug: event.slug,
      });

      const serviceRole = getServiceRoleClient();
      const recipients = await resolveAdminRecipients(serviceRole);
      const payloadBase = {
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
        templateName: "adminEventClaimNotification" as const,
      };

      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          sendAdminEmailWithPreferences(
            serviceRole,
            recipient.userId,
            "adminEventClaimNotification",
            {
              ...payloadBase,
              to: recipient.email,
            }
          )
        )
      );

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        console.error(`[EventClaim] Failed to send ${failedCount} admin claim emails`);
      }
    } catch (emailError) {
      console.error("[EventClaim] Failed to send admin claim emails, using fallback:", emailError);
      try {
        const adminEmail = getAdminEventClaimNotificationEmail({
          requesterName,
          eventTitle: event.title,
          eventId: event.id,
          eventSlug: event.slug,
        });
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: adminEmail.subject,
          html: adminEmail.html,
          text: adminEmail.text,
          templateName: "adminEventClaimNotification",
        });
      } catch (fallbackError) {
        console.error("[EventClaim] Fallback admin claim email failed:", fallbackError);
      }
    }

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      message: "Claim submitted! An admin will review your request.",
    });
  } catch (error) {
    console.error("[EventClaim] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
