"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  cities: string[];
  selectedCity?: string | null;
  selectedStatus?: string | null;
  search?: string | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Verified Active" },
  { value: "unverified", label: "Schedule TBD" },
  { value: "inactive", label: "Inactive" },
];

export default function OpenMicFilters({
  cities,
  selectedCity,
  selectedStatus,
  search,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState<string>(search ?? "");
  const [city, setCity] = useState<string>(selectedCity ?? "all");
  const [status, setStatus] = useState<string>(selectedStatus ?? "all");

  function buildQuery(overrides: Record<string, string | undefined | null>) {
    const params = new URLSearchParams();
    const s = overrides.search ?? q ?? "";
    if (s) params.set("search", s);
    const c = overrides.city ?? city;
    if (c && c !== "all") params.set("city", c);
    const st = overrides.status ?? status;
    if (st && st !== "all") params.set("status", st);
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
          placeholder="Search title, venue, notes..."
          className="w-full sm:w-80 rounded-xl bg-white/5 px-4 py-2 placeholder:text-white/40 text-white focus:outline-none focus:ring-2 focus:ring-[#00FFCC]/60 transition"
          aria-label="Search open mics"
        />
        <button
          onClick={() => navigateTo({ search: q })}
          className="ml-2 inline-flex items-center px-4 py-2 rounded-xl bg-[#00FFCC]/20 text-[#00FFCC] hover:bg-[#00FFCC]/30 transition"
        >
          Search
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={status ?? "all"}
          onChange={(e) => {
            setStatus(e.target.value);
            navigateTo({ status: e.target.value });
          }}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white focus:outline-none"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={city ?? "all"}
          onChange={(e) => {
            setCity(e.target.value);
            navigateTo({ city: e.target.value });
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
      </div>
    </div>
  );
}
