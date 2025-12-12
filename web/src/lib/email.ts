import nodemailer from "nodemailer";

// Fastmail SMTP configuration
// To get your app password:
// 1. Go to Fastmail Settings > Privacy & Security > Integrations
// 2. Click "Manage" next to "App passwords"
// 3. Create a new app password for "Custom app" with SMTP access
// 4. Use that password as SMTP_PASSWORD in your environment variables

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.fastmail.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // e.g., your-fastmail-username@fastmail.com
    pass: process.env.SMTP_PASSWORD, // Your Fastmail app password
  },
});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const fromEmail = process.env.SMTP_FROM_EMAIL || "admin@denversongwriterscollective.org";
  const fromName = process.env.SMTP_FROM_NAME || "Denver Songwriters Collective";

  // Check if SMTP is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.error("SMTP credentials not configured");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

// Admin email for receiving contact form submissions
export const ADMIN_EMAIL = "admin@denversongwriterscollective.org";
