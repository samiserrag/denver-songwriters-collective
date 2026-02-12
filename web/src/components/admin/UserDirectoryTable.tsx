"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";
import { deleteUser, updateSpotlightType, toggleHostStatus, toggleAdminRole } from "@/app/(protected)/dashboard/admin/users/actions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Props {
  users: Profile[];
  emailMap?: Record<string, string>;
  isSuperAdmin?: boolean;
  currentUserId?: string;
}

// Identity flag helpers with legacy role fallback
function isUserSongwriter(u: Profile): boolean {
  return u.is_songwriter || u.role === "performer";
}

function isUserHost(u: Profile): boolean {
  return u.is_host || u.role === "host";
}

function isUserStudio(u: Profile): boolean {
  return u.is_studio || u.role === "studio";
}

function isUserFan(u: Profile): boolean {
  return u.is_fan || u.role === "fan";
}

function isUserAdmin(u: Profile): boolean {
  return u.role === "admin";
}

// Get display label based on identity flags
function getUserTypeLabel(u: Profile): string {
  if (isUserAdmin(u)) return "Admin";
  if (isUserStudio(u)) return "Studio";
  if (isUserSongwriter(u) && isUserHost(u)) return "Songwriter & Host";
  if (isUserSongwriter(u)) return "Songwriter";
  if (isUserHost(u)) return "Host";
  if (isUserFan(u)) return "Fan";
  return "Member";
}

// Get badge color based on identity
function getUserTypeBadgeClass(u: Profile): string {
  if (isUserAdmin(u)) return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700";
  if (isUserStudio(u)) return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700";
  if (isUserHost(u)) return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700";
  if (isUserSongwriter(u)) return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700";
  if (isUserFan(u)) return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700";
  return "bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600";
}

function getAdminProfileHref(u: Profile): string {
  const identifier = u.slug || u.id;
  if (isUserStudio(u)) return `/studios/${identifier}`;
  if (isUserSongwriter(u) || isUserHost(u)) return `/songwriters/${identifier}`;
  return `/members/${identifier}`;
}

const SPOTLIGHT_OPTIONS = [
  { value: "", label: "Off" },
  { value: "performer", label: "Artist Spotlight" },
  { value: "host", label: "Host Spotlight" },
  { value: "studio", label: "Studio Spotlight" },
];

// Filter types - flag-based with admin using role
type FilterType = "all" | "songwriters" | "studios" | "hosts" | "fans" | "admin";

