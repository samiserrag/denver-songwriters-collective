"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Props {
  performers: Profile[];
}

export default function PerformerSpotlightTable({ performers }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [rows, setRows] = useState(performers);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updatePerformer(id: string, is_featured: boolean, featured_rank: number) {
    setLoadingId(id);

    const { error } = await supabase
      .from("profiles")
      .update({ is_featured, featured_rank })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setLoadingId(null);
      return;
    }

    setRows(prev =>
      prev.map(p =>
        p.id === id ? { ...p, is_featured, featured_rank } : p
      )
    );

    setLoadingId(null);
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-white/10 p-4 bg-black/20">
      <table className="min-w-full text-left text-white">
        <thead className="border-b border-white/10 text-gold-400">
          <tr>
            <th className="py-2 px-3">Name</th>
            <th className="py-2 px-3">Featured</th>
            <th className="py-2 px-3">Rank</th>
            <th className="py-2 px-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-white/5">
              <td className="py-2 px-3">{p.full_name ?? "Unnamed Performer"}</td>

              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={p.is_featured ?? false}
                  onChange={(e) =>
                    updatePerformer(
                      p.id,
                      e.target.checked,
                      p.featured_rank ?? 9999
                    )
                  }
                  disabled={loadingId === p.id}
                />
              </td>

              <td className="py-2 px-3">
                <input
                  type="number"
                  className="bg-black/40 border border-white/10 rounded px-2 py-1 w-20"
                  value={p.featured_rank ?? 9999}
                  onChange={(e) =>
                    updatePerformer(
                      p.id,
                      p.is_featured ?? false,
                      Number(e.target.value)
                    )
                  }
                  disabled={loadingId === p.id}
                />
              </td>

              <td className="py-2 px-3">
                {loadingId === p.id ? (
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
