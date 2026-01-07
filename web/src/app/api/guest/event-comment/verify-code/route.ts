import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationEnabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import { verifyCodeHash } from "@/lib/guest-verification/crypto";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getEventCommentNotificationEmail } from "@/lib/email/templates/eventCommentNotification";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/event-comment/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates an event_comment for the guest.
 */
export async function POST(request: NextRequest) {
  // Feature flag check
  if (!isGuestVerificationEnabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as VerifyCodeBody;
    const { verification_id, code } = body;

    // Validate required fields
    if (!verification_id || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Fetch verification record
    const { data: verification, error: fetchError } = await supabase
      .from("guest_verifications")
      .select("*")
      .eq("id", verification_id)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    // Check this is a comment verification (action_type = "comment")
    if (verification.action_type !== "comment") {
      return NextResponse.json(
        { error: "Invalid verification type" },
        { status: 400 }
      );
    }

    // Check if already verified
    if (verification.verified_at) {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 }
      );
    }

    // Check if locked out
    if (
      verification.locked_until &&
      new Date(verification.locked_until) > new Date()
    ) {
      const retryAfter = Math.ceil(
        (new Date(verification.locked_until).getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          error: "Too many failed attempts. Please try again later.",
          retry_after: retryAfter,
        },
        { status: 429 }
      );
    }

    // Check if expired
    if (
      verification.code_expires_at &&
      new Date(verification.code_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Code expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Verify code (constant-time comparison)
    const isValidCode = verifyCodeHash(code, verification.code || "");

    if (!isValidCode) {
      // Increment attempts
      const newAttempts = (verification.code_attempts || 0) + 1;
      const attemptsRemaining = MAX_CODE_ATTEMPTS - newAttempts;

      // Lock out if too many attempts
      const updateData: Record<string, unknown> = {
        code_attempts: newAttempts,
      };

      if (newAttempts >= MAX_CODE_ATTEMPTS) {
        updateData.locked_until = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        ).toISOString();
      }

      await supabase
        .from("guest_verifications")
        .update(updateData)
        .eq("id", verification_id);

      if (newAttempts >= MAX_CODE_ATTEMPTS) {
        return NextResponse.json(
          {
            error: "Too many failed attempts. Please try again later.",
            retry_after: LOCKOUT_MINUTES * 60,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "Invalid or expired code",
          attempts_remaining: attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // Code is valid - verify the email
    const verifiedAt = new Date().toISOString();

    // Fetch event details
    const { data: event } = await supabase
      .from("events")
      .select("id, slug, title, host_id, is_published")
      .eq("id", verification.event_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!event.is_published) {
      return NextResponse.json(
        { error: "Event is not published" },
        { status: 400 }
      );
    }

    // Parse the pending comment data from action_token
    let pendingCommentData: { content: string; parent_id: string | null };
    try {
      pendingCommentData = JSON.parse(verification.action_token || "{}");
    } catch {
      return NextResponse.json(
        { error: "Invalid comment data" },
        { status: 400 }
      );
    }

    if (!pendingCommentData.content) {
      return NextResponse.json(
        { error: "Missing comment content" },
        { status: 400 }
      );
    }

    // Create the comment
    const { data: comment, error: commentError } = await supabase
      .from("event_comments")
      .insert({
        event_id: verification.event_id,
        user_id: null, // Guest comment
        guest_name: verification.guest_name,
        guest_email: verification.email,
        guest_verified: true,
        guest_verification_id: verification.id,
        content: pendingCommentData.content,
        parent_id: pendingCommentData.parent_id || null,
      })
      .select("id, content, created_at, parent_id, guest_name, guest_verified")
      .single();

    if (commentError) {
      console.error("Create comment error:", commentError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    // Update verification as verified and store comment_id
    await supabase
      .from("guest_verifications")
      .update({
        verified_at: verifiedAt,
        comment_id: comment.id,
      })
      .eq("id", verification.id);

    // Send notifications (fire and forget)
    const eventUrl = `/events/${event.slug || event.id}`;
    const guestName = verification.guest_name || "A guest";

    if (pendingCommentData.parent_id) {
      // Reply: notify parent comment author
      notifyParentCommentAuthor(
        supabase,
        pendingCommentData.parent_id,
        guestName,
        event.title || "Event",
        eventUrl,
        pendingCommentData.content
      ).catch((err) =>
        console.error("Failed to notify parent comment author:", err)
      );
    } else {
      // Top-level comment: notify event host(s)
      notifyEventHosts(
        supabase,
        verification.event_id,
        guestName,
        event.title || "Event",
        eventUrl,
        pendingCommentData.content,
        event.host_id
      ).catch((err) => console.error("Failed to notify event hosts:", err));
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        parent_id: comment.parent_id,
        guest_name: comment.guest_name,
        guest_verified: comment.guest_verified,
      },
    });
  } catch (error) {
    console.error("Verify comment code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Notify event host(s) about a new comment from a guest
 */
async function notifyEventHosts(
  supabase: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  guestName: string,
  eventTitle: string,
  eventUrl: string,
  commentPreview: string,
  fallbackHostId: string | null
) {
  // Get event hosts from event_hosts table
  const { data: hosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("invitation_status", "accepted");

  if (!hosts || hosts.length === 0) {
    // No event_hosts - use fallback host_id
    if (fallbackHostId) {
      await notifyUser(
        supabase,
        fallbackHostId,
        guestName,
        eventTitle,
        eventUrl,
        commentPreview,
        false
      );
    }
    return;
  }

  // Notify each host
  for (const host of hosts) {
    await notifyUser(
      supabase,
      host.user_id,
      guestName,
      eventTitle,
      eventUrl,
      commentPreview,
      false
    );
  }
}

/**
 * Notify parent comment author about a reply from a guest
 */
async function notifyParentCommentAuthor(
  supabase: ReturnType<typeof createServiceRoleClient>,
  parentCommentId: string,
  guestName: string,
  eventTitle: string,
  eventUrl: string,
  replyPreview: string
) {
  // Get parent comment author
  const { data: parentComment } = await supabase
    .from("event_comments")
    .select("user_id, guest_email")
    .eq("id", parentCommentId)
    .single();

  if (!parentComment) return;

  // If parent was a member (has user_id), notify them
  if (parentComment.user_id) {
    await notifyUser(
      supabase,
      parentComment.user_id,
      guestName,
      eventTitle,
      eventUrl,
      replyPreview,
      true
    );
  }
  // Guest comments don't get reply notifications (no account)
}

/**
 * Send dashboard notification + optional email to a user
 */
async function notifyUser(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  commenterName: string,
  eventTitle: string,
  eventUrl: string,
  commentPreview: string,
  isReply: boolean
) {
  const title = isReply
    ? `${commenterName} replied to your comment`
    : `New comment on "${eventTitle}"`;

  const message = isReply
    ? `${commenterName} replied to your comment on "${eventTitle}"`
    : `${commenterName} (guest) commented on your event`;

  // Get user's email via auth admin
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;

  // Build email content
  const emailData = getEventCommentNotificationEmail({
    eventTitle,
    eventUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${eventUrl}#comments`,
    commenterName,
    commentPreview: commentPreview.slice(0, 200),
    isReply,
  });

  // Send notification + email with preferences
  await sendEmailWithPreferences({
    supabase,
    userId,
    templateKey: "eventCommentNotification",
    payload: userEmail
      ? {
          to: userEmail,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        }
      : {
          to: "", // Will skip email if no address
          subject: "",
          html: "",
          text: "",
        },
    notification: {
      type: "event_comment",
      title,
      message,
      link: `${eventUrl}#comments`,
    },
  });
}
