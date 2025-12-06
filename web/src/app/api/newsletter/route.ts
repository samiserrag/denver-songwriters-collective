import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
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
          source: "footer",
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

    // Send welcome email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Denver Songwriters Collective <onboarding@resend.dev>",
            to: normalizedEmail,
            subject: "Welcome to the Denver Songwriters Collective!",
            html: getWelcomeEmailHtml(),
            text: getWelcomeEmailText(),
          }),
        });
      } catch (emailError) {
        // Log but don't fail the signup if email fails
        console.error("Welcome email error:", emailError);
      }
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

function getWelcomeEmailHtml(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #171717; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #0a0a0a; font-size: 24px; font-weight: bold;">
                Denver Songwriters Collective
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Welcome to the community!
              </h2>

              <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                Thanks for joining the Denver Songwriters Collective newsletter. You're now connected to Denver's vibrant songwriter scene.
              </p>

              <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                Here's what you can expect:
              </p>

              <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #a3a3a3; font-size: 16px; line-height: 1.8;">
                <li>Weekly roundups of open mics and songwriter events</li>
                <li>Featured artist spotlights</li>
                <li>Tips and resources for songwriters</li>
                <li>Community news and opportunities</li>
              </ul>

              <p style="margin: 0 0 32px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                In the meantime, explore what's happening in Denver's songwriter community:
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
                    <a href="https://denversongwriters.co/open-mics" style="display: inline-block; padding: 14px 28px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Browse Open Mics
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #262626; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #737373; font-size: 14px;">
                Find your people. Find your stage. Find your songs.
              </p>
              <p style="margin: 0 0 12px 0; color: #525252; font-size: 12px;">
                Denver Songwriters Collective<br>
                <a href="https://denversongwriters.co" style="color: #d4a853; text-decoration: none;">denversongwriters.co</a>
              </p>
              <p style="margin: 0; color: #525252; font-size: 11px;">
                <a href="https://denversongwriters.co/privacy" style="color: #737373; text-decoration: underline;">Privacy Policy</a>
                &nbsp;|&nbsp;
                <a href="https://denversongwriters.co/contact" style="color: #737373; text-decoration: underline;">Contact Us</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function getWelcomeEmailText(): string {
  return `
Welcome to the Denver Songwriters Collective!

Thanks for joining our newsletter. You're now connected to Denver's vibrant songwriter scene.

Here's what you can expect:
- Weekly roundups of open mics and songwriter events
- Featured artist spotlights
- Tips and resources for songwriters
- Community news and opportunities

Browse open mics: https://denversongwriters.co/open-mics

Find your people. Find your stage. Find your songs.

Denver Songwriters Collective
https://denversongwriters.co

Privacy Policy: https://denversongwriters.co/privacy
Contact Us: https://denversongwriters.co/contact
`;
}
