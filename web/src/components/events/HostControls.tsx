"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getEventDisplayUrl, getEventLineupUrl } from "@/lib/events/urls";

interface HostControlsProps {
  eventId: string;
  eventSlug?: string | null;
  dateKey?: string | null;
  hasTimeslots: boolean;
}

export function HostControls({ eventId, eventSlug, dateKey, hasTimeslots }: HostControlsProps) {
  // Phase 4.105: Use centralized URL helpers with tv=1 and date
  const eventIdentifier = eventSlug || eventId;
  const lineupUrl = getEventLineupUrl({ eventIdentifier, dateKey });
  const displayUrl = getEventDisplayUrl({ eventIdentifier, dateKey, tv: true });
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    async function checkAuth() {
      if (!user) {
        setChecking(false);
        return;
      }

      // Check if admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") {
        setIsAuthorized(true);
        setChecking(false);
        return;
      }

      // Check if event host via host_id on event
      const { data: eventData } = await supabase
        .from("events")
        .select("host_id")
        .eq("id", eventId)
        .single();

      if (eventData?.host_id === user.id) {
        setIsAuthorized(true);
        setChecking(false);
        return;
      }

      // Also check event_hosts table for co-hosts
      const { data: hostEntry } = await supabase
        .from("event_hosts")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (hostEntry) {
        setIsAuthorized(true);
      }

      setChecking(false);
    }

    if (user) {
      checkAuth();
    } else if (!authLoading) {
      setChecking(false);
    }
  }, [user, authLoading, eventId, supabase]);

  // Don't show anything if not authorized
  if (authLoading || checking || !isAuthorized) {
    return null;
  }

  return (
    <div className="mb-8 p-5 rounded-xl bg-gradient-to-r from-purple-900/30 to-purple-900/10 border border-purple-500/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎛️</span>
        <h3 className="font-semibold text-[var(--color-text-primary)]">Host Controls</h3>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        You&apos;re a host for this happening. Use these tools to manage the lineup.
      </p>
      <div className="flex flex-wrap gap-3">
        {hasTimeslots && (
          <Link
            href={lineupUrl}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Control Lineup
          </Link>
        )}
        <Link
          href={displayUrl}
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Open TV Display
        </Link>
      </div>
    </div>
  );
}
