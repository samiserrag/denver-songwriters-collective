/**
 * Ops Console Landing Page
 *
 * Admin-only dashboard for bulk data operations.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OpsConsolePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-2">
        Ops Console
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Bulk data operations for administrators.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Venue Bulk Management */}
        <Link
          href="/dashboard/admin/ops/venues"
          className="block p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-accent-primary)] transition-colors"
        >
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Venue Bulk Management
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Export venues to CSV, update data offline, import changes back.
            Includes Google Maps URL helper.
          </p>
          <span className="inline-block mt-4 text-[var(--color-accent-primary)] text-sm font-medium">
            Open →
          </span>
        </Link>

        {/* Events Bulk Management - Coming Soon */}
        <div className="p-6 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] rounded-lg opacity-60 cursor-not-allowed">
          <h2 className="text-xl font-semibold text-[var(--color-text-tertiary)] mb-2">
            Event Bulk Management
          </h2>
          <p className="text-[var(--color-text-tertiary)] text-sm">
            Bulk verification, cancellation, and schedule updates for events.
          </p>
          <span className="inline-block mt-4 text-[var(--color-text-tertiary)] text-sm">
            Coming Soon
          </span>
        </div>

        {/* Members Bulk Management - Coming Soon */}
        <div className="p-6 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] rounded-lg opacity-60 cursor-not-allowed">
          <h2 className="text-xl font-semibold text-[var(--color-text-tertiary)] mb-2">
            Member Bulk Management
          </h2>
          <p className="text-[var(--color-text-tertiary)] text-sm">
            Bulk member role updates and profile management.
          </p>
          <span className="inline-block mt-4 text-[var(--color-text-tertiary)] text-sm">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/dashboard/admin"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm"
        >
          ← Back to Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
