import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  children: React.ReactNode;
  backgroundImage?: string;
  className?: string;
  showSpotlight?: boolean;
  showVignette?: boolean;
  showBottomFade?: boolean;
  minHeight?: "sm" | "md" | "lg" | "xl" | "full";
}

// Use fixed heights instead of min-h to prevent CLS (Cumulative Layout Shift)
const heightClasses = {
  sm: "h-[300px] md:h-[350px]",
  md: "h-[400px] md:h-[500px]",
  lg: "h-[500px] md:h-[600px]",
  xl: "h-[600px] md:h-[750px]",
  full: "h-screen",
};

export function HeroSection({
  children,
  backgroundImage,
  className,
  showSpotlight = true,
  showVignette = true,
  showBottomFade = false,
  minHeight = "md",
}: HeroSectionProps) {
  return (
    <section
      className={cn(
        "relative w-full",
        heightClasses[minHeight],
        "flex items-center justify-center",
        "overflow-hidden",
        className
      )}
    >
      {/* Background Image - Optimized with Next.js Image for LCP */}
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-bottom md:object-center"
          aria-hidden="true"
        />
      )}

      {/* Bottom blend overlay - blends hero image into page content */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-bg-primary)]"
        aria-hidden="true"
      />

      {/* Top vignette (stage curtain effect) - lightened */}
      {showVignette && (
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/25 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Side vignettes (subtle) - lightened */}
      {showVignette && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/15 to-transparent pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/15 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}

      {/* Gold spotlight glow */}
      {showSpotlight && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none opacity-80"
          style={{
            background: "radial-gradient(ellipse at center top, rgba(255, 216, 106, 0.18) 0%, rgba(255, 216, 106, 0.05) 40%, transparent 70%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Bottom fade for smooth transition to content */}
      {showBottomFade && (
        <div
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--color-bg-primary)] to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </section>
  );
}
