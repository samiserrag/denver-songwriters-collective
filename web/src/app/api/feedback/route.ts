import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { sendEmail, ADMIN_EMAIL, getFeedbackNotificationEmail } from "@/lib/email";
import { appLogger } from "@/lib/appLogger";
import { createHash } from "crypto";

// Rate limit: 5 submissions per IP per 24 hours
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 24;

/**
 * Hash IP address with SHA-256 for privacy
 */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  // Vercel/Cloudflare provide these headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated list, take first
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback for local development
  return "127.0.0.1";
}

/**
 * Check rate limit for IP hash
 */
async function checkRateLimit(ipHash: string): Promise<{ allowed: boolean; count: number }> {
  const serviceClient = createServiceRoleClient();
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

  const { count, error } = await serviceClient
    .from("feedback_submissions")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("[FEEDBACK] Rate limit check failed:", error);
    // On error, allow the request (fail open for UX)
    return { allowed: true, count: 0 };
  }

  const currentCount = count ?? 0;
  return {
    allowed: currentCount < RATE_LIMIT_MAX,
    count: currentCount,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, category, subject, description, pageUrl, honeypot } = body;

    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      // Return success to fool the bot, but don't actually process
      console.log("[FEEDBACK] Honeypot triggered, rejecting submission");
      return NextResponse.json({ success: true });
    }

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Validate category
    const validCategories = ["bug", "feature", "other"];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Validate subject
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (subject.length > 200) {
      return NextResponse.json({ error: "Subject must be 200 characters or less" }, { status: 400 });
    }

    // Validate description
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: "Description must be 5000 characters or less" }, { status: 400 });
    }

    // Validate pageUrl if provided
    if (pageUrl && typeof pageUrl === "string" && pageUrl.trim().length > 0) {
      try {
        new URL(pageUrl);
      } catch {
        return NextResponse.json({ error: "Invalid page URL" }, { status: 400 });
      }
    }

    // Hash IP for rate limiting
    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp);

    // Check rate limit
    const rateLimit = await checkRateLimit(ipHash);
    if (!rateLimit.allowed) {
      console.log(`[FEEDBACK] Rate limit exceeded for IP hash: ${ipHash.substring(0, 8)}...`);
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Get user_id if logged in
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // Insert feedback using service role (bypasses RLS for INSERT)
    const serviceClient = createServiceRoleClient();
    const { data: feedback, error: insertError } = await serviceClient
      .from("feedback_submissions")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        user_id: userId,
        category,
        subject: subject.trim(),
        description: description.trim(),
        page_url: pageUrl?.trim() || null,
        ip_hash: ipHash,
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("[FEEDBACK] Insert failed:", insertError);
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    // Send admin notification email
    const emailContent = getFeedbackNotificationEmail({
      category,
      subject: subject.trim(),
      description: description.trim(),
      pageUrl: pageUrl?.trim() || null,
      name: name.trim(),
      email: email.trim(),
      submittedAt: feedback.created_at,
    });

    const emailSent = await sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email.trim(),
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      templateName: "feedbackNotification",
    });

    if (!emailSent) {
      // Log but don't fail - the feedback is already saved
      console.error("[FEEDBACK] Failed to send admin notification email");
    }

    console.log(`[FEEDBACK] Submission received: ${category} - ${subject.substring(0, 50)}...`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FEEDBACK] Error:", error);
    await appLogger.logError(
      error instanceof Error ? error : new Error(String(error)),
      "FeedbackAPI"
    );
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
