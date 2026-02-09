import React from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningCard } from "@/components/happenings/HappeningCard";
import type { HappeningEvent } from "@/components/happenings/HappeningCard";
import Link from "next/link";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();

  // Ensure user is authenticated (server) and redirect if not
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;
  if (!user) {
    redirect("/login");
  }

  // Fetch favorites for the user, including joined event and venue
  const { data: favorites, error } = await supabase
    .from("favorites")
    .select(
      "event_id, events(id, slug, title, description, event_date, start_time, venue_id, venue_name, venue_address, venues(name,address,city,state,website,phone))"
    )
    .eq("user_id", user.id);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">My Favorites</h1>
        <p className="text-[var(--color-text-secondary)]">Unable to load favorites.</p>
      </div>
    );
  }

  const events = (favorites ?? [])
    .map((f: any) => {
      const ev = f.events ?? null;
      if (!ev) return null;
      return {
        id: ev.id,
        title: ev.title,
        slug: ev.slug ?? null,
        description: ev.description ?? null,
        host_id: ev.host_id ?? null,
        venue_id: ev.venue_id ?? null,
        venue_name: ev.venue_name ?? null,
        venue_address: ev.venue_address ?? null,
        event_date: ev.event_date ?? null,
        day_of_week: ev.day_of_week ?? null,
        start_time: ev.start_time ?? null,
        end_time: ev.end_time ?? null,
        event_type: (ev.event_type as any) ?? "open_mic",
        recurrence_rule: ev.recurrence_rule ?? null,
        status: ev.status ?? null,
        notes: ev.notes ?? null,
        region_id: ev.region_id ?? null,
        is_showcase: ev.is_showcase ?? null,
        created_at: ev.created_at ?? null,
        updated_at: ev.updated_at ?? null,
        venue: ev.venue ?? undefined,
      };
    })
    .filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">My Favorites</h1>
        <Link href="/happenings?type=open_mic" className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline">
          Back to Directory
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-accent-muted)] p-6 text-center">
          <p className="text-[var(--color-text-secondary)]">You have no favorites yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((ev: any) => (
            <HappeningCard key={ev.id} event={ev as HappeningEvent} variant="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
