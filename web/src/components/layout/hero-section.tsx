import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  children: React.ReactNode;
  backgroundImage?: string;
  className?: string;
  showVignette?: boolean;
  showBottomFade?: boolean;
  minHeight?: "xs" | "sm" | "md" | "lg" | "xl" | "full" | "auto";
}

// Use fixed heights instead of min-h to prevent CLS (Cumulative Layout Shift)
// Use "auto" for content that needs to expand (like profile pages with dynamic content)
const heightClasses = {
  xs: "h-[150px] md:h-[200px]",
  sm: "h-[200px] md:h-[250px]",
  md: "h-[250px] md:h-[300px]",
  lg: "h-[350px] md:h-[400px]",
  xl: "h-[350px] md:h-[400px]",
  full: "h-screen",
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
          className="object-cover object-center"
          aria-hidden="true"
        />
      )}

      {/* Top vignette - subtle dark fade for text readability */}
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
