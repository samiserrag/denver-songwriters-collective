"use client";

/**
 * VenueEditForm - ABC9
 *
 * Client component for editing venue information.
 * Uses the PATCH /api/venues/[id] endpoint.
 * Includes cover image upload via ImageUpload component.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MANAGER_EDITABLE_VENUE_FIELDS } from "@/lib/venue/managerAuth";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { MediaEmbedsEditor } from "@/components/media/MediaEmbedsEditor";
import { createClient } from "@/lib/supabase/client";

interface VenueData {
  id: string;
  name: string;
  slug: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  google_maps_url: string | null;
  map_link: string | null;
  contact_link: string | null;
  neighborhood: string | null;
  accessibility_notes: string | null;
  parking_notes: string | null;
  cover_image_url: string | null;
}

interface VenueEditFormProps {
  venue: VenueData;
  initialMediaEmbedUrls?: string[];
}

export default function VenueEditForm({ venue, initialMediaEmbedUrls = [] }: VenueEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(venue.cover_image_url);
  const [imageError, setImageError] = useState<string | null>(null);
  const [mediaEmbedUrls, setMediaEmbedUrls] = useState<string[]>(initialMediaEmbedUrls);

  // Form state
  const [formData, setFormData] = useState({
    name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    zip: venue.zip || "",
    phone: venue.phone || "",
    website_url: venue.website_url || "",
    google_maps_url: venue.google_maps_url || "",
    map_link: venue.map_link || "",
    contact_link: venue.contact_link || "",
    neighborhood: venue.neighborhood || "",
    accessibility_notes: venue.accessibility_notes || "",
    parking_notes: venue.parking_notes || "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  // Handle cover image upload to Supabase storage
  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    setImageError(null);
    const supabase = createClient();

    // Generate unique filename: venue-covers/{venue_id}/{uuid}.{ext}
    const fileExt = file.name.split('.').pop() || 'jpg';
    const uuid = crypto.randomUUID();
    const fileName = `venue-covers/${venue.id}/${uuid}.${fileExt}`;

    // Upload to gallery-images bucket
    const { error: uploadError } = await supabase.storage
      .from('gallery-images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('[VenueEditForm] Upload error:', uploadError);
      setImageError(`Upload failed: ${uploadError.message}`);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('gallery-images')
      .getPublicUrl(fileName);

    // Update venue record via PATCH
    const response = await fetch(`/api/venues/${venue.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_image_url: publicUrl }),
    });

    if (!response.ok) {
      const data = await response.json();
      setImageError(data.error || 'Failed to update venue');
      return null;
    }

    setCoverImageUrl(publicUrl);
    router.refresh();
    return publicUrl;
  }, [venue.id, router]);

  // Handle cover image removal
  const handleImageRemove = useCallback(async (): Promise<void> => {
    setImageError(null);

    // Update venue record via PATCH (set cover_image_url to null)
    const response = await fetch(`/api/venues/${venue.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_image_url: null }),
    });

    if (!response.ok) {
      const data = await response.json();
      setImageError(data.error || 'Failed to remove image');
      return;
    }

    setCoverImageUrl(null);
    router.refresh();
  }, [venue.id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation for required fields
    const validationErrors: string[] = [];
    if (!formData.name.trim()) validationErrors.push("Venue name is required");
    if (!formData.address.trim()) validationErrors.push("Street address is required");
    if (!formData.city.trim()) validationErrors.push("City is required");
    if (!formData.state.trim()) validationErrors.push("State is required");

    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Only send changed fields
      const changes: Record<string, string | null> = {};
      for (const key of MANAGER_EDITABLE_VENUE_FIELDS) {
        const currentValue = formData[key as keyof typeof formData];
        const originalValue = venue[key as keyof VenueData];
        const normalizedCurrent = currentValue === "" ? null : currentValue;
        const normalizedOriginal = originalValue === null ? null : originalValue;

        if (normalizedCurrent !== normalizedOriginal) {
          changes[key] = normalizedCurrent;
        }
      }

      // Check if media embeds changed
      const mediaChanged =
        JSON.stringify(mediaEmbedUrls) !== JSON.stringify(initialMediaEmbedUrls);

      if (Object.keys(changes).length === 0 && !mediaChanged) {
        setError("No changes to save");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/venues/${venue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...changes,
          ...(mediaChanged ? { media_embed_urls: mediaEmbedUrls } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update venue");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          Venue updated successfully!
        </div>
      )}

      {/* Cover Image Section */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Cover Image
        </legend>
        <p className="text-sm text-[var(--color-text-secondary)] -mt-2 mb-4">
          Upload a cover image for your venue. This will appear on your venue page and cards.
        </p>

        <div className="max-w-xs">
          <ImageUpload
            key={coverImageUrl || "no-image"}
            currentImageUrl={coverImageUrl}
            onUpload={handleImageUpload}
            onRemove={handleImageRemove}
            aspectRatio={16 / 9}
            maxSizeMB={5}
            shape="square"
            placeholderText="Upload Cover Image"
          />
        </div>

        {imageError && (
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400 text-sm">
            {imageError}
          </div>
        )}
      </fieldset>

      {/* Media Embeds Section */}
      <fieldset className="space-y-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
          Media Links <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
        </label>
        <MediaEmbedsEditor value={mediaEmbedUrls} onChange={setMediaEmbedUrls} />
      </fieldset>

      {/* Basic Info Section */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Basic Information
        </legend>

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Venue Name <span className="text-red-400">*</span>
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
            htmlFor="address"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Street Address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              City <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              State <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              maxLength={2}
              placeholder="CO"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="zip"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              ZIP Code
            </label>
            <input
              type="text"
              id="zip"
              name="zip"
              value={formData.zip}
              onChange={handleChange}
              maxLength={10}
              placeholder="80202"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="neighborhood"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
            >
              Neighborhood
            </label>
            <input
              type="text"
              id="neighborhood"
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleChange}
              placeholder="RiNo, LoHi, etc."
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
      </fieldset>

      {/* Contact Info Section */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Contact Information
        </legend>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(303) 555-1234"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="website_url"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Website URL
          </label>
          <input
            type="url"
            id="website_url"
            name="website_url"
            value={formData.website_url}
            onChange={handleChange}
            placeholder="https://example.com"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="contact_link"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Contact Link
          </label>
          <input
            type="url"
            id="contact_link"
            name="contact_link"
            value={formData.contact_link}
            onChange={handleChange}
            placeholder="https://example.com/contact"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Link to venue&apos;s booking or contact page
          </p>
        </div>
      </fieldset>

      {/* Map Links Section */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Map & Directions
        </legend>

        <div>
          <label
            htmlFor="google_maps_url"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Google Maps URL
          </label>
          <input
            type="url"
            id="google_maps_url"
            name="google_maps_url"
            value={formData.google_maps_url}
            onChange={handleChange}
            placeholder="https://maps.google.com/..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Copy from Google Maps &quot;Share&quot; → &quot;Copy link&quot;
          </p>
        </div>

        <div>
          <label
            htmlFor="map_link"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Alternate Map Link
          </label>
          <input
            type="url"
            id="map_link"
            name="map_link"
            value={formData.map_link}
            onChange={handleChange}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Optional: Apple Maps, Bing Maps, or custom map
          </p>
        </div>
      </fieldset>

      {/* Visitor Info Section */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Visitor Information
        </legend>

        <div>
          <label
            htmlFor="parking_notes"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Parking Notes
          </label>
          <textarea
            id="parking_notes"
            name="parking_notes"
            value={formData.parking_notes}
            onChange={handleChange}
            rows={3}
            placeholder="Street parking available, lot in back, etc."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label
            htmlFor="accessibility_notes"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            Accessibility Notes
          </label>
          <textarea
            id="accessibility_notes"
            name="accessibility_notes"
            value={formData.accessibility_notes}
            onChange={handleChange}
            rows={3}
            placeholder="Wheelchair accessible entrance, ramp at side door, etc."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
      </fieldset>

      {/* Submit Button */}
      <div className="pt-6 border-t border-[var(--color-border-default)] space-y-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
        <p className="text-xs text-[var(--color-text-tertiary)] text-center">
          <span className="text-red-400">*</span> Required fields
        </p>
      </div>
    </form>
  );
}
