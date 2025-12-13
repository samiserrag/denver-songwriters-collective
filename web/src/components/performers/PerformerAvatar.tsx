import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PerformerAvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
};

const sizePixels = {
  sm: 48,
  md: 80,
  lg: 112,
};

export function PerformerAvatar({
  src,
  alt = "Performer avatar",
  size = "md",
  className,
}: PerformerAvatarProps) {
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
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[var(--color-warm-gray)] text-sm">
          No Photo
        </div>
      )}
    </div>
  );
}
