"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  exact?: boolean;
}

export function NavLink({
  href,
  children,
  className,
  exact = false,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "text-[13px] font-medium whitespace-nowrap font-[inherit]",
        "px-2.5 py-1.5 rounded-md text-center",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-accent)]/50",
        isActive
          ? "text-[var(--color-text-accent)] bg-[var(--color-accent-primary)]/10"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5",
        className
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