export default function UserDirectoryTable({ users, emailMap = {}, isSuperAdmin = false, currentUserId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: Profile | null }>({
    open: false,
    user: null,
  });
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [updatingSpotlight, setUpdatingSpotlight] = useState<string | null>(null);
  const [togglingHost, setTogglingHost] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [mediaModal, setMediaModal] = useState<{
    open: boolean;
    user: Profile | null;
    youtube_url: string;
    spotify_url: string;
  }>({
    open: false,
    user: null,
    youtube_url: "",
    spotify_url: "",
  });
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [mediaFieldErrors, setMediaFieldErrors] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState("");

  // Local state for optimistic UI updates - deleted users are removed immediately
  const [deletedUserIds, setDeletedUserIds] = useState<Set<string>>(new Set());

  // Reset deleted IDs when users prop changes (e.g., after router.refresh())
  useEffect(() => {
    setDeletedUserIds(new Set());
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      // Exclude optimistically deleted users
      if (deletedUserIds.has(u.id)) return false;

      // Flag-based filtering with role fallback
      let matchesFilter = true;
      switch (filterType) {
        case "songwriters":
          matchesFilter = isUserSongwriter(u);
          break;
        case "studios":
          matchesFilter = isUserStudio(u);
          break;
        case "hosts":
          matchesFilter = isUserHost(u);
          break;
        case "fans":
          matchesFilter = isUserFan(u);
          break;
        case "admin":
          matchesFilter = isUserAdmin(u);
          break;
        default:
          matchesFilter = true;
      }

      const term = search.trim().toLowerCase();
      if (!term) return matchesFilter;

      const name = (u.full_name ?? "").toLowerCase();
      const typeLabel = getUserTypeLabel(u).toLowerCase();
      const email = (emailMap[u.id] ?? "").toLowerCase();

      return (
        matchesFilter &&
        (name.includes(term) || typeLabel.includes(term) || email.includes(term))
      );
    });
  }, [users, search, filterType, deletedUserIds, emailMap]);

  const handleSpotlightChange = async (user: Profile, value: string) => {
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
      const newHostStatus = !user.is_host;
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

  const handleToggleAdmin = async (user: Profile) => {
    setTogglingAdmin(user.id);
    try {
      const makeAdmin = user.role !== "admin";
      const result = await toggleAdminRole(user.id, makeAdmin);
      if (!result.success) {
        console.error("Toggle admin error:", result.error);
        alert(result.error);
      }
      router.refresh();
    } catch (err) {
      console.error("Toggle admin error:", err);
    } finally {
      setTogglingAdmin(null);
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

    const userToDelete = deleteModal.user;

    try {
      const result = await deleteUser(userToDelete.id);

      if (!result.success) {
        setError(result.error || "Failed to delete user");
        return;
      }

      // Optimistically remove user from UI immediately
      setDeletedUserIds((prev) => new Set([...prev, userToDelete.id]));

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

  const openMediaEditor = (user: Profile) => {
    setMediaFieldErrors({});
    setMediaError("");
    setMediaModal({
      open: true,
      user,
      youtube_url: user.youtube_url ?? "",
      spotify_url: user.spotify_url ?? "",
    });
  };

  const handleSaveMedia = async () => {
    if (!mediaModal.user) return;

    setIsSavingMedia(true);
    setMediaFieldErrors({});
    setMediaError("");

    try {
      const response = await fetch(`/api/admin/users/${mediaModal.user.id}/media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtube_url: mediaModal.youtube_url,
          spotify_url: mediaModal.spotify_url,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMediaFieldErrors((payload?.fieldErrors as Record<string, string>) || {});
        setMediaError(payload?.error || "Failed to save media links.");
        return;
      }

      setMediaModal({ open: false, user: null, youtube_url: "", spotify_url: "" });
      router.refresh();
    } catch (err) {
      console.error("Save media error:", err);
      setMediaError("Failed to save media links.");
    } finally {
      setIsSavingMedia(false);
    }
  };

  const getSpotlightValue = (user: Profile): string => {
    if (!user.is_featured) return "";
    return user.spotlight_type || "";
  };

  const getSpotlightDisplayClass = (value: string): string => {
    switch (value) {
      case "performer":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700";
      case "host":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700";
      case "studio":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700";
      default:
        return "bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value as FilterType)
            }
            className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
          >
            <option value="all">All members</option>
            <option value="songwriters">Songwriters</option>
            <option value="studios">Studios</option>
            <option value="hosts">Hosts</option>
            <option value="fans">Fans</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-lg border border-[var(--color-border-default)] p-4 bg-[var(--color-bg-card)]">
        <table className="min-w-full text-left text-sm text-[var(--color-text-primary)]">
          <thead className="border-b border-[var(--color-border-default)] text-[var(--color-text-accent)]">
            <tr>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Host</th>
              <th className="py-2 px-3">Spotlight</th>
              <th className="py-2 px-3">Created</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const spotlightValue = getSpotlightValue(u);
              // Spotlight eligibility: songwriters, hosts, or studios (flag-based)
              const canBeSpotlighted = isUserSongwriter(u) || isUserHost(u) || isUserStudio(u);
              return (
                <tr key={u.id} className="border-b border-[var(--color-border-default)]/30">
                  <td className="py-2 px-3 text-[var(--color-text-primary)]">
                    <Link
                      href={getAdminProfileHref(u)}
                      className="underline decoration-transparent hover:decoration-current transition-colors text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
                    >
                      {u.full_name ?? "Unnamed User"}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-[var(--color-text-secondary)] text-xs">
                    {emailMap[u.id] ?? "-"}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wide ${getUserTypeBadgeClass(u)}`}
                    >
                      {getUserTypeLabel(u)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {/* Host toggle for songwriters (flag-based) */}
                    {isUserSongwriter(u) && !isUserAdmin(u) ? (
                      <button
                        onClick={() => handleToggleHost(u)}
                        disabled={togglingHost === u.id}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          u.is_host
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {togglingHost === u.id
                          ? "..."
                          : u.is_host
                          ? "Yes"
                          : "No"}
                      </button>
                    ) : isUserHost(u) && !isUserSongwriter(u) ? (
                      <span className="text-emerald-700 dark:text-emerald-300 text-xs">Primary Host</span>
                    ) : (
                      <span className="text-[var(--color-text-secondary)] text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {/* Spotlight eligibility: songwriters, hosts, studios (flag-based) */}
                    {canBeSpotlighted ? (
                      <select
                        value={spotlightValue}
                        onChange={(e) => handleSpotlightChange(u, e.target.value)}
                        disabled={updatingSpotlight === u.id}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${getSpotlightDisplayClass(spotlightValue)} ${
                          updatingSpotlight === u.id ? "opacity-50" : ""
                        }`}
                      >
                        {SPOTLIGHT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[var(--color-text-secondary)] text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-[var(--color-text-secondary)] text-xs">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString("en-US", { timeZone: "America/Denver" })
                      : "-"}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => openMediaEditor(u)}
                        className="text-xs underline text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)]"
                      >
                        Media
                      </button>

                      {/* Admin toggle - only visible to super admin */}
                      {isSuperAdmin && u.id !== currentUserId && (
                        <button
                          onClick={() => handleToggleAdmin(u)}
                          disabled={togglingAdmin === u.id}
                          className={`text-xs underline ${
                            u.role === "admin"
                              ? "text-orange-600 hover:text-orange-500"
                              : "text-emerald-600 hover:text-emerald-500"
                          }`}
                        >
                          {togglingAdmin === u.id
                            ? "..."
                            : u.role === "admin"
                            ? "Remove Admin"
                            : "Make Admin"}
                        </button>
                      )}
                      {/* Delete button - not for admins */}
                      {u.role === "admin" ? (
                        u.id === currentUserId ? (
                          <span className="text-[var(--color-text-secondary)] text-xs">You</span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)] text-xs">Admin</span>
                        )
                      ) : (
                        <button
                          onClick={() => setDeleteModal({ open: true, user: u })}
                          className="text-red-600 hover:text-red-500 text-xs underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-6 px-3 text-center text-[var(--color-text-secondary)]"
                >
                  No users found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Media Editor Modal */}
      {mediaModal.open && mediaModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Edit Media Links
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {mediaModal.user.full_name ?? "Member"}: paste a YouTube or Spotify link. Leave blank to clear.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  YouTube URL
                </label>
                <input
                  type="url"
                  value={mediaModal.youtube_url}
                  onChange={(e) =>
                    setMediaModal((prev) => ({ ...prev, youtube_url: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-[var(--color-bg-tertiary)] border border-gray-300 dark:border-[var(--color-border-default)] text-gray-900 dark:text-[var(--color-text-primary)]"
                />
                {mediaFieldErrors.youtube_url && (
                  <p className="mt-1 text-xs text-red-600">{mediaFieldErrors.youtube_url}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  Spotify URL
                </label>
                <input
                  type="url"
                  value={mediaModal.spotify_url}
                  onChange={(e) =>
                    setMediaModal((prev) => ({ ...prev, spotify_url: e.target.value }))
                  }
                  placeholder="https://open.spotify.com/playlist/..."
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-[var(--color-bg-tertiary)] border border-gray-300 dark:border-[var(--color-border-default)] text-gray-900 dark:text-[var(--color-text-primary)]"
                />
                {mediaFieldErrors.spotify_url && (
                  <p className="mt-1 text-xs text-red-600">{mediaFieldErrors.spotify_url}</p>
                )}
              </div>
            </div>

            {mediaError && (
              <p className="mt-4 text-sm text-red-600">{mediaError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSaveMedia}
                disabled={isSavingMedia}
                className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg transition-colors disabled:opacity-50"
              >
                {isSavingMedia ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setMediaModal({ open: false, user: null, youtube_url: "", spotify_url: "" });
                  setMediaFieldErrors({});
                  setMediaError("");
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-[var(--color-bg-tertiary)] hover:bg-gray-300 dark:hover:bg-[var(--color-bg-primary)] text-gray-900 dark:text-[var(--color-text-primary)] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-[var(--color-bg-secondary)] border border-red-300 dark:border-red-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
              Delete User
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{deleteModal.user.full_name ?? "this user"}</strong>?
            </p>
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg mb-4">
              <p className="text-red-800 dark:text-red-300 font-medium mb-2">
                This action cannot be reversed. It will permanently delete:
              </p>
              <ul className="text-red-800 dark:text-red-300 text-sm space-y-1 ml-4">
                <li>* Their profile information</li>
                <li>* All suggestions they&apos;ve submitted</li>
                <li>* All venue submissions</li>
                <li>* Their favorites and claims</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 text-sm mb-2">
                Type <strong className="text-gray-900 dark:text-white">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2 bg-gray-100 dark:bg-[var(--color-bg-tertiary)] border border-gray-300 dark:border-[var(--color-border-default)] rounded-lg text-gray-900 dark:text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-red-500 focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting || confirmText !== "DELETE"}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-200 dark:disabled:bg-red-900/50 disabled:text-red-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete User"}
              </button>
              <button
                onClick={() => {
                  setDeleteModal({ open: false, user: null });
                  setConfirmText("");
                  setError("");
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-[var(--color-bg-tertiary)] hover:bg-gray-300 dark:hover:bg-[var(--color-bg-primary)] text-gray-900 dark:text-[var(--color-text-primary)] rounded-lg transition-colors"
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
