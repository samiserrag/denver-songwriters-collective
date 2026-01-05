import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SongwriterAvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
  xl: "h-48 w-48",
  "2xl": "h-64 w-64",
};

const sizePixels = {
  sm: 48,
  md: 80,
  lg: 112,
  xl: 192,
  "2xl": 256,
};

export function SongwriterAvatar({
  src,
  alt = "Songwriter avatar",
  size = "md",
  className,
}: SongwriterAvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden bg-[var(--color-indigo-900)] border border-white/10",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={sizePixels[size]}
          height={sizePixels[size]}
          // Phase 4.38: Use object-top to prioritize showing head/face, preventing top crop
          className="h-full w-full object-cover object-top"
          draggable={false}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
          No Photo
        </div>
      )}
    </div>
  );
}
