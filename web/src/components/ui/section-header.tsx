import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  label?: string;
  viewAllHref?: string;
  viewAllText?: string;
  className?: string;
  showUnderline?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  label,
  viewAllHref,
  viewAllText = "View all",
  className,
  showUnderline = true,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          {label && (
            <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-gold)]/70 uppercase mb-2">
              {label}
            </p>
          )}

          <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] leading-[var(--line-height-tight)]">
            {title}
          </h2>

          {showUnderline && (
            <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[var(--color-gold)] to-transparent rounded-full" />
          )}

          {subtitle && (
            <p className="mt-3 text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)] max-w-lg">
              {subtitle}
            </p>
          )}
        </div>

        {viewAllHref && (
          <Button asChild variant="ghost" size="sm">
            <Link href={viewAllHref}>{viewAllText}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
