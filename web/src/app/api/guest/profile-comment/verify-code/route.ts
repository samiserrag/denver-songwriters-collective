import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import { verifyCodeHash } from "@/lib/guest-verification/crypto";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getContentCommentNotificationEmail } from "@/lib/email/templates/contentCommentNotification";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/profile-comment/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates a profile_comment for the guest.
 */
export async function POST(request: NextRequest) {
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as VerifyCodeBody;
    const { verification_id, code } = body;

    if (!verification_id || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

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

    if (verification.action_type !== "profile_comment") {
      return NextResponse.json(
        { error: "Invalid verification type" },
        { status: 400 }
      );
    }

    if (verification.verified_at) {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 }
      );
    }

    if (
      verification.locked_until &&
      new Date(verification.locked_until) > new Date()
    ) {
      const retryAfter = Math.ceil(
        (new Date(verification.locked_until).getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again later.", retry_after: retryAfter },
        { status: 429 }
      );
    }

    if (
      verification.code_expires_at &&
      new Date(verification.code_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Code expired. Please request a new one." },
        { status: 400 }
      );
    }

    const isValidCode = verifyCodeHash(code, verification.code || "");

    if (!isValidCode) {
      const newAttempts = (verification.code_attempts || 0) + 1;
      const attemptsRemaining = MAX_CODE_ATTEMPTS - newAttempts;

      const updateData: Record<string, unknown> = { code_attempts: newAttempts };

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
          { error: "Too many failed attempts. Please try again later.", retry_after: LOCKOUT_MINUTES * 60 },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Invalid or expired code", attempts_remaining: attemptsRemaining },
        { status: 400 }
      );
    }

    const verifiedAt = new Date().toISOString();

    // Cast verification to access new columns not yet in generated types
    const verificationData = verification as typeof verification & { profile_id?: string };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, slug")
      .eq("id", verificationData.profile_id!)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

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

    // Use type cast since migration adds guest columns not yet in generated types
    const { data: comment, error: commentError } = await (supabase as any)
      .from("profile_comments")
      .insert({
        profile_id: verificationData.profile_id,
        author_id: null, // Guest comment
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
      console.error("Create profile comment error:", commentError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    await supabase
      .from("guest_verifications")
      .update({ verified_at: verifiedAt, comment_id: comment.id })
      .eq("id", verification.id);

    const profileUrl = `/songwriters/${profile.slug || profile.id}`;
    const guestName = verification.guest_name || "A guest";

    if (pendingCommentData.parent_id) {
      notifyParentCommentAuthor(
        supabase,
        pendingCommentData.parent_id,
        guestName,
        profile.full_name || "Member",
        profileUrl,
        pendingCommentData.content
      ).catch((err) =>
        console.error("Failed to notify parent comment author:", err)
      );
    } else {
      // Notify profile owner
      notifyProfileOwner(
        supabase,
        profile.id,
        guestName,
        profile.full_name || "Member",
        profileUrl,
        pendingCommentData.content
      ).catch((err) => console.error("Failed to notify profile owner:", err));
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
    console.error("Verify profile comment code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function notifyProfileOwner(
  supabase: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  guestName: string,
  profileName: string,
  profileUrl: string,
  commentPreview: string
) {
  const title = `${guestName} (guest) commented on your profile`;
  const message = `${guestName} (guest) left a comment on your profile`;

  const { data: userData } = await supabase.auth.admin.getUserById(ownerId);
  const userEmail = userData?.user?.email;

  const emailData = getContentCommentNotificationEmail({
    contentType: "profile",
    contentTitle: profileName,
    contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${profileUrl}`,
    commenterName: guestName,
    commentPreview: commentPreview.slice(0, 200),
    isReply: false,
  });

  await sendEmailWithPreferences({
    supabase,
    userId: ownerId,
    templateKey: "eventCommentNotification",
    payload: userEmail
      ? { to: userEmail, subject: emailData.subject, html: emailData.html, text: emailData.text }
      : { to: "", subject: "", html: "", text: "" },
    notification: {
      type: "profile_comment",
      title,
      message,
      link: `${profileUrl}#comments`,
    },
  });
}

async function notifyParentCommentAuthor(
  supabase: ReturnType<typeof createServiceRoleClient>,
  parentCommentId: string,
  guestName: string,
  profileName: string,
  profileUrl: string,
  replyPreview: string
) {
  // Use type cast since migration adds guest_email column not yet in generated types
  const { data: parentComment } = await (supabase as any)
    .from("profile_comments")
    .select("author_id, guest_email")
    .eq("id", parentCommentId)
    .single() as { data: { author_id: string | null; guest_email: string | null } | null };

  if (!parentComment) return;

  if (parentComment.author_id) {
    const title = `${guestName} replied to your comment`;
    const message = `${guestName} replied to your comment on ${profileName}'s profile`;

    const { data: userData } = await supabase.auth.admin.getUserById(parentComment.author_id);
    const userEmail = userData?.user?.email;

    const emailData = getContentCommentNotificationEmail({
      contentType: "profile",
      contentTitle: profileName,
      contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${profileUrl}`,
      commenterName: guestName,
      commentPreview: replyPreview.slice(0, 200),
      isReply: true,
    });

    await sendEmailWithPreferences({
      supabase,
      userId: parentComment.author_id,
      templateKey: "eventCommentNotification",
      payload: userEmail
        ? { to: userEmail, subject: emailData.subject, html: emailData.html, text: emailData.text }
        : { to: "", subject: "", html: "", text: "" },
      notification: {
        type: "profile_comment",
        title,
        message,
        link: `${profileUrl}#comments`,
      },
    });
  }
}
