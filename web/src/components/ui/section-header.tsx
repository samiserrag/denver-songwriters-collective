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
    <div className={cn("mb-8 text-center", className)}>
      <div className="flex flex-col items-center gap-2">
        <div>
          {label && (
            <p className="text-sm font-semibold tracking-widest text-[var(--color-text-accent)]/70 uppercase mb-2">
              {label}
            </p>
          )}

          <h2 className="text-2xl md:text-3xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] leading-tight tracking-tight">
            {title}
          </h2>

          {showUnderline && (
            <div className="mt-3 mx-auto h-[2px] w-16 bg-gradient-to-r from-transparent via-[var(--color-accent-primary)] to-transparent rounded-full" />
          )}

          {subtitle && (
            <p className="mt-3 text-lg md:text-xl text-[var(--color-text-secondary)] max-w-lg mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        {viewAllHref && (
          <Button asChild variant="ghost" size="sm" className="mt-2">
            <Link href={viewAllHref}>{viewAllText}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
