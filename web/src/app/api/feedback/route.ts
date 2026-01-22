import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { sendEmail, ADMIN_EMAIL, getFeedbackNotificationEmail } from "@/lib/email";
import { appLogger } from "@/lib/appLogger";
import { createHash, randomUUID } from "crypto";

// Rate limit: 5 submissions per IP per 24 hours
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 24;

// Attachment limits
const MAX_ATTACHMENTS = 2;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"];

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
    // Parse multipart form data
    const formData = await request.formData();

    const name = formData.get("name") as string | null;
    const email = formData.get("email") as string | null;
    const category = formData.get("category") as string | null;
    const subject = formData.get("subject") as string | null;
    const description = formData.get("description") as string | null;
    const pageUrl = formData.get("pageUrl") as string | null;
    const honeypot = formData.get("honeypot") as string | null;

    // Collect attachment files
    const attachmentFiles: File[] = [];
    for (let i = 0; i < MAX_ATTACHMENTS; i++) {
      const file = formData.get(`attachment${i}`) as File | null;
      if (file && file.size > 0) {
        attachmentFiles.push(file);
      }
    }

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

    // Validate attachments
    for (const file of attachmentFiles) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Only PNG and JPG images are allowed" },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Each file must be 5MB or less" },
          { status: 400 }
        );
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
        attachments: [], // Will be updated after upload
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("[FEEDBACK] Insert failed:", insertError);
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    // Upload attachments to storage
    const attachmentUrls: string[] = [];
    for (const file of attachmentFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `feedback/${feedback.id}/${randomUUID()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await serviceClient.storage
        .from("feedback-attachments")
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[FEEDBACK] Upload failed:", uploadError);
        // Continue without failing the whole submission
      } else {
        // Get signed URL for admin access (valid for 7 days)
        const { data: signedUrlData } = await serviceClient.storage
          .from("feedback-attachments")
          .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

        if (signedUrlData?.signedUrl) {
          attachmentUrls.push(signedUrlData.signedUrl);
        }
      }
    }

    // Update feedback record with attachment URLs
    // Note: attachments column added in migration 20260121200000_feedback_attachments.sql
    // Type cast needed until Supabase types are regenerated after migration
    if (attachmentUrls.length > 0) {
      await (serviceClient as unknown as { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> } } })
        .from("feedback_submissions")
        .update({ attachments: attachmentUrls })
        .eq("id", feedback.id);
    }

    // Send admin notification email
    const emailContent = getFeedbackNotificationEmail({
      category: category as "bug" | "feature" | "other",
      subject: subject.trim(),
      description: description.trim(),
      pageUrl: pageUrl?.trim() || null,
      name: name.trim(),
      email: email.trim(),
      submittedAt: feedback.created_at,
      attachments: attachmentUrls,
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
