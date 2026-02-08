"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Logo from "@/components/ui/Logo";
import { NavLink } from "./nav-link";
import { MobileMenu } from "./mobile-menu";
import { useAuth } from "@/lib/auth/useAuth";
import GlobalSearch from "@/components/GlobalSearch";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { INVITE_CTA_LABEL } from "@/lib/referrals";
import { SiteSocialLinks } from "./SiteSocialLinks";
import type { SiteSocialLink } from "@/lib/site-social-links";

// Primary nav links (shown in main nav bar)
// Phase 4.2: Open Mics link removed - use /happenings with type filter instead
const navLinks = [
  { href: "/happenings", label: "Happenings" },
  { href: "/members", label: "Members" },
  { href: "/venues", label: "Venues" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/tip-jar", label: "Tip Jar" },
];

// Secondary links removed - currently not used in header
// const secondaryLinks = [{ href: "/privacy", label: "Privacy" }];

interface HeaderProps {
  className?: string;
  socialLinks?: SiteSocialLink[];
}

export function Header({ className, socialLinks = [] }: HeaderProps) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = React.useCallback(async () => {
    await signOut();
    router.push("/");
    router.refresh();
  }, [router, signOut]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "border-b border-[var(--color-border-subtle)]",
        "bg-[var(--color-bg-primary)]/80 backdrop-blur-md",
        className,
      )}
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo variant="full" className="hover:opacity-90 transition-opacity" />

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {/* Global Search */}
          <GlobalSearch />

          {/* Theme Picker */}
          <ThemePicker compact />

          {/* Social Links */}
          <SiteSocialLinks
            socialLinks={socialLinks}
            className="flex items-center gap-2"
            linkClassName="text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] transition-colors p-1"
            iconClassName="w-4 h-4"
          />
          {!mounted || loading ? (
            <div className="w-20 h-9" />
          ) : user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/invite">{INVITE_CTA_LABEL}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>

        <button
          ref={menuTriggerRef}
          className="lg:hidden p-2 text-[var(--color-text-primary)]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        links={navLinks}
        isLoggedIn={!!user}
        onLogout={handleLogout}
        triggerRef={menuTriggerRef}
      />
    </header>
  );
}
