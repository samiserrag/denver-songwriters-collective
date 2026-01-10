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
 * POST /api/guest/blog-comment/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates a blog_comment for the guest.
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

    if (verification.action_type !== "blog_comment") {
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
    const verificationData = verification as typeof verification & { blog_post_id?: string };

    const { data: post } = await supabase
      .from("blog_posts")
      .select("id, title, slug, author_id")
      .eq("id", verificationData.blog_post_id!)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
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

    // Blog comments use is_approved for auto-approval
    // Use type cast since migration adds guest columns not yet in generated types
    const { data: comment, error: commentError } = await (supabase as any)
      .from("blog_comments")
      .insert({
        post_id: verificationData.blog_post_id,
        author_id: null, // Guest comment
        guest_name: verification.guest_name,
        guest_email: verification.email,
        guest_verified: true,
        guest_verification_id: verification.id,
        content: pendingCommentData.content,
        parent_id: pendingCommentData.parent_id || null,
        is_approved: true, // Auto-approve guest comments that passed verification
      })
      .select("id, content, created_at, parent_id, guest_name, guest_verified")
      .single();

    if (commentError) {
      console.error("Create blog comment error:", commentError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    await supabase
      .from("guest_verifications")
      .update({ verified_at: verifiedAt, comment_id: comment.id })
      .eq("id", verification.id);

    const postUrl = `/blog/${post.slug || post.id}`;
    const guestName = verification.guest_name || "A guest";

    if (pendingCommentData.parent_id) {
      notifyParentCommentAuthor(
        supabase,
        pendingCommentData.parent_id,
        guestName,
        post.title || "Blog Post",
        postUrl,
        pendingCommentData.content
      ).catch((err) =>
        console.error("Failed to notify parent comment author:", err)
      );
    } else {
      if (post.author_id) {
        notifyBlogAuthor(
          supabase,
          post.author_id,
          guestName,
          post.title || "Blog Post",
          postUrl,
          pendingCommentData.content
        ).catch((err) => console.error("Failed to notify blog author:", err));
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
    console.error("Verify blog comment code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function notifyBlogAuthor(
  supabase: ReturnType<typeof createServiceRoleClient>,
  authorId: string,
  guestName: string,
  postTitle: string,
  postUrl: string,
  commentPreview: string
) {
  const title = `${guestName} (guest) commented on your blog post`;
  const message = `${guestName} (guest) commented on "${postTitle}"`;

  const { data: userData } = await supabase.auth.admin.getUserById(authorId);
  const userEmail = userData?.user?.email;

  const emailData = getContentCommentNotificationEmail({
    contentType: "blog",
    contentTitle: postTitle,
    contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${postUrl}`,
    commenterName: guestName,
    commentPreview: commentPreview.slice(0, 200),
    isReply: false,
  });

  await sendEmailWithPreferences({
    supabase,
    userId: authorId,
    templateKey: "eventCommentNotification",
    payload: userEmail
      ? { to: userEmail, subject: emailData.subject, html: emailData.html, text: emailData.text }
      : { to: "", subject: "", html: "", text: "" },
    notification: {
      type: "blog_comment",
      title,
      message,
      link: `${postUrl}#comments`,
    },
  });
}

async function notifyParentCommentAuthor(
  supabase: ReturnType<typeof createServiceRoleClient>,
  parentCommentId: string,
  guestName: string,
  postTitle: string,
  postUrl: string,
  replyPreview: string
) {
  // Use type cast since migration adds guest_email column not yet in generated types
  const { data: parentComment } = await (supabase as any)
    .from("blog_comments")
    .select("author_id, guest_email")
    .eq("id", parentCommentId)
    .single() as { data: { author_id: string | null; guest_email: string | null } | null };

  if (!parentComment) return;

  if (parentComment.author_id) {
    const title = `${guestName} replied to your comment`;
    const message = `${guestName} replied to your comment on "${postTitle}"`;

    const { data: userData } = await supabase.auth.admin.getUserById(parentComment.author_id);
    const userEmail = userData?.user?.email;

    const emailData = getContentCommentNotificationEmail({
      contentType: "blog",
      contentTitle: postTitle,
      contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${postUrl}`,
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
        type: "blog_comment",
        title,
        message,
        link: `${postUrl}#comments`,
      },
    });
  }
}
