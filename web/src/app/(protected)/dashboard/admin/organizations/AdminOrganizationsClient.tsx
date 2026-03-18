"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrganizationRecord, OrganizationVisibility } from "@/lib/organizations";
import {
  parseGalleryInput,
  parseTagsInput,
  stringifyGallery,
  stringifyTags,
  toSlug,
} from "@/lib/organizations";

type OrganizationFormState = {
  slug: string;
  name: string;
  website_url: string;
  city: string;
  organization_type: string;
  short_blurb: string;
  why_it_matters: string;
  tags: string;
  featured: boolean;
  is_active: boolean;
  visibility: OrganizationVisibility;
  logo_image_url: string;
  cover_image_url: string;
  gallery_image_urls: string;
  fun_note: string;
  sort_order: number;
};

const EMPTY_FORM: OrganizationFormState = {
  slug: "",
  name: "",
  website_url: "",
  city: "",
  organization_type: "",
  short_blurb: "",
  why_it_matters: "",
  tags: "",
  featured: false,
  is_active: true,
  visibility: "unlisted",
  logo_image_url: "",
  cover_image_url: "",
  gallery_image_urls: "",
  fun_note: "",
  sort_order: 0,
};

function fromRecord(record: OrganizationRecord): OrganizationFormState {
  return {
    slug: record.slug,
    name: record.name,
    website_url: record.website_url,
    city: record.city ?? "",
    organization_type: record.organization_type ?? "",
    short_blurb: record.short_blurb,
    why_it_matters: record.why_it_matters,
    tags: stringifyTags(record.tags),
    featured: record.featured,
    is_active: record.is_active,
    visibility: record.visibility,
    logo_image_url: record.logo_image_url ?? "",
    cover_image_url: record.cover_image_url ?? "",
    gallery_image_urls: stringifyGallery(record.gallery_image_urls),
    fun_note: record.fun_note ?? "",
    sort_order: record.sort_order ?? 0,
  };
}

function toPayload(form: OrganizationFormState) {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    website_url: form.website_url.trim(),
    city: form.city.trim(),
    organization_type: form.organization_type.trim(),
    short_blurb: form.short_blurb.trim(),
    why_it_matters: form.why_it_matters.trim(),
    tags: parseTagsInput(form.tags),
    featured: form.featured,
    is_active: form.is_active,
    visibility: form.visibility,
    logo_image_url: form.logo_image_url.trim(),
    cover_image_url: form.cover_image_url.trim(),
    gallery_image_urls: parseGalleryInput(form.gallery_image_urls),
    fun_note: form.fun_note.trim(),
    sort_order: Number(form.sort_order) || 0,
  };
}

