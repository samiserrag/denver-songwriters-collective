"use client";

import { QRCodeSVG } from "qrcode.react";

type ProfileQRCodeProps = {
  profileUrl: string;
  displayName?: string | null;
  size?: number;
  className?: string;
};

export default function ProfileQRCode({
  profileUrl,
  displayName,
  size = 128,
  className = "",
}: ProfileQRCodeProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG
          value={profileUrl}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      {displayName && (
        <p className="text-sm text-[var(--color-warm-gray-light)] text-center">
          {displayName}
        </p>
      )}
      <p className="text-xs text-[var(--color-warm-gray)] text-center">
        Scan to view profile
      </p>
    </div>
  );
}

type TipQRCodeProps = {
  venmoHandle?: string | null;
  cashappHandle?: string | null;
  paypalUrl?: string | null;
  displayName?: string | null;
  size?: number;
  className?: string;
};

export function TipQRCode({
  venmoHandle,
  cashappHandle,
  paypalUrl,
  displayName,
  size = 128,
  className = "",
}: TipQRCodeProps) {
  // Prioritize: Venmo > Cash App > PayPal
  let tipUrl: string | null = null;
  let tipLabel: string | null = null;

  if (venmoHandle) {
    // Clean up handle (remove @ if present)
    const handle = venmoHandle.replace(/^@/, "");
    tipUrl = `https://venmo.com/${handle}`;
    tipLabel = "Venmo";
  } else if (cashappHandle) {
    // Clean up handle (remove $ if present)
    const handle = cashappHandle.replace(/^\$/, "");
    tipUrl = `https://cash.app/$${handle}`;
    tipLabel = "Cash App";
  } else if (paypalUrl) {
    tipUrl = paypalUrl;
    tipLabel = "PayPal";
  }

  if (!tipUrl) {
    return null;
  }

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG
          value={tipUrl}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      {displayName && (
        <p className="text-sm text-[var(--color-warm-white)] font-medium text-center">
          Tip {displayName}
        </p>
      )}
      <p className="text-xs text-[var(--color-gold)] text-center">
        Scan to tip via {tipLabel}
      </p>
    </div>
  );
}

type OrganizationQRCodeProps = {
  url: string;
  label?: string;
  size?: number;
  className?: string;
};

export function OrganizationQRCode({
  url,
  label = "Denver Songwriters Collective",
  size = 128,
  className = "",
}: OrganizationQRCodeProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      <p className="text-sm text-[var(--color-warm-white)] font-medium text-center">
        {label}
      </p>
      <p className="text-xs text-[var(--color-warm-gray)] text-center">
        Scan to visit
      </p>
    </div>
  );
}
