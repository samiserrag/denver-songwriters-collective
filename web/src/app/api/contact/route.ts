import { NextRequest, NextResponse } from "next/server";
import { sendEmail, ADMIN_EMAIL } from "@/lib/email";
import { escapeHtml } from "@/lib/highlight";

export async function POST(request: NextRequest) {
  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const success = await sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `[DSC Contact] Message from ${name}`,
      html: getContactEmailHtml(name, email, message),
      text: getContactEmailText(name, email, message),
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

function getContactEmailHtml(name: string, email: string, message: string): string {
  // Escape user inputs to prevent HTML injection in email clients
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);

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
            <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #0a0a0a; font-size: 20px; font-weight: bold;">
                New Contact Form Submission
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">From</p>
                    <p style="margin: 0; color: #ffffff; font-size: 16px;">${safeName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</p>
                    <p style="margin: 0; color: #d4a853; font-size: 16px;">
                      <a href="mailto:${safeEmail}" style="color: #d4a853; text-decoration: none;">${safeEmail}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Message</p>
                    <div style="background-color: #262626; border-radius: 8px; padding: 16px;">
                      <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
                    <a href="mailto:${safeEmail}" style="display: inline-block; padding: 12px 24px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Reply to ${safeName}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; border-top: 1px solid #262626; text-align: center;">
              <p style="margin: 0; color: #525252; font-size: 12px;">
                Sent via Denver Songwriters Collective contact form
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

function getContactEmailText(name: string, email: string, message: string): string {
  return `
New Contact Form Submission
============================

From: ${name}
Email: ${email}

Message:
${message}

---
Sent via Denver Songwriters Collective contact form
`;
}