export default function AdminOrganizationsClient() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<OrganizationFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<OrganizationRecord | null>(null);
  const [editForm, setEditForm] = useState<OrganizationFormState>(EMPTY_FORM);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const total = organizations.length;
  const activeCount = useMemo(
    () => organizations.filter((row) => row.is_active).length,
    [organizations]
  );
  const publicCount = useMemo(
    () => organizations.filter((row) => row.visibility === "public").length,
    [organizations]
  );

  async function fetchOrganizations() {
    setError("");
    const res = await fetch("/api/admin/organizations");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch organizations");
    }
    setOrganizations(data as OrganizationRecord[]);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchOrganizations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organizations");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function openEdit(record: OrganizationRecord) {
    setEditing(record);
    setEditForm(fromRecord(record));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("create");
    try {
      const payload = toPayload(createForm);
      if (!payload.slug) payload.slug = toSlug(payload.name);

      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create organization");

      await fetchOrganizations();
      setCreateForm(EMPTY_FORM);
      setShowCreateForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setActionLoading(editing.id);
    try {
      const payload = toPayload(editForm);
      const res = await fetch(`/api/admin/organizations/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update organization");

      await fetchOrganizations();
      setEditing(null);
      setEditForm(EMPTY_FORM);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update organization");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(record: OrganizationRecord) {
    if (!confirm(`Delete organization "${record.name}"? This cannot be undone.`)) return;
    setActionLoading(record.id);
    try {
      const res = await fetch(`/api/admin/organizations/${record.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete organization");
      await fetchOrganizations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete organization");
    } finally {
      setActionLoading(null);
    }
  }

  function renderForm(
    form: OrganizationFormState,
    setForm: (next: OrganizationFormState) => void
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            const nextSlug = form.slug ? form.slug : toSlug(name);
            setForm({ ...form, name, slug: nextSlug });
          }}
          placeholder="Organization Name *"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          required
        />
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: toSlug(e.target.value) })}
          placeholder="slug *"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          required
        />
        <input
          type="url"
          value={form.website_url}
          onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          placeholder="Website URL *"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
          required
        />
        <input
          type="text"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
        <input
          type="text"
          value={form.organization_type}
          onChange={(e) => setForm({ ...form, organization_type: e.target.value })}
          placeholder="Organization Type"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
        <textarea
          value={form.short_blurb}
          onChange={(e) => setForm({ ...form, short_blurb: e.target.value })}
          placeholder="Short Blurb *"
          rows={3}
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
          required
        />
        <textarea
          value={form.why_it_matters}
          onChange={(e) => setForm({ ...form, why_it_matters: e.target.value })}
          placeholder="Why It Matters *"
          rows={3}
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
          required
        />
        <input
          type="text"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Tags (comma-separated)"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
        />
        <input
          type="url"
          value={form.logo_image_url}
          onChange={(e) => setForm({ ...form, logo_image_url: e.target.value })}
          placeholder="Logo Image URL"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
        <input
          type="url"
          value={form.cover_image_url}
          onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
          placeholder="Cover Image URL"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
        <textarea
          value={form.gallery_image_urls}
          onChange={(e) => setForm({ ...form, gallery_image_urls: e.target.value })}
          placeholder="Gallery image URLs (one per line)"
          rows={3}
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
        />
        <textarea
          value={form.fun_note}
          onChange={(e) => setForm({ ...form, fun_note: e.target.value })}
          placeholder="Fun note (optional)"
          rows={2}
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] md:col-span-2"
        />
        <select
          value={form.visibility}
          onChange={(e) => setForm({ ...form, visibility: e.target.value as OrganizationVisibility })}
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        >
          <option value="private">private</option>
          <option value="unlisted">unlisted</option>
          <option value="public">public</option>
        </select>
        <input
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "0", 10) || 0 })}
          placeholder="Sort Order"
          className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
        <label className="inline-flex items-center gap-2 text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          />
          Featured
        </label>
        <label className="inline-flex items-center gap-2 text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active
        </label>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
        <p className="text-[var(--color-text-tertiary)]">Loading organizations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-2">Organizations</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Admin portal for Friends of the Collective cards. {activeCount}/{total} active, {publicCount} public.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded text-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={() => setShowCreateForm((v) => !v)}
        className="mb-4 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-text-on-accent)] font-medium"
      >
        + Add Organization
      </button>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
        >
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">New Organization</h3>
          {renderForm(createForm, setCreateForm)}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={actionLoading === "create"}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white disabled:opacity-50"
            >
              {actionLoading === "create" ? "Creating..." : "Create Organization"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleUpdate}
            className="w-full max-w-4xl p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Edit Organization</h3>
            {renderForm(editForm, setEditForm)}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={actionLoading === editing.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white disabled:opacity-50"
              >
                {actionLoading === editing.id ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditForm(EMPTY_FORM);
                }}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border-default)] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">Name</th>
              <th className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">Visibility</th>
              <th className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">Status</th>
              <th className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">Order</th>
              <th className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-border-default)]">
                <td className="px-4 py-3">
                  <p className="text-[var(--color-text-primary)] font-medium">{row.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">/{row.slug}</p>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{row.visibility}</td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  {row.is_active ? "active" : "inactive"}
                  {row.featured ? " · featured" : ""}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{row.sort_order ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(row)}
                      className="px-3 py-1 text-sm rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={actionLoading === row.id}
                      className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

