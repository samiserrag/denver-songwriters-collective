"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org";

interface TvQrStripProps {
  /** Event slug or ID for QR code URL */
  eventSlugOrId: string;
  /** Venue slug or ID (optional) */
  venueSlugOrId?: string | null;
  /** Venue name for label */
  venueName?: string | null;
  /** Host slug or ID (optional) */
  hostSlugOrId?: string | null;
  /** Host name for label */
  hostName?: string | null;
}

/**
 * Phase 4.102: TV Display QR Strip
 *
 * Displays scannable QR codes optimized for TV/projector viewing.
 * - Event QR: 240px (primary, most important)
 * - Venue QR: 200px (secondary)
 * - Host QR: 200px (secondary)
 *
 * QR codes use gold accent color (#d4a853) with transparent background
 * for optimal visibility on dark TV display background.
 *
 * DSC UX Principles: §2 (Visibility)
 */
export function TvQrStrip({
  eventSlugOrId,
  venueSlugOrId,
  venueName,
  hostSlugOrId,
  hostName,
}: TvQrStripProps) {
  const eventUrl = `${SITE_URL}/events/${eventSlugOrId}`;
  const venueUrl = venueSlugOrId ? `${SITE_URL}/venues/${venueSlugOrId}` : null;
  const hostUrl = hostSlugOrId ? `${SITE_URL}/songwriters/${hostSlugOrId}` : null;

  return (
    <div className="flex items-end justify-center gap-12 py-6">
      {/* Event QR (Primary - largest) */}
      <div className="flex flex-col items-center">
        <div
          className="p-3 bg-white/10 rounded-xl backdrop-blur-sm"
          role="img"
          aria-label={`QR code linking to event page: ${eventUrl}`}
        >
          <QRCodeSVG
            value={eventUrl}
            size={240}
            level="M"
            includeMargin={false}
            bgColor="transparent"
            fgColor="#d4a853"
          />
        </div>
        <p className="text-lg font-semibold text-[var(--color-text-accent)] mt-3 uppercase tracking-wider">
          EVENT
        </p>
      </div>

      {/* Venue QR (Secondary) */}
      {venueUrl && (
        <div className="flex flex-col items-center">
          <div
            className="p-3 bg-white/10 rounded-xl backdrop-blur-sm"
            role="img"
            aria-label={`QR code linking to venue page: ${venueUrl}`}
          >
            <QRCodeSVG
              value={venueUrl}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="transparent"
              fgColor="#d4a853"
            />
          </div>
          <p className="text-base font-semibold text-gray-400 mt-3 uppercase tracking-wider">
            VENUE
          </p>
          {venueName && (
            <p className="text-sm text-gray-500 mt-1 max-w-[200px] text-center truncate">
              {venueName}
            </p>
          )}
        </div>
      )}

      {/* Host QR (Secondary) */}
      {hostUrl && (
        <div className="flex flex-col items-center">
          <div
            className="p-3 bg-white/10 rounded-xl backdrop-blur-sm"
            role="img"
            aria-label={`QR code linking to host profile: ${hostUrl}`}
          >
            <QRCodeSVG
              value={hostUrl}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="transparent"
              fgColor="#d4a853"
            />
          </div>
          <p className="text-base font-semibold text-gray-400 mt-3 uppercase tracking-wider">
            HOST
          </p>
          {hostName && (
            <p className="text-sm text-gray-500 mt-1 max-w-[200px] text-center truncate">
              {hostName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
