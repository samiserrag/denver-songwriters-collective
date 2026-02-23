import { appLogger } from "@/lib/appLogger";
import { sendAdminVenueGeocodingFailureAlert } from "@/lib/email/adminVenueGeocodingAlerts";
import type { GeocodingStatus } from "@/lib/venue/geocoding";

interface NotifyVenueGeocodingFailureParams {
  route: string;
  actorId: string;
  actorEmail?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  googleMapsUrl?: string | null;
  geocodingStatus: GeocodingStatus;
}

function warningMessageForStatus(status: GeocodingStatus): string {
  switch (status.reason) {
    case "missing_api_key":
      return "Geocoding skipped because Google API key is not configured.";
    case "insufficient_address":
      return "Geocoding could not run because required address fields are missing.";
    case "no_results":
      return "Geocoding could not find a match for this venue address.";
    case "api_error":
      return "Geocoding request failed due to a Google API/network error.";
    default:
      return "Geocoding did not complete for this venue update.";
  }
}

export function buildGeocodingWarning(status: GeocodingStatus): {
  code: "geocoding_failed";
  message: string;
  reason: GeocodingStatus["reason"];
  details?: string;
} {
  return {
    code: "geocoding_failed",
    message: warningMessageForStatus(status),
    reason: status.reason,
    details: status.details,
  };
}

export async function notifyVenueGeocodingFailure(
  params: NotifyVenueGeocodingFailureParams
): Promise<void> {
  const {
    route,
    actorId,
    actorEmail = null,
    venueId = null,
    venueName = null,
    address = null,
    city = null,
    state = null,
    zip = null,
    googleMapsUrl = null,
    geocodingStatus,
  } = params;

  await appLogger.error(
    "venue_geocoding_failed",
    {
      route,
      venueId,
      venueName,
      address,
      city,
      state,
      zip,
      googleMapsUrl,
      geocodingReason: geocodingStatus.reason,
      geocodingDetails: geocodingStatus.details,
    },
    {
      source: "venue_geocoding",
      userId: actorId,
      userEmail: actorEmail || undefined,
    }
  );

  try {
    await sendAdminVenueGeocodingFailureAlert({
      venueId,
      venueName,
      actorId,
      actorEmail,
      route,
      address,
      city,
      state,
      zip,
      googleMapsUrl,
      geocodingStatus,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown alert error";
    await appLogger.error(
      "venue_geocoding_alert_email_failed",
      {
        route,
        venueId,
        venueName,
        geocodingReason: geocodingStatus.reason,
        geocodingDetails: geocodingStatus.details,
        alertError: errorMessage,
      },
      {
        source: "venue_geocoding",
        userId: actorId,
        userEmail: actorEmail || undefined,
      }
    );
  }
}

