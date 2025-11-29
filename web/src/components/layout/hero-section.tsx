import * as React from "react";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  children: React.ReactNode;
  backgroundImage?: string;
  className?: string;
  showSpotlight?: boolean;
  showVignette?: boolean;
  minHeight?: "sm" | "md" | "lg" | "full";
}

const heightClasses = {
  sm: "min-h-[300px] md:min-h-[350px]",
  md: "min-h-[400px] md:min-h-[500px]",
  lg: "min-h-[500px] md:min-h-[600px]",
  full: "min-h-screen",
};

export function HeroSection({
  children,
  backgroundImage,
  className,
  showSpotlight = true,
  showVignette = true,
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
      {/* Background Image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          aria-hidden="true"
        />
      )}

      {/* Main gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[var(--color-background)]/40 via-[var(--color-background)]/70 to-[var(--color-background)]"
        aria-hidden="true"
      />

      {/* Top vignette (stage curtain effect) */}
      {showVignette && (
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Side vignettes (subtle) */}
      {showVignette && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/30 to-transparent pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/30 to-transparent pointer-events-none"
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

      {/* Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </section>
  );
}
