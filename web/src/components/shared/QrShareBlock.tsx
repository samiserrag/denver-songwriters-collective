"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";

interface QrShareBlockProps {
  /** Title to display above the block */
  title: string;
  /** Absolute URL for the QR code */
  url: string;
  /** Optional label below the QR code */
  label?: string;
  /** Size of QR code in pixels (default 160) */
  qrSize?: number;
}

/**
 * Phase 4.101: QR Share Block
 *
 * Displays a scannable QR code for easy sharing.
 * Used on event, venue, and profile pages.
 *
 * DSC UX Principles: §2 (Visibility)
 */
export function QrShareBlock({
  title,
  url,
  label,
  qrSize = 160,
}: QrShareBlockProps) {
  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
        {title}
      </h3>

      <div className="flex flex-col items-center gap-2">
        {/* QR code with accessibility label */}
        <div
          className="p-3 bg-white rounded-xl"
          role="img"
          aria-label={`QR code linking to ${url}`}
        >
          <QRCodeSVG
            value={url}
            size={qrSize}
            level="M"
            includeMargin={false}
          />
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] text-center max-w-[200px] break-all">
          {url}
        </p>
        {label && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
