"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { deleteUser, updateSpotlightType, toggleHostStatus } from "@/app/(protected)/dashboard/admin/users/actions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ExtendedProfile = Profile & { is_host?: boolean; spotlight_type?: string | null };

interface Props {
  users: Profile[];
}

const ROLE_LABELS: Record<string, string> = {
  performer: "Performer",
  studio: "Studio",
  host: "Host",
  admin: "Admin",
};

const SPOTLIGHT_OPTIONS = [
  { value: "", label: "Off" },
  { value: "performer", label: "Artist Spotlight" },
  { value: "host", label: "Host Spotlight" },
  { value: "studio", label: "Studio Spotlight" },
];

export default function UserDirectoryTable({ users }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "performer" | "studio" | "host" | "admin">("all");
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: Profile | null }>({
    open: false,
    user: null,
  });
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [updatingSpotlight, setUpdatingSpotlight] = useState<string | null>(null);
  const [togglingHost, setTogglingHost] = useState<string | null>(null);

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

  const handleSpotlightChange = async (user: ExtendedProfile, value: string) => {
    setUpdatingSpotlight(user.id);
    try {
      const spotlightType = value === "" ? null : (value as "performer" | "host" | "studio");
      const result = await updateSpotlightType(user.id, spotlightType);
      if (!result.success) {
        console.error("Update spotlight error:", result.error);
      }
      router.refresh();
    } catch (err) {
      console.error("Update spotlight error:", err);
    } finally {
      setUpdatingSpotlight(null);
    }
  };

  const handleToggleHost = async (user: Profile) => {
    setTogglingHost(user.id);
    try {
      const newHostStatus = !(user as ExtendedProfile).is_host;
      const result = await toggleHostStatus(user.id, newHostStatus);
      if (!result.success) {
        console.error("Toggle host error:", result.error);
      }
      router.refresh();
    } catch (err) {
      console.error("Toggle host error:", err);
    } finally {
      setTogglingHost(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.user) return;
    if (confirmText !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    if (deleteModal.user.role === "admin") {
      setError("Cannot delete admin accounts");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const result = await deleteUser(deleteModal.user.id);

      if (!result.success) {
        setError(result.error || "Failed to delete user");
        return;
      }

      setDeleteModal({ open: false, user: null });
      setConfirmText("");
      router.refresh();
    } catch (err) {
      console.error("Delete user error:", err);
      setError("Failed to delete user. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getSpotlightValue = (user: ExtendedProfile): string => {
    if (!user.is_featured) return "";
    return user.spotlight_type || "";
  };

  const getSpotlightDisplayClass = (value: string): string => {
    switch (value) {
      case "performer":
        return "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30";
      case "host":
        return "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30";
      case "studio":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-600";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as typeof roleFilter)
            }
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
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
              <th className="py-2 px-3">Also Host</th>
              <th className="py-2 px-3">Spotlight</th>
              <th className="py-2 px-3">Created</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const user = u as ExtendedProfile;
              const spotlightValue = getSpotlightValue(user);
              return (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="py-2 px-3">
                    {u.full_name ?? "Unnamed User"}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs uppercase tracking-wide text-[var(--color-text-accent)]"
                    >
                      {ROLE_LABELS[u.role as string] ?? u.role ?? "Unknown"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {u.role === "performer" ? (
                      <button
                        onClick={() => handleToggleHost(u)}
                        disabled={togglingHost === u.id}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          user.is_host
                            ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] hover:bg-[var(--color-accent-primary)]/30 border border-[var(--color-border-accent)]/30"
                            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-600"
                        }`}
                      >
                        {togglingHost === u.id
                          ? "..."
                          : user.is_host
                          ? "Yes"
                          : "No"}
                      </button>
                    ) : u.role === "host" ? (
                      <span className="text-[var(--color-text-accent)] text-xs">Primary Host</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {u.role === "performer" || u.role === "host" || u.role === "studio" ? (
                      <select
                        value={spotlightValue}
                        onChange={(e) => handleSpotlightChange(user, e.target.value)}
                        disabled={updatingSpotlight === u.id}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${getSpotlightDisplayClass(spotlightValue)} ${
                          updatingSpotlight === u.id ? "opacity-50" : ""
                        }`}
                      >
                        {SPOTLIGHT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-neutral-400 text-xs">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="py-2 px-3">
                    {u.role === "admin" ? (
                      <span className="text-neutral-500 text-xs">Protected</span>
                    ) : (
                      <button
                        onClick={() => setDeleteModal({ open: true, user: u })}
                        className="text-red-400 hover:text-red-300 text-xs underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 px-3 text-center text-neutral-400"
                >
                  No users found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-neutral-900 border border-red-900/50 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-red-400 mb-4">
              Delete User
            </h2>
            <p className="text-neutral-300 mb-4">
              Are you sure you want to delete <strong className="text-white">{deleteModal.user.full_name ?? "this user"}</strong>?
            </p>
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg mb-4">
              <p className="text-red-300 font-medium mb-2">
                This action cannot be reversed. It will permanently delete:
              </p>
              <ul className="text-red-200 text-sm space-y-1 ml-4">
                <li>* Their profile information</li>
                <li>* All suggestions they&apos;ve submitted</li>
                <li>* All venue submissions</li>
                <li>* Their favorites and claims</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-neutral-300 text-sm mb-2">
                Type <strong className="text-white">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting || confirmText !== "DELETE"}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete User"}
              </button>
              <button
                onClick={() => {
                  setDeleteModal({ open: false, user: null });
                  setConfirmText("");
                  setError("");
                }}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
