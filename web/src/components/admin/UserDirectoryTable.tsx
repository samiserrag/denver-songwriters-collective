"use client";

import { useMemo, useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Props {
  users: Profile[];
}

const ROLE_LABELS: Record<string, string> = {
  performer: "Performer",
  studio: "Studio",
  host: "Host",
  admin: "Admin",
};

export default function UserDirectoryTable({ users }: Props) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "performer" | "studio" | "host" | "admin">("all");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesRole =
        roleFilter === "all" ? true : u.role === roleFilter;

      const term = search.trim().toLowerCase();
      if (!term) return matchesRole;

      const name = (u.full_name ?? "").toLowerCase();
      const role = (u.role ?? "").toString().toLowerCase();

      return (
        matchesRole &&
        (name.includes(term) || role.includes(term))
      );
    });
  }, [users, search, roleFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/60"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as typeof roleFilter)
            }
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/60"
          >
            <option value="all">All roles</option>
            <option value="performer">Performers</option>
            <option value="studio">Studios</option>
            <option value="host">Hosts</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-lg border border-white/10 p-4 bg-black/20">
        <table className="min-w-full text-left text-sm text-white">
          <thead className="border-b border-white/10 text-gold-400">
            <tr>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Featured</th>
              <th className="py-2 px-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="py-2 px-3">
                  {u.full_name ?? "Unnamed User"}
                </td>
                <td className="py-2 px-3">
                  <span
                    className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs uppercase tracking-wide text-[var(--color-gold)]"
                  >
                    {ROLE_LABELS[u.role as string] ?? u.role ?? "Unknown"}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {u.is_featured ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-gold)]/15 px-2.5 py-0.5 text-xs text-[var(--color-gold)]">
                      Spotlight #{u.featured_rank ?? 9999}
                    </span>
                  ) : (
                    <span className="text-neutral-500 text-xs">
                      —
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-neutral-400 text-xs">
                  {u.created_at
                    ? new Date(u.created_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 px-3 text-center text-neutral-400"
                >
                  No users found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
