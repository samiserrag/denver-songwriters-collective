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
import { sendEmail, getVerificationCodeEmail } from "@/lib/email";

const {
  CODE_EXPIRES_MINUTES,
  MAX_CODES_PER_EMAIL_PER_HOUR,
} = GUEST_VERIFICATION_CONFIG;

interface RequestCodeBody {
  album_id: string;
  guest_name: string;
  guest_email: string;
  content: string;
  parent_id?: string | null;
}

/**
 * POST /api/guest/gallery-album-comment/request-code
 *
 * Request a verification code for guest comment on a gallery album.
 */
export async function POST(request: NextRequest) {
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as RequestCodeBody;
    const { album_id, guest_name, guest_email, content, parent_id } = body;

    if (!album_id || !guest_name || !guest_email || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const trimmedName = guest_name.trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Guest name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length < 1) {
      return NextResponse.json(
        { error: "Comment content required" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 500) {
      return NextResponse.json(
        { error: "Comment too long (max 500 characters)" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const normalizedEmail = guest_email.toLowerCase().trim();

    // Fetch album and validate
    const { data: album, error: albumError } = await supabase
      .from("gallery_albums")
      .select("id, name, created_by, is_published")
      .eq("id", album_id)
      .single();

    if (albumError || !album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (!album.is_published) {
      return NextResponse.json(
        { error: "Album is not published" },
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

    // Check for lockout
    // Use type cast since migration adds gallery_album_id column not yet in generated types
    const { data: lockedVerification } = await (supabase as any)
      .from("guest_verifications")
      .select("id, locked_until")
      .eq("email", normalizedEmail)
      .eq("gallery_album_id", album_id)
      .not("locked_until", "is", null)
      .gt("locked_until", new Date().toISOString())
      .maybeSingle() as { data: { id: string; locked_until: string | null } | null };

    if (lockedVerification) {
      const lockedUntil = new Date(lockedVerification.locked_until!);
      const retryAfter = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again later.", retry_after: retryAfter },
        { status: 429 }
      );
    }

    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000).toISOString();

    // Delete any existing unverified verifications
    await (supabase as any)
      .from("guest_verifications")
      .delete()
      .eq("email", normalizedEmail)
      .eq("gallery_album_id", album_id)
      .is("verified_at", null);

    const pendingCommentData = JSON.stringify({
      content: trimmedContent,
      parent_id: parent_id || null,
    });

    // Use type cast since migration adds new columns not yet in generated types
    const { data: verification, error: insertError } = await (supabase as any)
      .from("guest_verifications")
      .insert({
        email: normalizedEmail,
        gallery_album_id: album_id,
        guest_name: trimmedName,
        code: codeHash,
        code_expires_at: expiresAt,
        code_attempts: 0,
        locked_until: null,
        verified_at: null,
        action_type: "gallery_album_comment",
        action_token: pendingCommentData,
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

    const emailContent = getVerificationCodeEmail({
      guestName: trimmedName,
      eventTitle: album.name || "Gallery Album",
      code,
      expiresInMinutes: CODE_EXPIRES_MINUTES,
      purpose: "gallery_album_comment",
    });

    await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (process.env.NODE_ENV === "development") {
      const domain = normalizedEmail.split("@")[1];
      console.log(`[DEV] Album comment verification code for @${domain}: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      verification_id: verification.id,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Request album comment code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
