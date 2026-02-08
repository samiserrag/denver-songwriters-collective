import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";
import { NewsletterSignup } from "./newsletter-signup";
import { SiteSocialLinks } from "./SiteSocialLinks";
import type { SiteSocialLink } from "@/lib/site-social-links";

interface FooterProps {
  className?: string;
  socialLinks?: SiteSocialLink[];
}

export function Footer({ className, socialLinks = [] }: FooterProps) {
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
            <SiteSocialLinks
              socialLinks={socialLinks}
              className="flex gap-4 mt-6"
              linkClassName="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
              iconClassName="w-5 h-5"
            />
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
              <li><Link href="/invite" className="text-[var(--color-text-on-inverse-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">Invite a Friend</Link></li>
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
            © {currentYear} The Colorado Songwriters Collective. Made with 🎵 in Denver.
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
