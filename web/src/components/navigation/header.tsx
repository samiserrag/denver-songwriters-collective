"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";
import { MobileMenu } from "./mobile-menu";
import { useAuth } from "@/lib/auth/useAuth";

interface HeaderProps {
  className?: string;
  /**
   * Optional override for logged-in state.
   * If omitted, Header derives state from Supabase auth.
   */
  isLoggedIn?: boolean;
}

const navLinks = [
  { href: "/events", label: "Events" },
  { href: "/performers", label: "Performers" },
  { href: "/studios", label: "Studios" },
];

export function Header({ className, isLoggedIn: isLoggedInProp }: HeaderProps) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const isLoggedIn =
    typeof isLoggedInProp === "boolean" ? isLoggedInProp : !!user;

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = React.useCallback(async () => {
    await signOut();
    router.push("/");
    router.refresh();
  }, [router, signOut]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "border-b border-white/5",
        "bg-[var(--color-background)]/80 backdrop-blur-md",
        className
      )}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50 rounded"
          >
            <span className="font-[var(--font-family-serif)] text-xl">
              <span className="text-[var(--color-gold)] italic">OPEN MIC</span>{" "}
              <span className="text-[var(--color-warm-white)]">DROP</span>
            </span>
          </Link>

          <nav
            className="hidden md:flex items-center gap-8"
            role="navigation"
            aria-label="Main navigation"
          >
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {!loading && isLoggedIn && user && (
              <span className="text-xs text-[var(--color-warm-gray)]">
                Logged in as{" "}
                <span className="text-[var(--color-warm-white)]">
                  {user.email}
                </span>
              </span>
            )}

            {isLoggedIn ? (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </Button>
            ) : (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            )}
          </div>

          <button
            type="button"
            className={cn(
              "md:hidden p-2 rounded-lg",
              "text-[var(--color-warm-gray)] hover:text-[var(--color-warm-white)] hover:bg-white/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50"
            )}
            onClick={() => setMobileMenuOpen(true)}
            aria-expanded={mobileMenuOpen}
            aria-label="Open navigation menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        links={navLinks}
        isLoggedIn={isLoggedIn}
      />
    </header>
  );
}
