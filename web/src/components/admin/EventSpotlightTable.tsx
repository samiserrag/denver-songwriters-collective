"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];

interface Props {
  events: DBEvent[];
}

export default function EventSpotlightTable({ events }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [rows, setRows] = useState(events);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updateEvent(id: string, is_featured: boolean, featured_rank: number) {
    setLoadingId(id);

    const { error } = await supabase
      .from("events")
      .update({ is_featured, featured_rank })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setLoadingId(null);
      return;
    }

    setRows(prev =>
      prev.map(ev =>
        ev.id === id ? { ...ev, is_featured, featured_rank } : ev
      )
    );

    setLoadingId(null);
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-white/10 p-4 bg-black/20">
      <table className="min-w-full text-left text-white">
        <thead className="border-b border-white/10 text-gold-400">
          <tr>
            <th className="py-2 px-3">Title</th>
            <th className="py-2 px-3">Date</th>
            <th className="py-2 px-3">Venue</th>
            <th className="py-2 px-3">Featured</th>
            <th className="py-2 px-3">Rank</th>
            <th className="py-2 px-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((ev) => (
            <tr key={ev.id} className="border-b border-white/5">
              <td className="py-2 px-3">{ev.title}</td>
              <td className="py-2 px-3">{ev.event_date}</td>
              <td className="py-2 px-3">{ev.venue_name ?? "—"}</td>

              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={ev.is_featured ?? false}
                  onChange={(e) =>
                    updateEvent(
                      ev.id,
                      e.target.checked,
                      ev.featured_rank ?? 9999
                    )
                  }
                  disabled={loadingId === ev.id}
                />
              </td>

              <td className="py-2 px-3">
                <input
                  type="number"
                  className="bg-black/40 border border-white/10 rounded px-2 py-1 w-20"
                  value={ev.featured_rank ?? 9999}
                  onChange={(e) =>
                    updateEvent(
                      ev.id,
                      ev.is_featured ?? false,
                      Number(e.target.value)
                    )
                  }
                  disabled={loadingId === ev.id}
                />
              </td>

              <td className="py-2 px-3">
                {loadingId === ev.id ? (
                  <span className="text-gold-400">Saving…</span>
                ) : (
                  <span className="text-neutral-400 text-sm">Ready</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
