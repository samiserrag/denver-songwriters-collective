import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

const footerLinks = [
  { href: "/events", label: "Events" },
  { href: "/performers", label: "Performers" },
  { href: "/studios", label: "Studios" },
];

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-white/5",
        "py-10 md:py-12",
        "bg-[var(--color-background)]",
        className
      )}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link
            href="/"
            className="font-[var(--font-family-serif)] text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50 rounded"
          >
            <span className="text-[var(--color-gold)] italic">OPEN MIC</span>{" "}
            <span className="text-[var(--color-warm-white)]">DROP</span>
          </Link>

          <nav
            className="flex items-center gap-8"
            role="navigation"
            aria-label="Footer navigation"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm text-[var(--color-warm-gray)]",
                  "hover:text-[var(--color-warm-white)]",
                  "transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50 rounded"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-[var(--color-warm-gray)]/60">
            © {currentYear} Open Mic Drop
          </p>
        </div>
      </div>
    </footer>
  );
}
