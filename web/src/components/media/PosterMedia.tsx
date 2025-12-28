"use client";

/**
 * PosterMedia - Unified poster/image component implementing Phase 3.1 display spec
 *
 * Rules from Phase 3.1 spec Section 6:
 * - Cards: bounded container, object-fit: contain, letterbox OK, art is secondary
 * - Detail: full width, natural height, object-fit: contain, no overlays, art is primary
 *
 * This component ensures consistent image rendering across all event displays.
 */

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

// CSS variable for card poster max height - tunable without refactors
const POSTER_CARD_MAX_HEIGHT = "200px";

export interface PosterMediaProps {
  /** Image source URL. If null/undefined, component renders nothing. */
  src: string | null | undefined;
  /** Alt text for accessibility */
  alt: string;
  /** Display variant: 'card' for list/grid cards, 'detail' for full detail pages */
  variant: "card" | "detail";
  /** Additional CSS classes */
  className?: string;
  /** Priority loading for LCP optimization (detail pages should use true) */
  priority?: boolean;
}

/**
 * Check if URL is from a configured remote domain (Supabase storage)
 */
function isConfiguredRemoteDomain(src: string): boolean {
  try {
    const url = new URL(src);
    return (
      url.hostname.endsWith(".supabase.co") ||
      url.hostname.endsWith(".supabase.in")
    );
  } catch {
    return false;
  }
}

export function PosterMedia({
  src,
  alt,
  variant,
  className,
  priority = false,
}: PosterMediaProps) {
  const [useNativeImg, setUseNativeImg] = useState(false);

  // Rule: If src is null/undefined, render nothing
  if (!src) {
    return null;
  }

  // Determine if we can use Next/Image optimization
  const canUseNextImage = isConfiguredRemoteDomain(src) && !useNativeImg;

  // Card variant: bounded container, contain, letterbox background
  if (variant === "card") {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-[var(--color-bg-tertiary)]",
          className
        )}
        style={{ maxHeight: POSTER_CARD_MAX_HEIGHT }}
      >
        {canUseNextImage ? (
          <Image
            src={src}
            alt={alt}
            width={400}
            height={300}
            className="w-full h-auto object-contain"
            style={{ maxHeight: POSTER_CARD_MAX_HEIGHT }}
            onError={() => setUseNativeImg(true)}
            priority={priority}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            className="w-full h-auto object-contain"
            style={{ maxHeight: POSTER_CARD_MAX_HEIGHT }}
          />
        )}
      </div>
    );
  }

  // Detail variant: full width, natural height, no overlays
  return (
    <div className={cn("w-full", className)}>
      {canUseNextImage ? (
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          className="w-full h-auto object-contain"
          sizes="100vw"
          onError={() => setUseNativeImg(true)}
          priority={priority}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-auto object-contain"
        />
      )}
    </div>
  );
}

export default PosterMedia;
