import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const DEFAULT_HERO_IMAGE = "/images/hero-bg.jpg";

interface HeroSectionProps {
  children: React.ReactNode;
  /** Background image path. Defaults to site hero image. Set to null for no image. */
  backgroundImage?: string | null;
  className?: string;
  showVignette?: boolean;
  showBottomFade?: boolean;
  minHeight?: "xs" | "sm" | "md" | "lg" | "xl" | "full" | "auto";
}

// Use min-h to allow content to expand on mobile where space is constrained
// Fixed heights can cause content overflow/clipping issues on small screens
const heightClasses = {
  xs: "min-h-[150px] md:min-h-[200px]",
  sm: "min-h-[200px] md:min-h-[250px]",
  md: "min-h-[250px] md:min-h-[300px]",
  lg: "min-h-[350px] md:min-h-[400px]",
  xl: "min-h-[350px] md:min-h-[400px]",
  full: "min-h-screen",
  auto: "min-h-[350px] md:min-h-[400px]", // Expands with content
};

export function HeroSection({
  children,
  backgroundImage,
  className,
  showVignette = true,
  showBottomFade = false,
  minHeight = "xs",
}: HeroSectionProps) {
  // Use default hero image unless explicitly set to null
  const imageSrc = backgroundImage === null ? null : (backgroundImage ?? DEFAULT_HERO_IMAGE);

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
      {imageSrc && (
        <Image
          src={imageSrc}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden="true"
        />
      )}

      {/* Full overlay for text readability over background image */}
      {showVignette && (
        <div
          className="absolute inset-0 bg-black/40 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Top vignette - additional dark fade for header area */}
      {showVignette && (
        <div
          className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Side vignettes (subtle) */}
      {showVignette && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/10 to-transparent pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/10 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </>
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
