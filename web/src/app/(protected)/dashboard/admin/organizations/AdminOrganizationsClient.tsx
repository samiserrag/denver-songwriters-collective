"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrganizationRecord, OrganizationVisibility } from "@/lib/organizations";
import {
  parseTagsInput,
  stringifyTags,
  toSlug,
} from "@/lib/organizations";
import { OrganizationPhotosManager } from "@/components/organizations/OrganizationPhotosManager";

type BlogOption = {
  id: string;
  slug: string | null;
  title: string | null;
  is_published: boolean;
  published_at: string | null;
};

type GalleryOption = {
  id: string;
  slug: string | null;
  name: string | null;
  is_published: boolean;
  is_hidden: boolean;
};

type EventOption = {
  id: string;
  title: string;
  slug: string | null;
  series_id: string | null;
  event_date: string | null;
  is_published: boolean;
  visibility: string;
};

type ContentOptions = {
  blogs: BlogOption[];
  galleries: GalleryOption[];
  events: EventOption[];
};

type MemberOption = {
  id: string;
  full_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  role: string | null;
  is_public: boolean;
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
  is_fan: boolean | null;
};

type OrganizationMemberTagInput = {
  profile_id: string;
  sort_order: number;
  tag_reason: string;
};

type OrganizationContentLinkInput = {
  link_type: "blog_post" | "gallery_album" | "event_series" | "event";
  target_id: string;
  sort_order: number;
  label_override: string;
};

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
  gallery_image_urls: string[];
  fun_note: string;
  sort_order: number;
  member_tags: OrganizationMemberTagInput[];
  content_links: OrganizationContentLinkInput[];
};

function createEmptyForm(): OrganizationFormState {
  return {
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
    gallery_image_urls: [],
    fun_note: "",
    sort_order: 0,
    member_tags: [],
    content_links: [],
  };
}

