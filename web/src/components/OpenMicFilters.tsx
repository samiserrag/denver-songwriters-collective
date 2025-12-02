"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  cities: string[];
  selectedCity?: string | null;
  selectedDay?: string | null;
  search?: string | null;
  activeOnly?: boolean;
  page?: number;
}

export default function OpenMicFilters({
  cities,
  selectedCity,
  selectedDay,
  search,
  activeOnly,
  page = 1,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState<string>(search ?? "");
  const [city, setCity] = useState<string>(selectedCity ?? "all");
  const [day, setDay] = useState<string>(selectedDay ?? "");
  const [active, setActive] = useState<boolean>(!!activeOnly);

  function buildQuery(overrides: Record<string, string | undefined | null>) {
    const params = new URLSearchParams();
    const s = overrides.search ?? q ?? "";
    if (s) params.set("search", s);
    const c = overrides.city ?? city;
    if (c && c !== "all") params.set("city", c);
    const d = overrides.day ?? day;
    if (d) params.set("day", d);
    const a = overrides.active ?? (active ? "1" : "0");
    if (a !== undefined) params.set("active", String(a));
    const p = overrides.page ?? String(page ?? 1);
    if (p) params.set("page", p);
    return `/open-mics?${params.toString()}`;
  }

  function navigateTo(overrides: Record<string, string | undefined | null>) {
    const url = buildQuery(overrides);
    startTransition(() => {
      router.push(url);
    });
  }

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <input
          type="search"
          name="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, venue, notes, day..."
          className="w-full sm:w-80 rounded-xl bg-white/5 px-4 py-2 placeholder:text-white/40 text-white focus:outline-none focus:ring-2 focus:ring-[#00FFCC]/60 transition"
          aria-label="Search open mics"
        />
        <button
          onClick={() => navigateTo({ search: q, page: "1" })}
          className="ml-2 inline-flex items-center px-4 py-2 rounded-xl bg-[#00FFCC]/20 text-[#00FFCC] hover:bg-[#00FFCC]/30 transition"
        >
          Search
        </button>

      
      </div>

      <div className="flex gap-2 items-center">
        <select
          value={city ?? "all"}
          onChange={(e) => {
            setCity(e.target.value);
            navigateTo({ city: e.target.value, page: "1" });
          }}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white focus:outline-none"
          aria-label="Filter by city"
        >
          <option value="all">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={day ?? ""}
          onChange={(e) => {
            setDay(e.target.value);
            navigateTo({ day: e.target.value || undefined, page: "1" });
          }}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white focus:outline-none"
          aria-label="Filter by day"
        >
          <option value="">All Days</option>
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            const next = !active;
            setActive(next);
            navigateTo({ active: next ? "1" : "0", page: "1" });
          }}
          className={`px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition ${
            active ? "bg-[#22FF88]/30 text-[#22FF88]" : "text-white"
          }`}
        >
          {active ? "Active Only" : "Show All"}
        </button>
      </div>
    </div>
  );
}
