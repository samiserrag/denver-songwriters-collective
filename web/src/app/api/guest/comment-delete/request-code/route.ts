import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import {
  generateVerificationCode,
  hashCode,
} from "@/lib/guest-verification/crypto";
import { sendEmail } from "@/lib/email";

const {
  CODE_EXPIRES_MINUTES,
  MAX_CODES_PER_EMAIL_PER_HOUR,
} = GUEST_VERIFICATION_CONFIG;

// Map of valid table names
const VALID_TABLES = [
  "blog_comments",
  "gallery_photo_comments",
  "gallery_album_comments",
  "profile_comments",
  "event_comments",
];

interface RequestCodeBody {
  comment_id: string;
  table_name: string;
  guest_email: string;
}

/**
 * POST /api/guest/comment-delete/request-code
 *
 * Request a verification code to delete a guest comment.
 * Only the guest who created the comment (verified by email) can delete it.
 */
export async function POST(request: NextRequest) {
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as RequestCodeBody;
    const { comment_id, table_name, guest_email } = body;

    // Validate required fields
    if (!comment_id || !table_name || !guest_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate table name
    if (!VALID_TABLES.includes(table_name)) {
      return NextResponse.json(
        { error: "Invalid table name" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const normalizedEmail = guest_email.toLowerCase().trim();

    // Fetch the comment and verify it's a guest comment with matching email
    const { data: comment, error: commentError } = await (supabase as any)
      .from(table_name)
      .select("id, guest_email, guest_name, is_deleted, content")
      .eq("id", comment_id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify this is a guest comment
    if (!comment.guest_email) {
      return NextResponse.json(
        { error: "This is not a guest comment" },
        { status: 400 }
      );
    }

    // Verify the email matches
    if (comment.guest_email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { error: "Email does not match the comment author" },
        { status: 403 }
      );
    }

    // Check if already deleted
    if (comment.is_deleted) {
      return NextResponse.json(
        { error: "Comment is already deleted" },
        { status: 400 }
      );
    }

    // Rate limiting
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCodes } = await supabase
      .from("guest_verifications")
      .select("id, created_at")
      .eq("email", normalizedEmail)
      .gte("created_at", oneHourAgo);

    if (recentCodes && recentCodes.length >= MAX_CODES_PER_EMAIL_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many requests", retry_after: 3600 },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000).toISOString();

    // Delete any existing unverified delete verifications for this comment
    await (supabase as any)
      .from("guest_verifications")
      .delete()
      .eq("email", normalizedEmail)
      .eq("comment_id", comment_id)
      .eq("action_type", "delete_comment")
      .is("verified_at", null);

    // Store the table name in action_token so we know which table to update
    const actionData = JSON.stringify({
      table_name,
      comment_id,
    });

    // Create verification record
    const { data: verification, error: insertError } = await (supabase as any)
      .from("guest_verifications")
      .insert({
        email: normalizedEmail,
        comment_id: comment_id,
        guest_name: comment.guest_name,
        code: codeHash,
        code_expires_at: expiresAt,
        code_attempts: 0,
        locked_until: null,
        verified_at: null,
        action_type: "delete_comment",
        action_token: actionData,
      })
      .select("id")
      .single();

    if (insertError || !verification) {
      console.error("Insert verification error:", insertError);
      return NextResponse.json(
        { error: "Failed to create verification" },
        { status: 500 }
      );
    }

    // Send verification email
    const emailHtml = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">Delete Your Comment</h2>
        <p>Hi ${comment.guest_name || "there"},</p>
        <p>You requested to delete your comment. Use this code to confirm:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1e3a5f;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in ${CODE_EXPIRES_MINUTES} minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px;">— Denver Songwriters Collective</p>
      </div>
    `;

    const emailText = `
Delete Your Comment

Hi ${comment.guest_name || "there"},

You requested to delete your comment. Use this code to confirm:

${code}

This code expires in ${CODE_EXPIRES_MINUTES} minutes.

If you didn't request this, you can ignore this email.

— Denver Songwriters Collective
    `;

    await sendEmail({
      to: normalizedEmail,
      subject: "Confirm comment deletion",
      html: emailHtml,
      text: emailText,
    });

    if (process.env.NODE_ENV === "development") {
      const domain = normalizedEmail.split("@")[1];
      console.log(`[DEV] Delete comment verification code for @${domain}: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      verification_id: verification.id,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Request delete code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