function fromRecord(record: OrganizationRecord): OrganizationFormState {
  const memberTags = [...(record.member_tags || [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((tag) => ({
      profile_id: tag.profile_id,
      sort_order: tag.sort_order,
      tag_reason: tag.tag_reason || "",
    }));
  const contentLinks = [...(record.content_links || [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => ({
      link_type: link.link_type,
      target_id: link.target_id,
      sort_order: link.sort_order,
      label_override: link.label_override || "",
    }));

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
    gallery_image_urls: record.gallery_image_urls ?? [],
    fun_note: record.fun_note ?? "",
    sort_order: record.sort_order ?? 0,
    member_tags: memberTags,
    content_links: contentLinks,
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
    gallery_image_urls: form.gallery_image_urls,
    fun_note: form.fun_note.trim(),
    sort_order: Number(form.sort_order) || 0,
    member_tags: form.member_tags
      .map((tag) => ({
        profile_id: tag.profile_id,
        sort_order: Number(tag.sort_order) || 0,
        tag_reason: tag.tag_reason.trim(),
      }))
      .filter((tag) => tag.profile_id),
    content_links: form.content_links
      .map((link) => ({
        link_type: link.link_type,
        target_id: link.target_id,
        sort_order: Number(link.sort_order) || 0,
        label_override: link.label_override.trim(),
      }))
      .filter((link) => link.target_id),
  };
}

function getMemberTypeLabel(member: MemberOption): string {
  if (member.is_studio || member.role === "studio") return "Studio";
  if (member.is_songwriter && member.is_host) return "Songwriter + Host";
  if (member.is_songwriter || member.role === "performer") return "Songwriter";
  if (member.is_host || member.role === "host") return "Host";
  if (member.is_fan || member.role === "fan") return "Fan";
  return "Member";
}

function getBlogOptionLabel(blog: BlogOption): string {
  const title = blog.title || "Untitled blog post";
  const slug = blog.slug ? `/${blog.slug}` : blog.id.slice(0, 8);
  return `${title} (${slug})${blog.is_published ? "" : " • draft"}`;
}

function getGalleryOptionLabel(gallery: GalleryOption): string {
  const name = gallery.name || "Untitled album";
  const slug = gallery.slug ? `/${gallery.slug}` : gallery.id.slice(0, 8);
  const status = gallery.is_hidden ? "hidden" : gallery.is_published ? "published" : "draft";
  return `${name} (${slug}) • ${status}`;
}

function getEventOptionLabel(event: EventOption): string {
  const dateLabel = event.event_date ? ` • ${event.event_date}` : "";
  const statusLabel = event.is_published && event.visibility === "public" ? "" : " • not public";
  return `${event.title}${dateLabel}${statusLabel}`;
}

export default function AdminOrganizationsClient({ userId }: { userId: string }) {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOptions>({
    blogs: [],
    galleries: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<OrganizationFormState>(createEmptyForm());
  const [editing, setEditing] = useState<OrganizationRecord | null>(null);
  const [editForm, setEditForm] = useState<OrganizationFormState>(createEmptyForm());
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

    if (Array.isArray(data)) {
      setOrganizations(data as OrganizationRecord[]);
      setMemberOptions([]);
      setContentOptions({ blogs: [], galleries: [], events: [] });
      return;
    }

    setOrganizations((data.organizations || []) as OrganizationRecord[]);
    setMemberOptions((data.memberOptions || []) as MemberOption[]);
    setContentOptions({
      blogs: (data.contentOptions?.blogs || []) as BlogOption[],
      galleries: (data.contentOptions?.galleries || []) as GalleryOption[],
      events: (data.contentOptions?.events || []) as EventOption[],
    });
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
      setCreateForm(createEmptyForm());
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
      setEditForm(createEmptyForm());
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

  function renderMemberTags(
    form: OrganizationFormState,
    setForm: (next: OrganizationFormState) => void
  ) {
    const selectedIds = new Set(form.member_tags.map((tag) => tag.profile_id));
    const availableMembers = memberOptions.filter((member) => !selectedIds.has(member.id));

    return (
      <div className="md:col-span-2 space-y-3 rounded-lg border border-[var(--color-border-default)] p-4 bg-[var(--color-bg-tertiary)]/50">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Tagged Members</h4>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Add linked members to show as pill links on this organization card.
          </p>
        </div>

        <select
          value=""
          onChange={(e) => {
            const profileId = e.target.value;
            if (!profileId) return;
            setForm({
              ...form,
              member_tags: [
                ...form.member_tags,
                {
                  profile_id: profileId,
                  sort_order: (form.member_tags.length + 1) * 10,
                  tag_reason: "",
                },
              ],
            });
          }}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        >
          <option value="">Add tagged member...</option>
          {availableMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {(member.full_name || "Unnamed member") +
                " - " +
                getMemberTypeLabel(member) +
                (member.is_public ? "" : " (private profile)")}
            </option>
          ))}
        </select>

        {form.member_tags.length > 0 ? (
          <div className="space-y-2">
            {form.member_tags.map((tag, index) => {
              const member = memberOptions.find((option) => option.id === tag.profile_id) || null;
              return (
                <div
                  key={tag.profile_id}
                  className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm text-[var(--color-text-primary)] font-medium">
                      {member?.full_name || "Unknown member"}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          member_tags: form.member_tags.filter((_, idx) => idx !== index),
                        })
                      }
                      className="text-xs text-red-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={tag.sort_order}
                      onChange={(e) => {
                        const sortOrder = parseInt(e.target.value || "0", 10) || 0;
                        setForm({
                          ...form,
                          member_tags: form.member_tags.map((item, idx) =>
                            idx === index ? { ...item, sort_order: sortOrder } : item
                          ),
                        });
                      }}
                      placeholder="Sort order"
                      className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
                    />
                    <input
                      type="text"
                      value={tag.tag_reason}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          member_tags: form.member_tags.map((item, idx) =>
                            idx === index ? { ...item, tag_reason: e.target.value } : item
                          ),
                        });
                      }}
                      placeholder="Optional short reason"
                      className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-tertiary)]">No tagged members yet.</p>
        )}
      </div>
    );
  }

  function renderContentLinks(
    form: OrganizationFormState,
    setForm: (next: OrganizationFormState) => void
  ) {
    const selectedKeys = new Set(
      form.content_links.map((link) => `${link.link_type}:${link.target_id}`)
    );

    const availableBlogs = contentOptions.blogs.filter(
      (blog) => !selectedKeys.has(`blog_post:${blog.id}`)
    );
    const availableGalleries = contentOptions.galleries.filter(
      (gallery) => !selectedKeys.has(`gallery_album:${gallery.id}`)
    );
    const availableEvents = contentOptions.events.filter(
      (event) => !selectedKeys.has(`event:${event.id}`)
    );

    const findLinkLabel = (link: OrganizationContentLinkInput) => {
      if (link.link_type === "blog_post") {
        const blog = contentOptions.blogs.find((item) => item.id === link.target_id);
        return blog ? getBlogOptionLabel(blog) : `Blog post ${link.target_id.slice(0, 8)}`;
      }
      if (link.link_type === "gallery_album") {
        const gallery = contentOptions.galleries.find((item) => item.id === link.target_id);
        return gallery ? getGalleryOptionLabel(gallery) : `Gallery album ${link.target_id.slice(0, 8)}`;
      }
      if (link.link_type === "event") {
        const event = contentOptions.events.find((item) => item.id === link.target_id);
        return event ? getEventOptionLabel(event) : `Event ${link.target_id.slice(0, 8)}`;
      }
      const seriesEvent = contentOptions.events.find((item) => item.series_id === link.target_id);
      return seriesEvent ? getEventOptionLabel(seriesEvent) : `Series ${link.target_id.slice(0, 8)}`;
    };

    return (
      <div className="md:col-span-2 space-y-3 rounded-lg border border-[var(--color-border-default)] p-4 bg-[var(--color-bg-tertiary)]/50">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Related Content Links</h4>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Connect this organization to blog posts, gallery albums, and hosted happenings series.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value=""
            onChange={(e) => {
              const targetId = e.target.value;
              if (!targetId) return;
              setForm({
                ...form,
                content_links: [
                  ...form.content_links,
                  {
                    link_type: "blog_post",
                    target_id: targetId,
                    sort_order: (form.content_links.length + 1) * 10,
                    label_override: "",
                  },
                ],
              });
            }}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Add blog post...</option>
            {availableBlogs.map((blog) => (
              <option key={blog.id} value={blog.id}>
                {getBlogOptionLabel(blog)}
              </option>
            ))}
          </select>

          <select
            value=""
            onChange={(e) => {
              const targetId = e.target.value;
              if (!targetId) return;
              setForm({
                ...form,
                content_links: [
                  ...form.content_links,
                  {
                    link_type: "gallery_album",
                    target_id: targetId,
                    sort_order: (form.content_links.length + 1) * 10,
                    label_override: "",
                  },
                ],
              });
            }}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Add gallery album...</option>
            {availableGalleries.map((gallery) => (
              <option key={gallery.id} value={gallery.id}>
                {getGalleryOptionLabel(gallery)}
              </option>
            ))}
          </select>

          <select
            value=""
            onChange={(e) => {
              const targetId = e.target.value;
              if (!targetId) return;
              setForm({
                ...form,
                content_links: [
                  ...form.content_links,
                  {
                    link_type: "event",
                    target_id: targetId,
                    sort_order: (form.content_links.length + 1) * 10,
                    label_override: "",
                  },
                ],
              });
            }}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Add event...</option>
            {availableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {getEventOptionLabel(event)}
              </option>
            ))}
          </select>
        </div>

        {form.content_links.length > 0 ? (
          <div className="space-y-2">
            {form.content_links.map((link, index) => (
              <div
                key={`${link.link_type}:${link.target_id}`}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm text-[var(--color-text-primary)] font-medium">
                    {findLinkLabel(link)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        content_links: form.content_links.filter((_, idx) => idx !== index),
                      })
                    }
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={link.sort_order}
                    onChange={(e) => {
                      const sortOrder = parseInt(e.target.value || "0", 10) || 0;
                      setForm({
                        ...form,
                        content_links: form.content_links.map((item, idx) =>
                          idx === index ? { ...item, sort_order: sortOrder } : item
                        ),
                      });
                    }}
                    placeholder="Sort order"
                    className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
                  />
                  <input
                    type="text"
                    value={link.label_override}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        content_links: form.content_links.map((item, idx) =>
                          idx === index ? { ...item, label_override: e.target.value } : item
                        ),
                      })
                    }
                    placeholder="Optional custom label"
                    className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-tertiary)]">No content links yet.</p>
        )}
      </div>
    );
  }

  function renderForm(
    form: OrganizationFormState,
    setForm: (next: OrganizationFormState) => void,
    organizationId?: string
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
        <OrganizationPhotosManager
          organizationId={organizationId}
          organizationName={form.name || "Organization"}
          editorUserId={userId}
          logoImageUrl={form.logo_image_url}
          coverImageUrl={form.cover_image_url}
          galleryImageUrls={form.gallery_image_urls}
          onChange={(next) =>
            setForm({
              ...form,
              logo_image_url: next.logoImageUrl,
              cover_image_url: next.coverImageUrl,
              gallery_image_urls: next.galleryImageUrls,
            })
          }
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

        {renderMemberTags(form, setForm)}
        {renderContentLinks(form, setForm)}
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
            {renderForm(editForm, setEditForm, editing.id)}
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
                  setEditForm(createEmptyForm());
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
                  {(row.member_tags?.length || 0) > 0 ? ` · ${row.member_tags?.length} tagged` : ""}
                  {(row.content_links?.length || 0) > 0 ? ` · ${row.content_links?.length} links` : ""}
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
