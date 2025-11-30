import * as React from "react";
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
        <img
          src={src}
          alt={alt}
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
