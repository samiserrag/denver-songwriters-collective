import * as React from "react";
import { cn } from "@/lib/utils";

interface ContentTypographyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Typography wrapper for public page content.
 * Provides larger, more readable text with relaxed line-height.
 * NOT for nav, admin, or dashboard areas.
 */
export function ContentTypography({ children, className }: ContentTypographyProps) {
  return (
    <div
      className={cn(
        "text-lg md:text-xl lg:text-2xl leading-relaxed",
        className
      )}
    >
      {children}
    </div>
  );
}
