"use client";

import * as React from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

interface QrShareBlockProps {
  /** Title to display above the block */
  title: string;
  /** Absolute URL for the QR code */
  url: string;
  /** Optional cover image URL */
  imageSrc?: string | null;
  /** Alt text for cover image */
  imageAlt?: string;
  /** Optional label below the QR code */
  label?: string;
  /** Size of QR code in pixels (default 160) */
  qrSize?: number;
}

/**
 * Phase 4.101: QR Cover Block
 *
 * Displays a cover image (optional) alongside a scannable QR code.
 * Used on event, venue, and profile pages for easy sharing.
 *
 * Layout:
 * - Mobile: Stacked vertically (image on top, QR below)
 * - Desktop: Side-by-side (image left, QR right)
 *
 * DSC UX Principles: §2 (Visibility)
 */
export function QrShareBlock({
  title,
  url,
  imageSrc,
  imageAlt = "Cover image",
  label,
  qrSize = 160,
}: QrShareBlockProps) {
  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
        {title}
      </h3>

      <div className="flex flex-col md:flex-row gap-4 items-center md:items-start">
        {/* Cover image (optional) */}
        {imageSrc && (
          <div className="flex-shrink-0 w-full md:w-48 h-32 md:h-32 relative overflow-hidden rounded-lg bg-[var(--color-bg-tertiary)]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 768px) 100vw, 192px"
              className="object-cover"
            />
          </div>
        )}

        {/* QR code */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-white rounded-xl">
            <QRCodeSVG
              value={url}
              size={qrSize}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] text-center max-w-[180px] break-all">
            {url}
          </p>
          {label && (
            <p className="text-sm text-[var(--color-text-secondary)] text-center">
              {label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
