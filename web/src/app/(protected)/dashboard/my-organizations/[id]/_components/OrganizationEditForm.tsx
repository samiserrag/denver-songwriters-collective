"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseGalleryInput,
  parseTagsInput,
  stringifyGallery,
  stringifyTags,
} from "@/lib/organizations";

interface OrganizationData {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  city: string | null;
  organization_type: string | null;
  short_blurb: string;
  why_it_matters: string;
  tags: string[] | null;
  logo_image_url: string | null;
  cover_image_url: string | null;
  gallery_image_urls: string[] | null;
  fun_note: string | null;
  visibility: "private" | "unlisted" | "public";
}

interface Props {
  organization: OrganizationData;
}

export default function OrganizationEditForm({ organization }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: organization.name,
    website_url: organization.website_url,
    city: organization.city || "",
    organization_type: organization.organization_type || "",
    short_blurb: organization.short_blurb,
    why_it_matters: organization.why_it_matters,
    tags: stringifyTags(organization.tags),
    logo_image_url: organization.logo_image_url || "",
    cover_image_url: organization.cover_image_url || "",
    gallery_image_urls: stringifyGallery(organization.gallery_image_urls),
    fun_note: organization.fun_note || "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        name: formData.name.trim(),
        website_url: formData.website_url.trim(),
        city: formData.city.trim(),
        organization_type: formData.organization_type.trim(),
        short_blurb: formData.short_blurb.trim(),
        why_it_matters: formData.why_it_matters.trim(),
        tags: parseTagsInput(formData.tags),
        logo_image_url: formData.logo_image_url.trim(),
        cover_image_url: formData.cover_image_url.trim(),
        gallery_image_urls: parseGalleryInput(formData.gallery_image_urls),
        fun_note: formData.fun_note.trim(),
      };

      if (!payload.name || !payload.website_url || !payload.short_blurb || !payload.why_it_matters) {
        setError("Name, website URL, short blurb, and why it matters are required.");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/my-organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update organization");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          Organization profile updated successfully.
        </div>
      )}

      <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
        <p className="text-sm text-[var(--color-text-secondary)]">
          You can update profile content and images here. Publishing status, featured status, and sort order are managed by admins.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Basic Information
        </legend>

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Organization Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="website_url"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Website URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            id="website_url"
            name="website_url"
            value={formData.website_url}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              City
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="organization_type"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              Organization Type
            </label>
            <input
              type="text"
              id="organization_type"
              name="organization_type"
              value={formData.organization_type}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Directory Copy
        </legend>

        <div>
          <label
            htmlFor="short_blurb"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Short Blurb <span className="text-red-400">*</span>
          </label>
          <textarea
            id="short_blurb"
            name="short_blurb"
            value={formData.short_blurb}
            onChange={handleChange}
            rows={3}
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-y"
          />
        </div>

        <div>
          <label
            htmlFor="why_it_matters"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Why It Matters <span className="text-red-400">*</span>
          </label>
          <textarea
            id="why_it_matters"
            name="why_it_matters"
            value={formData.why_it_matters}
            onChange={handleChange}
            rows={4}
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-y"
          />
        </div>

        <div>
          <label
            htmlFor="fun_note"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Fun Note
          </label>
          <textarea
            id="fun_note"
            name="fun_note"
            value={formData.fun_note}
            onChange={handleChange}
            rows={2}
            placeholder="Optional short line with personality."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-y"
          />
        </div>

        <div>
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Tags (comma-separated)
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="Open Mic, Songwriter Meetup, Community Events"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Images
        </legend>

        <div>
          <label
            htmlFor="logo_image_url"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Logo Image URL
          </label>
          <input
            type="url"
            id="logo_image_url"
            name="logo_image_url"
            value={formData.logo_image_url}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="cover_image_url"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Cover Image URL
          </label>
          <input
            type="url"
            id="cover_image_url"
            name="cover_image_url"
            value={formData.cover_image_url}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="gallery_image_urls"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Gallery Image URLs (one per line)
          </label>
          <textarea
            id="gallery_image_urls"
            name="gallery_image_urls"
            value={formData.gallery_image_urls}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-y"
          />
        </div>
      </fieldset>

      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-default)]">
        <button
          type="button"
          onClick={() => router.push("/dashboard/my-organizations")}
          className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
