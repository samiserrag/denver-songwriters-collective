import { ADMIN_EMAIL, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/email/render";
import type { GeocodingStatus } from "@/lib/venue/geocoding";

interface SendAdminVenueGeocodingAlertParams {
  venueId?: string | null;
  venueName?: string | null;
  actorId: string;
  actorEmail?: string | null;
  route: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  googleMapsUrl?: string | null;
  geocodingStatus: GeocodingStatus;
}

function getReasonLabel(status: GeocodingStatus): string {
  switch (status.reason) {
    case "missing_api_key":
      return "Missing Google API key";
    case "insufficient_address":
      return "Insufficient address fields";
    case "no_results":
      return "No geocoding results";
    case "api_error":
      return "Google API/network error";
    case "manual_override":
      return "Manual coordinates override";
    case "google_maps_url_success":
      return "Recovered from Google Maps URL fallback";
    case "google_api_success":
      return "Google API success";
    default:
      return status.reason;
  }
}

export async function sendAdminVenueGeocodingFailureAlert(
  params: SendAdminVenueGeocodingAlertParams
): Promise<void> {
  const {
    venueId = null,
    venueName = null,
    actorId,
    actorEmail = null,
    route,
    address = null,
    city = null,
    state = null,
    zip = null,
    googleMapsUrl = null,
    geocodingStatus,
  } = params;

  const safeVenueName = venueName?.trim() || "Unknown venue";
  const safeActorEmail = actorEmail?.trim() || "Unknown";
  const addressLine = [address, city, state, zip].filter(Boolean).join(", ") || "(missing)";
  const venueUrl = venueId ? `${SITE_URL}/dashboard/admin/venues/${venueId}` : null;
  const reason = getReasonLabel(geocodingStatus);
  const details = geocodingStatus.details || "No additional details";

  const subject = `[CSC Ops] Venue geocoding failed: ${safeVenueName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Venue Geocoding Failure</h2>
      <p style="margin: 0 0 8px 0;"><strong>Venue:</strong> ${safeVenueName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Route:</strong> ${route}</p>
      <p style="margin: 0 0 8px 0;"><strong>Reason:</strong> ${reason}</p>
      <p style="margin: 0 0 8px 0;"><strong>Details:</strong> ${details}</p>
      <p style="margin: 0 0 8px 0;"><strong>Address:</strong> ${addressLine}</p>
      <p style="margin: 0 0 8px 0;"><strong>Google Maps URL:</strong> ${googleMapsUrl || "(none)"}</p>
      <p style="margin: 0 0 8px 0;"><strong>Actor:</strong> ${actorId} (${safeActorEmail})</p>
      ${
        venueUrl
          ? `<p style="margin: 0;"><a href="${venueUrl}" style="color: #2563eb; text-decoration: none;">Open venue in admin</a></p>`
          : ""
      }
    </div>
  `;

  const text = [
    "Venue Geocoding Failure",
    `Venue: ${safeVenueName}`,
    `Route: ${route}`,
    `Reason: ${reason}`,
    `Details: ${details}`,
    `Address: ${addressLine}`,
    `Google Maps URL: ${googleMapsUrl || "(none)"}`,
    `Actor: ${actorId} (${safeActorEmail})`,
    venueUrl ? `Admin venue URL: ${venueUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  await sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text,
    templateName: "admin_venue_geocoding_failure",
  });
}

