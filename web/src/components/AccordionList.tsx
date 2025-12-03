"use client";

import { useState } from "react";
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
  const [openDay, setOpenDay] = useState<string | null>(null);

  // initialize groups
  const groupedByDay: Record<string, EventWithVenue[]> = {};
  for (const day of daysOrdered) groupedByDay[day] = [];

  for (const ev of events ?? []) {
    const day = ev.day_of_week ?? "UNKNOWN";
    if (!groupedByDay[day]) groupedByDay[day] = [];
    groupedByDay[day].push(ev);
  }

  // sort each day's list by start_time then title
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

  return (
    <div className="space-y-4">
      {daysOrdered.map((day) => {
        const list = groupedByDay[day] || [];
        // Always render the day header; show message when no events

        const isOpen = openDay === day;

        return (
          <div key={day} className="border border-white/10 rounded-xl bg-white/3 overflow-hidden">
            <button
              onClick={() => setOpenDay(isOpen ? null : day)}
              className="w-full flex justify-between items-center px-4 py-3 text-left text-lg font-semibold text-teal-300 hover:bg-white/5"
            >
              <span>{day}</span>
              <span className="text-gray-400">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {list.length === 0 ? (
                  <div className="text-sm text-[var(--color-warm-gray-light)] py-2">
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
                      venue_city={ev.venue?.city ?? undefined}
                      venue_state={ev.venue?.state ?? undefined}
                      start_time={ev.start_time ?? undefined}
                      end_time={ev.end_time ?? undefined}
                      map_url={(ev as any).mapUrl ?? undefined}
                      searchQuery={searchQuery ?? undefined}
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
