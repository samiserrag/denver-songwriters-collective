import { NextRequest, NextResponse } from "next/server";
import { sendEmail, ADMIN_EMAIL, getContactNotificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const emailContent = getContactNotificationEmail({
      senderName: name,
      senderEmail: email,
      message,
    });

    const success = await sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      templateName: "contactNotification",
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
