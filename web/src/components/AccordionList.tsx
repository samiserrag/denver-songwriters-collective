"use client";

import { useState, useEffect, useMemo } from "react";
import CompactListItem from "./CompactListItem";
import type { EventWithVenue } from "@/types/db";

const daysOrdered = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function parseTimeToMinutes(t?: string | null) {
  if (!t) return 24 * 60;
  try {
    const timeOnly = t.includes("T") ? t.split("T")[1] : t;
    const [hhStr, mmStr] = timeOnly.split(":");
    const hh = parseInt(hhStr ?? "24", 10);
    const mm = parseInt(mmStr ?? "0", 10);
    if (Number.isNaN(hh)) return 24 * 60;
    return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
  } catch {
    return 24 * 60;
  }
}

export default function AccordionList({
  events,
  searchQuery,
}: {
  events: EventWithVenue[];
  searchQuery?: string;
}) {
  const hasSearch = !!(searchQuery && searchQuery.trim());

  // Initialize groups
  const groupedByDay: Record<string, EventWithVenue[]> = {};
  for (const day of daysOrdered) groupedByDay[day] = [];

  for (const ev of events ?? []) {
    const day = ev.day_of_week ?? "UNKNOWN";
    if (!groupedByDay[day]) groupedByDay[day] = [];
    groupedByDay[day].push(ev);
  }

  // Sort each day's list by start_time then title
  for (const day of Object.keys(groupedByDay)) {
    groupedByDay[day].sort((a, b) => {
      const tA = parseTimeToMinutes(a.start_time ?? null);
      const tB = parseTimeToMinutes(b.start_time ?? null);
      if (tA !== tB) return tA - tB;
      const aTitle = (a.title ?? "").toLowerCase();
      const bTitle = (b.title ?? "").toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
  }

  // Find which days have events (for auto-expand on search)
  const daysWithEvents = useMemo(() => {
    const days = new Set<string>();
    for (const ev of events ?? []) {
      const day = ev.day_of_week ?? "UNKNOWN";
      if (daysOrdered.includes(day)) {
        days.add(day);
      }
    }
    return days;
  }, [events]);

  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  // Auto-expand matching days when search is active
  useEffect(() => {
    if (hasSearch && daysWithEvents.size > 0) {
      setOpenDays(new Set(daysWithEvents));
    } else if (!hasSearch) {
      setOpenDays(new Set());
    }
  }, [hasSearch, daysWithEvents]);

  const toggleDay = (day: string) => {
    setOpenDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Search results summary */}
      {hasSearch && (
        <div className="text-sm text-[var(--color-text-accent)] mb-2">
          Found {events.length} result{events.length !== 1 ? "s" : ""} for "{searchQuery}"
        </div>
      )}

      {daysOrdered.map((day) => {
        const list = groupedByDay[day] || [];
        const isOpen = openDays.has(day);
        const hasEvents = list.length > 0;

        // When searching, hide days with no results
        if (hasSearch && !hasEvents) {
          return null;
        }

        return (
          <div key={day} className="border border-white/10 rounded-xl bg-white/3 overflow-hidden">
            <button
              onClick={() => toggleDay(day)}
              className="w-full flex justify-between items-center px-4 py-3 text-left text-lg font-semibold text-[var(--color-text-accent)] hover:bg-white/5"
            >
              <span>
                {day}
                {hasEvents && <span className="ml-2 text-sm text-gray-400">({list.length})</span>}
              </span>
              <span className="text-gray-400">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {list.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-secondary)] py-2">
                    No open mics listed for this day.
                  </div>
                ) : (
                  list.map((ev) => (
                    <CompactListItem
                      key={ev.id}
                      id={ev.id}
                      title={ev.title}
                      slug={ev.slug ?? undefined}
                      day_of_week={ev.day_of_week ?? undefined}
                      recurrence_rule={ev.recurrence_rule ?? undefined}
                      venue_name={ev.venue?.name ?? ev.venue_name ?? undefined}
                      venue_address={ev.venue?.address ?? ev.venue_address ?? undefined}
                      venue_city={ev.venue?.city ?? (ev as any).venue_city ?? undefined}
                      venue_state={ev.venue?.state ?? (ev as any).venue_state ?? undefined}
                      start_time={ev.start_time ?? undefined}
                      end_time={ev.end_time ?? undefined}
                      signup_time={ev.signup_time ?? undefined}
                      category={(ev as any).category ?? undefined}
                      map_url={(ev as any).mapUrl ?? undefined}
                      searchQuery={searchQuery ?? undefined}
                      status={(ev as any).status ?? undefined}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
