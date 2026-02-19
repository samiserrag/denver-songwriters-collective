/**
 * PR5: Non-Member Token Accept API
 *
 * POST: Validate an attendee invite token and set a session cookie.
 * No authentication required — this is the entry point for non-members.
 *
 * Rate limiting: 10 attempts per IP per 15 minutes (in-memory, resets on deploy).
 * Even with 256-bit token entropy, rate limiting prevents enumeration noise.
 *
 * Service-role used only for:
 * - Token hash lookup in event_attendee_invites
 * - Updating invite status to 'accepted'
 *
 * 404-not-403 on all deny paths.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setAttendeeCookie } from "@/lib/attendee-session/cookie";
import crypto from "crypto";

// ============================================================
// Rate Limiting (in-memory, per-IP)
// ============================================================

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodic cleanup to prevent memory leak (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Parse token
    const body = await request.json().catch(() => ({}));
    const token = body.token?.trim();

    if (!token || typeof token !== "string" || token.length < 32) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // 3. Hash token and look up invite
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const serviceClient = createServiceRoleClient();
    const { data: invite, error: findError } = await serviceClient
      .from("event_attendee_invites")
      .select("id, event_id, email, user_id, status, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (findError || !invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // 4. If invite has a user_id, this is a member invite — don't use token flow.
    // Redirect them to log in and use the member accept flow.
    if (invite.user_id) {
      return NextResponse.json(
        { error: "Please log in to accept this invite", requires_login: true },
        { status: 401 }
      );
    }

    // 5. Validate invite status
    if (invite.status === "revoked") {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    if (
      invite.status === "expired" ||
      isExpired(invite.expires_at)
    ) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // 6. Check if user is actually authenticated — if so, link the invite to their account
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (sessionUser) {
      // Authenticated user with token: link user_id to the email invite
      if (invite.status === "pending") {
        await serviceClient
          .from("event_attendee_invites")
          .update({
            user_id: sessionUser.id,
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invite.id);
      } else if (invite.status === "accepted") {
        // Already accepted — link user_id if not yet linked
        await serviceClient
          .from("event_attendee_invites")
          .update({ user_id: sessionUser.id })
          .eq("id", invite.id)
          .is("user_id", null);
      }

      // Fetch event for response
      const { data: event } = await serviceClient
        .from("events")
        .select("id, title, slug")
        .eq("id", invite.event_id)
        .single();

      return NextResponse.json({
        success: true,
        event: event
          ? { id: event.id, title: event.title, slug: event.slug }
          : { id: invite.event_id },
      });
    }

    // 7. Non-member path: accept invite and set cookie
    if (invite.status === "pending") {
      const { error: updateError } = await serviceClient
        .from("event_attendee_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (updateError) {
        console.error("[AttendeeAcceptToken] Update error:", updateError);
        return NextResponse.json(
          { error: "Failed to accept invite" },
          { status: 500 }
        );
      }
    }
    // If already accepted, just refresh the cookie

    // 8. Set session cookie
    if (!invite.email) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    await setAttendeeCookie({
      event_id: invite.event_id,
      email: invite.email,
      invite_id: invite.id,
    });

    // 9. Fetch event for response
    const { data: event } = await serviceClient
      .from("events")
      .select("id, title, slug")
      .eq("id", invite.event_id)
      .single();

    return NextResponse.json({
      success: true,
      event: event
        ? { id: event.id, title: event.title, slug: event.slug }
        : { id: invite.event_id },
    });
  } catch (error) {
    console.error("[AttendeeAcceptToken] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
