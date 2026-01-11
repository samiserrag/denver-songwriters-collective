"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  website_url?: string;
  phone?: string;
  google_maps_url?: string;
  created_at: string;
  updated_at: string;
  happenings_count?: number;
}

/** Check if a string is a valid URL starting with http:// or https:// */
function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export default function AdminVenuesClient() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New venue form
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({
    name: "",
    address: "",
    city: "Denver",
    state: "CO",
    zip: "",
    website_url: "",
    phone: "",
    google_maps_url: "",
  });

  // Edit venue
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  const fetchVenues = async () => {
    try {
      const res = await fetch("/api/admin/venues");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch venues");
      }
      const data = await res.json();
      setVenues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load venues");
      console.error(err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchVenues();
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenue.name.trim()) return;

    setActionLoading("new");
    try {
      const res = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVenue),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create venue");
      }
      await fetchVenues();
      setNewVenue({
        name: "",
        address: "",
        city: "Denver",
        state: "CO",
        zip: "",
        website_url: "",
        phone: "",
        google_maps_url: "",
      });
      setShowNewVenue(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create venue");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue) return;

    setActionLoading(editingVenue.id);
    try {
      const res = await fetch(`/api/admin/venues/${editingVenue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingVenue),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update venue");
      }
      await fetchVenues();
      setEditingVenue(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update venue");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteVenue = async (id: string, name: string) => {
    if (!confirm(`Delete venue "${name}"? This cannot be undone.`)) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/venues/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete venue");
      }
      await fetchVenues();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete venue");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-4xl font-bold text-[var(--color-accent-primary)]">Venue Management</h1>
        <Link
          href="/dashboard/admin/ops/venues"
          className="text-[var(--color-accent-primary)] hover:underline text-sm"
        >
          Bulk operations →
        </Link>
      </div>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Manage venues for happenings. ({venues.length} venues)
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-600">
          {error}
        </div>
      )}

      {/* Add Venue Button */}
      <button
        onClick={() => setShowNewVenue(!showNewVenue)}
        className="mb-4 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-background)] font-medium"
      >
        + Add Venue
      </button>

      {/* New Venue Form */}
      {showNewVenue && (
        <form
          onSubmit={handleCreateVenue}
          className="mb-6 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
        >
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">New Venue</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Venue name *"
              value={newVenue.name}
              onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              required
            />
            <input
              type="text"
              placeholder="Address"
              value={newVenue.address}
              onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="text"
              placeholder="City"
              value={newVenue.city}
              onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="text"
              placeholder="State"
              value={newVenue.state}
              onChange={(e) => setNewVenue({ ...newVenue, state: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="text"
              placeholder="ZIP Code"
              value={newVenue.zip}
              onChange={(e) => setNewVenue({ ...newVenue, zip: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="text"
              placeholder="Phone"
              value={newVenue.phone}
              onChange={(e) => setNewVenue({ ...newVenue, phone: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="url"
              placeholder="Website URL"
              value={newVenue.website_url}
              onChange={(e) => setNewVenue({ ...newVenue, website_url: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="url"
              placeholder="Google Maps URL"
              value={newVenue.google_maps_url}
              onChange={(e) =>
                setNewVenue({ ...newVenue, google_maps_url: e.target.value })
              }
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={actionLoading === "new"}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {actionLoading === "new" ? "Creating..." : "Create Venue"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewVenue(false)}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Edit Venue Modal */}
      {editingVenue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleUpdateVenue}
            className="w-full max-w-2xl p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Edit Venue</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Venue name *"
                value={editingVenue.name}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, name: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
                required
              />
              <input
                type="text"
                placeholder="Address"
                value={editingVenue.address}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, address: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="text"
                placeholder="City"
                value={editingVenue.city}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, city: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="text"
                placeholder="State"
                value={editingVenue.state}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, state: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="text"
                placeholder="ZIP Code"
                value={editingVenue.zip || ""}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, zip: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="text"
                placeholder="Phone"
                value={editingVenue.phone || ""}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, phone: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="url"
                placeholder="Website URL"
                value={editingVenue.website_url || ""}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, website_url: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="url"
                placeholder="Google Maps URL"
                value={editingVenue.google_maps_url || ""}
                onChange={(e) =>
                  setEditingVenue({ ...editingVenue, google_maps_url: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={actionLoading === editingVenue.id}
                className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-background)] disabled:opacity-50"
              >
                {actionLoading === editingVenue.id ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingVenue(null)}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Venues Table */}
      {venues.length === 0 ? (
        <p className="text-[var(--color-text-tertiary)]">No venues found. Add your first venue above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border-default)]">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Happenings</th>
                <th className="px-3 py-2">View</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr
                  key={venue.id}
                  className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">{venue.name}</td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {venue.address || "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {venue.city || "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {venue.state || "—"}
                  </td>
                  {/* Website column */}
                  <td className="px-3 py-2">
                    {isValidUrl(venue.website_url) ? (
                      <a
                        href={venue.website_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-text-accent)] hover:underline text-xs"
                      >
                        Website ↗
                      </a>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">—</span>
                    )}
                  </td>
                  {/* Happenings count column */}
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {venue.happenings_count ?? 0}
                  </td>
                  {/* View link column */}
                  <td className="px-3 py-2">
                    <Link
                      href={`/venues/${venue.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-text-accent)] hover:underline text-xs"
                    >
                      View →
                    </Link>
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => setEditingVenue(venue)}
                      className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteVenue(venue.id, venue.name)}
                      disabled={actionLoading === venue.id}
                      className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
