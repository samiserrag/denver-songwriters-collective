import { ADMIN_EMAIL, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/email/render";

type AdminProfileAlertType = "signup" | "profile_update";

interface SendAdminProfileAlertParams {
  type: AdminProfileAlertType;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  profileSlug?: string | null;
  profilePath?: string | null;
  changedFields?: string[];
}

function labelForField(field: string): string {
  return field
    .replace(/^is_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function sendAdminProfileAlert(
  params: SendAdminProfileAlertParams
): Promise<void> {
  const {
    type,
    userId,
    userEmail = null,
    userName = null,
    profileSlug = null,
    profilePath = null,
    changedFields = [],
  } = params;

  const memberPath = profilePath || `/members/${profileSlug || userId}`;
  const memberUrl = `${SITE_URL}${memberPath}`;
  const adminUsersUrl = `${SITE_URL}/dashboard/admin/users`;
  const safeName = userName?.trim() || "New member";
  const safeEmail = userEmail?.trim() || "No email on file";

  const subject =
    type === "signup"
      ? `[CSC Growth] New signup: ${safeName}`
      : `[CSC Activity] Profile updated: ${safeName}`;

  const changedLines =
    type === "profile_update" && changedFields.length > 0
      ? changedFields
          .slice(0, 20)
          .map((field) => `- ${labelForField(field)}`)
          .join("\n")
      : "- (field-level diff not available)";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">
        ${type === "signup" ? "New Member Signup" : "Member Profile Update"}
      </h2>
      <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${safeName}</p>
      <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin: 0 0 10px 0;"><strong>User ID:</strong> ${userId}</p>
      ${
        type === "profile_update"
          ? `<p style="margin: 0 0 6px 0;"><strong>Changed fields:</strong></p>
             <pre style="margin: 0 0 14px 0; padding: 10px; background: #f3f4f6; border-radius: 6px;">${changedLines}</pre>`
          : ""
      }
      <p style="margin: 0 0 8px 0;">
        <a href="${memberUrl}" style="color: #2563eb; text-decoration: none;">View member profile</a>
      </p>
      <p style="margin: 0;">
        <a href="${adminUsersUrl}" style="color: #2563eb; text-decoration: none;">Open admin users directory</a>
      </p>
    </div>
  `;

  const text = [
    type === "signup" ? "New Member Signup" : "Member Profile Update",
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    `User ID: ${userId}`,
    type === "profile_update" ? `Changed fields:\n${changedLines}` : null,
    `Profile: ${memberUrl}`,
    `Admin users: ${adminUsersUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text,
  });
}
