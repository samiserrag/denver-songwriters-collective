import { ADMIN_EMAIL, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/email/render";

type AdminEventAlertType = "created" | "edited";

interface SendAdminEventAlertParams {
  type: AdminEventAlertType;
  actorUserId: string;
  actorRole?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  eventId: string;
  eventSlug?: string | null;
  eventTitle?: string | null;
  eventDate?: string | null;
  seriesCount?: number;
  changedFields?: string[];
}

function clean(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export async function sendAdminEventAlert(params: SendAdminEventAlertParams): Promise<void> {
  const {
    type,
    actorUserId,
    actorRole = null,
    actorName = null,
    actorEmail = null,
    eventId,
    eventSlug = null,
    eventTitle = null,
    eventDate = null,
    seriesCount = 1,
    changedFields = [],
  } = params;

  const safeActorName = clean(actorName, "Unknown member");
  const safeActorEmail = clean(actorEmail, "No email on file");
  const safeRole = clean(actorRole, "member");
  const safeTitle = clean(eventTitle, "Untitled event");
  const safeDate = clean(eventDate, "TBD");

  const eventUrl = `${SITE_URL}/events/${eventSlug || eventId}`;
  const adminEventsUrl = `${SITE_URL}/dashboard/admin/events`;
  const manageUrl = `${SITE_URL}/dashboard/my-events/${eventId}`;

  const subject =
    type === "created"
      ? `[CSC Activity] Event created by non-admin: ${safeTitle}`
      : `[CSC Activity] Event edited by non-admin: ${safeTitle}`;

  const changedLines =
    type === "edited" && changedFields.length > 0
      ? changedFields.slice(0, 20).map((field) => `- ${field}`).join("\n")
      : "- (field-level diff not available)";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">
        ${type === "created" ? "Non-admin Event Creation" : "Non-admin Event Edit"}
      </h2>
      <p style="margin: 0 0 10px 0;"><strong>Actor:</strong> ${safeActorName}</p>
      <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${safeActorEmail}</p>
      <p style="margin: 0 0 10px 0;"><strong>Role:</strong> ${safeRole}</p>
      <p style="margin: 0 0 10px 0;"><strong>User ID:</strong> ${actorUserId}</p>
      <p style="margin: 0 0 10px 0;"><strong>Event:</strong> ${safeTitle}</p>
      <p style="margin: 0 0 10px 0;"><strong>Event ID:</strong> ${eventId}</p>
      <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${safeDate}</p>
      ${
        type === "created" && seriesCount > 1
          ? `<p style="margin: 0 0 10px 0;"><strong>Series events created:</strong> ${seriesCount}</p>`
          : ""
      }
      ${
        type === "edited"
          ? `<p style="margin: 0 0 6px 0;"><strong>Changed fields:</strong></p>
             <pre style="margin: 0 0 14px 0; padding: 10px; background: #f3f4f6; border-radius: 6px;">${changedLines}</pre>`
          : ""
      }
      <p style="margin: 0 0 8px 0;">
        <a href="${eventUrl}" style="color: #2563eb; text-decoration: none;">View public event</a>
      </p>
      <p style="margin: 0 0 8px 0;">
        <a href="${manageUrl}" style="color: #2563eb; text-decoration: none;">Open host editor</a>
      </p>
      <p style="margin: 0;">
        <a href="${adminEventsUrl}" style="color: #2563eb; text-decoration: none;">Open admin events dashboard</a>
      </p>
    </div>
  `;

  const text = [
    type === "created" ? "Non-admin Event Creation" : "Non-admin Event Edit",
    `Actor: ${safeActorName}`,
    `Email: ${safeActorEmail}`,
    `Role: ${safeRole}`,
    `User ID: ${actorUserId}`,
    `Event: ${safeTitle}`,
    `Event ID: ${eventId}`,
    `Date: ${safeDate}`,
    type === "created" && seriesCount > 1 ? `Series events created: ${seriesCount}` : null,
    type === "edited" ? `Changed fields:\n${changedLines}` : null,
    `Public event: ${eventUrl}`,
    `Host editor: ${manageUrl}`,
    `Admin events: ${adminEventsUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text,
    templateName: "adminEventLifecycleAlert",
  });
}
