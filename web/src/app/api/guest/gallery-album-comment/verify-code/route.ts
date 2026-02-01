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
import { SITE_URL } from "@/lib/email/render";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/gallery-album-comment/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates a gallery_album_comment for the guest.
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

    if (verification.action_type !== "gallery_album_comment") {
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
    const verificationData = verification as typeof verification & { gallery_album_id?: string };

    const { data: album } = await supabase
      .from("gallery_albums")
      .select("id, name, slug, created_by")
      .eq("id", verificationData.gallery_album_id!)
      .single();

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
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
      .from("gallery_album_comments")
      .insert({
        album_id: verificationData.gallery_album_id,
        user_id: null,
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
      console.error("Create album comment error:", commentError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    await supabase
      .from("guest_verifications")
      .update({ verified_at: verifiedAt, comment_id: comment.id })
      .eq("id", verification.id);

    const albumUrl = `/gallery/${album.slug || album.id}`;
    const guestName = verification.guest_name || "A guest";

    if (pendingCommentData.parent_id) {
      notifyParentCommentAuthor(
        supabase,
        pendingCommentData.parent_id,
        guestName,
        album.name || "Gallery Album",
        albumUrl,
        pendingCommentData.content
      ).catch((err) =>
        console.error("Failed to notify parent comment author:", err)
      );
    } else {
      if (album.created_by) {
        notifyAlbumOwner(
          supabase,
          album.created_by,
          guestName,
          album.name || "Gallery Album",
          albumUrl,
          pendingCommentData.content
        ).catch((err) => console.error("Failed to notify album owner:", err));
      }
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
    console.error("Verify album comment code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function notifyAlbumOwner(
  supabase: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  guestName: string,
  albumTitle: string,
  albumUrl: string,
  commentPreview: string
) {
  const title = `${guestName} (guest) commented on your album`;
  const message = `${guestName} (guest) commented on "${albumTitle}"`;

  const { data: userData } = await supabase.auth.admin.getUserById(ownerId);
  const userEmail = userData?.user?.email;

  const emailData = getContentCommentNotificationEmail({
    contentType: "album",
    contentTitle: albumTitle,
    contentUrl: `${SITE_URL}${albumUrl}`,
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
      type: "gallery_comment",
      title,
      message,
      link: `${albumUrl}#comments`,
    },
  });
}

async function notifyParentCommentAuthor(
  supabase: ReturnType<typeof createServiceRoleClient>,
  parentCommentId: string,
  guestName: string,
  albumTitle: string,
  albumUrl: string,
  replyPreview: string
) {
  // Use type cast since migration adds guest_email column not yet in generated types
  const { data: parentComment } = await (supabase as any)
    .from("gallery_album_comments")
    .select("user_id, guest_email")
    .eq("id", parentCommentId)
    .single() as { data: { user_id: string | null; guest_email: string | null } | null };

  if (!parentComment) return;

  if (parentComment.user_id) {
    const title = `${guestName} replied to your comment`;
    const message = `${guestName} replied to your comment on "${albumTitle}"`;

    const { data: userData } = await supabase.auth.admin.getUserById(parentComment.user_id);
    const userEmail = userData?.user?.email;

    const emailData = getContentCommentNotificationEmail({
      contentType: "album",
      contentTitle: albumTitle,
      contentUrl: `${SITE_URL}${albumUrl}`,
      commenterName: guestName,
      commentPreview: replyPreview.slice(0, 200),
      isReply: true,
    });

    await sendEmailWithPreferences({
      supabase,
      userId: parentComment.user_id,
      templateKey: "eventCommentNotification",
      payload: userEmail
        ? { to: userEmail, subject: emailData.subject, html: emailData.html, text: emailData.text }
        : { to: "", subject: "", html: "", text: "" },
      notification: {
        type: "gallery_comment",
        title,
        message,
        link: `${albumUrl}#comments`,
      },
    });
  }
}
