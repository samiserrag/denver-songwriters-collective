"use client";

import { useState, useEffect } from "react";

type HighlightType = "event" | "performer" | "venue" | "custom";

interface Highlight {
  id: string;
  title: string;
  description: string | null;
  highlight_type: HighlightType;
  event_id: string | null;
  performer_id: string | null;
  venue_id: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  display_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  event?: { id: string; title: string } | null;
  performer?: { id: string; full_name: string } | null;
  venue?: { id: string; name: string } | null;
}

const HIGHLIGHT_TYPES: { value: HighlightType; label: string }[] = [
  { value: "custom", label: "Custom Content" },
  { value: "event", label: "Featured Event" },
  { value: "performer", label: "Featured Performer" },
  { value: "venue", label: "Featured Venue" },
];

export default function AdminHighlightsClient() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New highlight form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newHighlight, setNewHighlight] = useState<{
    title: string;
    description: string;
    highlight_type: HighlightType;
    image_url: string;
    link_url: string;
    link_text: string;
    display_order: number;
    is_active: boolean;
    start_date: string;
    end_date: string;
  }>({
    title: "",
    description: "",
    highlight_type: "custom",
    image_url: "",
    link_url: "",
    link_text: "Learn More",
    display_order: 0,
    is_active: true,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  });

  // Edit highlight
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);

  const fetchHighlights = async () => {
    try {
      const res = await fetch("/api/admin/highlights");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch highlights");
      }
      const data = await res.json();
      setHighlights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load highlights");
      console.error(err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchHighlights();
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCreateHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHighlight.title.trim()) return;

    setActionLoading("new");
    try {
      const res = await fetch("/api/admin/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHighlight),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create highlight");
      }
      await fetchHighlights();
      setNewHighlight({
        title: "",
        description: "",
        highlight_type: "custom",
        image_url: "",
        link_url: "",
        link_text: "Learn More",
        display_order: 0,
        is_active: true,
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
      });
      setShowNewForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create highlight");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHighlight) return;

    setActionLoading(editingHighlight.id);
    try {
      const res = await fetch(`/api/admin/highlights/${editingHighlight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingHighlight),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update highlight");
      }
      await fetchHighlights();
      setEditingHighlight(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update highlight");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteHighlight = async (id: string, title: string) => {
    if (!confirm(`Delete highlight "${title}"? This cannot be undone.`)) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/highlights/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete highlight");
      }
      await fetchHighlights();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete highlight");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (highlight: Highlight) => {
    setActionLoading(highlight.id);
    try {
      const res = await fetch(`/api/admin/highlights/${highlight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !highlight.is_active }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle highlight");
      }
      await fetchHighlights();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle highlight");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
        <p className="text-[var(--color-text-tertiary)]">Loading...</p>
      </div>
    );
  }

  const activeHighlights = highlights.filter((h) => h.is_active);
  const inactiveHighlights = highlights.filter((h) => !h.is_active);

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-2">Monthly Highlights</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Manage featured content shown on the homepage. ({highlights.length} highlights)
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded text-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Add Highlight Button */}
      <button
        onClick={() => setShowNewForm(!showNewForm)}
        className="mb-4 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-text-on-accent)] font-medium"
      >
        + Add Highlight
      </button>

      {/* New Highlight Form */}
      {showNewForm && (
        <form
          onSubmit={handleCreateHighlight}
          className="mb-6 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
        >
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">New Highlight</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Title *"
              value={newHighlight.title}
              onChange={(e) => setNewHighlight({ ...newHighlight, title: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              required
            />
            <select
              value={newHighlight.highlight_type}
              onChange={(e) =>
                setNewHighlight({
                  ...newHighlight,
                  highlight_type: e.target.value as Highlight["highlight_type"],
                })
              }
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            >
              {HIGHLIGHT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Description"
              value={newHighlight.description}
              onChange={(e) => setNewHighlight({ ...newHighlight, description: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
              rows={2}
            />
            <input
              type="url"
              placeholder="Image URL"
              value={newHighlight.image_url}
              onChange={(e) => setNewHighlight({ ...newHighlight, image_url: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="url"
              placeholder="Link URL"
              value={newHighlight.link_url}
              onChange={(e) => setNewHighlight({ ...newHighlight, link_url: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="text"
              placeholder="Link Text"
              value={newHighlight.link_text}
              onChange={(e) => setNewHighlight({ ...newHighlight, link_text: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="number"
              placeholder="Display Order"
              value={newHighlight.display_order}
              onChange={(e) =>
                setNewHighlight({ ...newHighlight, display_order: parseInt(e.target.value) || 0 })
              }
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="date"
              placeholder="Start Date"
              value={newHighlight.start_date}
              onChange={(e) => setNewHighlight({ ...newHighlight, start_date: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <input
              type="date"
              placeholder="End Date (optional)"
              value={newHighlight.end_date}
              onChange={(e) => setNewHighlight({ ...newHighlight, end_date: e.target.value })}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={actionLoading === "new"}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {actionLoading === "new" ? "Creating..." : "Create Highlight"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Edit Highlight Modal */}
      {editingHighlight && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleUpdateHighlight}
            className="w-full max-w-2xl p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Edit Highlight</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Title *"
                value={editingHighlight.title}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, title: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
                required
              />
              <select
                value={editingHighlight.highlight_type}
                onChange={(e) =>
                  setEditingHighlight({
                    ...editingHighlight,
                    highlight_type: e.target.value as Highlight["highlight_type"],
                  })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              >
                {HIGHLIGHT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Description"
                value={editingHighlight.description || ""}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, description: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
                rows={2}
              />
              <input
                type="url"
                placeholder="Image URL"
                value={editingHighlight.image_url || ""}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, image_url: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="url"
                placeholder="Link URL"
                value={editingHighlight.link_url || ""}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, link_url: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="text"
                placeholder="Link Text"
                value={editingHighlight.link_text || ""}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, link_text: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="number"
                placeholder="Display Order"
                value={editingHighlight.display_order}
                onChange={(e) =>
                  setEditingHighlight({
                    ...editingHighlight,
                    display_order: parseInt(e.target.value) || 0,
                  })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="date"
                placeholder="Start Date"
                value={editingHighlight.start_date || ""}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, start_date: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
              <input
                type="date"
                placeholder="End Date (optional)"
                value={editingHighlight.end_date || ""}
                onChange={(e) =>
                  setEditingHighlight({ ...editingHighlight, end_date: e.target.value })
                }
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={actionLoading === editingHighlight.id}
                className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-background)] disabled:opacity-50"
              >
                {actionLoading === editingHighlight.id ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingHighlight(null)}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Highlights */}
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3 mt-8">
        Active Highlights ({activeHighlights.length})
      </h2>
      {activeHighlights.length === 0 ? (
        <p className="text-[var(--color-text-tertiary)] mb-6">No active highlights. Create one above!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {activeHighlights.map((highlight) => (
            <div
              key={highlight.id}
              className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] mr-2">
                    {HIGHLIGHT_TYPES.find((t) => t.value === highlight.highlight_type)?.label}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">Order: {highlight.display_order}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingHighlight(highlight)}
                    className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(highlight)}
                    disabled={actionLoading === highlight.id}
                    className="text-yellow-400 hover:text-yellow-300 text-xs disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleDeleteHighlight(highlight.id, highlight.title)}
                    disabled={actionLoading === highlight.id}
                    className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <h3 className="text-[var(--color-text-primary)] font-medium">{highlight.title}</h3>
              {highlight.description && (
                <p className="text-[var(--color-text-tertiary)] text-sm mt-1 line-clamp-2">
                  {highlight.description}
                </p>
              )}
              {highlight.link_url && (
                <p className="text-[var(--color-text-accent)] text-xs mt-2 truncate">{highlight.link_url}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inactive Highlights */}
      {inactiveHighlights.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-[var(--color-text-tertiary)] mb-3">
            Inactive Highlights ({inactiveHighlights.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactiveHighlights.map((highlight) => (
              <div
                key={highlight.id}
                className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] rounded-lg opacity-60"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
                    {HIGHLIGHT_TYPES.find((t) => t.value === highlight.highlight_type)?.label}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingHighlight(highlight)}
                      className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(highlight)}
                      disabled={actionLoading === highlight.id}
                      className="text-green-400 hover:text-green-300 text-xs disabled:opacity-50"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => handleDeleteHighlight(highlight.id, highlight.title)}
                      disabled={actionLoading === highlight.id}
                      className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <h3 className="text-[var(--color-text-secondary)] font-medium">{highlight.title}</h3>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
