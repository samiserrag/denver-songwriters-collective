import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";
import { NewsletterSignup } from "./newsletter-signup";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-[var(--color-border-subtle)]",
        "bg-[var(--color-background-dark)]",
        // NOTE: min-height is set via critical inline CSS in layout.tsx to prevent CLS
        // Do NOT add min-h classes here - they conflict with the inline styles
        className
      )}
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Logo variant="full" inverse />
            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              <a href="https://www.instagram.com/denver_songwriters_collective" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://www.facebook.com/groups/denversongwriterscollective" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://www.youtube.com/@DenverSongwritersCollective" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors" aria-label="YouTube">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[var(--color-text-on-inverse-primary)] font-semibold mb-4">Discover</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/happenings?type=open_mic" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Open Mics</Link></li>
              <li><Link href="/happenings" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Happenings</Link></li>
              <li><Link href="/performers" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Artists</Link></li>
              <li><Link href="/studios" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Studios</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-[var(--color-text-on-inverse-primary)] font-semibold mb-4">Community</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">About Us</Link></li>
              <li><Link href="/submit-open-mic" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Submit Open Mic</Link></li>
              <li><Link href="/get-involved" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Get Involved</Link></li>
              <li><Link href="/partners" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Partners</Link></li>
              <li><Link href="/dashboard/invite" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Invite a Friend</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-[var(--color-text-on-inverse-primary)] font-semibold mb-4">Stay Connected</h4>
            <p className="text-[var(--color-text-on-inverse-secondary)] text-sm mb-4">
              Occasional updates on Denver&apos;s songwriter scene.
            </p>
            <NewsletterSignup />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[var(--color-border-subtle)] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[var(--color-text-on-inverse-tertiary)] text-sm">
            © {currentYear} The Denver Songwriters Collective. Made with 🎵 in Denver.
          </p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-[var(--color-text-on-inverse-tertiary)] hover:text-[var(--color-text-on-inverse-secondary)] transition-colors">Privacy</Link>
            <Link href="/feedback" className="text-[var(--color-text-on-inverse-tertiary)] hover:text-[var(--color-text-on-inverse-secondary)] transition-colors">Feedback</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
