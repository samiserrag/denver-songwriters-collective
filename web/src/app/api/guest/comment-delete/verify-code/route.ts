import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import { verifyCodeHash } from "@/lib/guest-verification/crypto";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/comment-delete/verify-code
 *
 * Verify the code and soft-delete the guest comment.
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

    // Check this is a delete comment verification
    if (verification.action_type !== "delete_comment") {
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
        { error: "Too many failed attempts. Please try again later.", retry_after: retryAfter },
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

    // Verify code
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

    // Code is valid - parse the action data to get table name and comment id
    let actionData: { table_name: string; comment_id: string };
    try {
      actionData = JSON.parse(verification.action_token || "{}");
    } catch {
      return NextResponse.json(
        { error: "Invalid action data" },
        { status: 400 }
      );
    }

    if (!actionData.table_name || !actionData.comment_id) {
      return NextResponse.json(
        { error: "Missing action data" },
        { status: 400 }
      );
    }

    // Soft-delete the comment
    const { error: deleteError } = await (supabase as any)
      .from(actionData.table_name)
      .update({ is_deleted: true })
      .eq("id", actionData.comment_id)
      .eq("guest_email", verification.email); // Extra safety check

    if (deleteError) {
      console.error("Delete comment error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    // Mark verification as used
    await supabase
      .from("guest_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Verify delete code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
