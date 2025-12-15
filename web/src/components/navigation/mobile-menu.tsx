"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  links: { href: string; label: string }[];
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

export function MobileMenu({
  open,
  onClose,
  links,
  isLoggedIn = false,
  onLogout,
}: MobileMenuProps) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close menu when the pathname changes (route navigation)
  React.useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  const portal = (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "linear-gradient(180deg, var(--color-background-light) 0%, var(--color-background) 100%)" }}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        className={cn(
          "absolute top-0 right-0 h-full w-full max-w-xs",
          "bg-[var(--color-background)] border-l border-white/5",
          "flex flex-col",
          "transform transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
          <span className="font-[var(--font-family-serif)] text-xl">
            <span className="text-[var(--color-text-accent)] italic">Denver</span>{" "}
            <span className="text-[var(--color-text-primary)]">Songwriters</span>
          </span>
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable nav content */}
        <nav className="flex-1 overflow-y-auto p-6 pt-4" role="navigation">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => onClose()}
                className="text-lg py-3 px-2 rounded-lg hover:bg-white/5 text-[var(--color-text-primary)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Fixed footer with auth buttons */}
        <div className="p-6 pt-4 border-t border-white/10">
          {isLoggedIn ? (
            <div className="flex flex-col gap-3">
              <Button variant="primary" className="w-full" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onLogout?.();
                  onClose();
                }}
              >
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button variant="primary" className="w-full" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}
