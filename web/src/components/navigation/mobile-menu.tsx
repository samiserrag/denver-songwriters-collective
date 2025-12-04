"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  links: { href: string; label: string }[];
  isLoggedIn?: boolean;
}

export function MobileMenu({
  open,
  onClose,
  links,
  isLoggedIn = false,
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
      className="fixed inset-0 z-50 bg-[#0a0f1a]/95 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        className={cn(
          "absolute top-0 right-0 h-full w-full max-w-xs",
          "bg-[#05060b] border-l border-white/10",
          "p-6",
          "transform transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <span className="font-[var(--font-family-serif)] text-xl">
            <span className="text-[var(--color-gold)] italic">OPEN MIC</span>{" "}
            <span className="text-[var(--color-warm-white)]">DROP</span>
          </span>
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-warm-gray)] hover:text-[var(--color-warm-white)]"
            aria-label="Close menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-2" role="navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => onClose()}
              className="text-lg py-3 px-2 rounded-lg hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}

          <div className="pt-6 mt-4 border-t border-white/10">
            {isLoggedIn ? (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <Button variant="primary" className="w-full">
                <Link href="/login">Log in</Link>
              </Button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}
