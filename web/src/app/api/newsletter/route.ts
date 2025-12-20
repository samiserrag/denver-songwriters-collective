import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, getNewsletterWelcomeEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email, source = "footer" } = await request.json();

    // Validate email format using RFC 5322 compliant regex
    // Requires: valid local part, @ symbol, domain with TLD (min 2 chars)
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = await createSupabaseServerClient();

    // Check if already subscribed
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, unsubscribed_at")
      .eq("email", normalizedEmail)
      .single();

    if (existing && !existing.unsubscribed_at) {
      // Already subscribed and active
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    // Insert or update subscription
    const { error: dbError } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        {
          email: normalizedEmail,
          source: source,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        },
        { onConflict: "email" }
      );

    if (dbError) {
      console.error("Newsletter DB error:", dbError);
      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: 500 }
      );
    }

    // Send welcome email via Fastmail SMTP
    let emailSent = true;
    try {
      const emailContent = getNewsletterWelcomeEmail();
      await sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        templateName: "newsletterWelcome",
      });
    } catch (emailError) {
      // Log but don't fail the signup if email fails
      console.error("Welcome email error:", emailError);
      emailSent = false;
    }

    // Return 202 Accepted if subscription succeeded but email failed
    if (!emailSent) {
      return NextResponse.json(
        { success: true, warning: "Subscribed, but welcome email could not be sent" },
        { status: 202 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
