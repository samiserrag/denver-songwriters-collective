"use client";

import { ReactNode, useState } from "react";
import { DashboardSidebar, DashboardMobileMenuButton } from "@/components/navigation/DashboardSidebar";

interface DashboardLayoutClientProps {
  children: ReactNode;
  isAdmin: boolean;
}

export function DashboardLayoutClient({ children, isAdmin }: DashboardLayoutClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-background)]">
      <DashboardSidebar
        isAdmin={isAdmin}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content area - offset on desktop for sidebar */}
      <div className="min-w-0 lg:pl-64">
        {children}
      </div>

      {/* Mobile menu button */}
      <DashboardMobileMenuButton onClick={() => setMobileMenuOpen(true)} />
    </div>
  );
}
