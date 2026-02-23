"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import VenueSelector from "@/components/admin/VenueSelector";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import { EVENT_TYPE_CONFIG } from "@/types/events";

interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

interface EventCreateFormProps {
  venues: Venue[];
  userId: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORIES = ["music", "comedy", "poetry", "variety", "other"];
const STATUSES = ["active", "inactive", "cancelled", "duplicate"];
const HIDDEN_EVENT_TYPE_OPTIONS = new Set(["kindred_group", "song_circle", "meetup", "showcase"]);
const FORM_EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_CONFIG).filter(
  ([type]) => !HIDDEN_EVENT_TYPE_OPTIONS.has(type)
);

// Generate time options from 6:00 AM to 11:30 PM in 30-minute increments
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let hour = 6; hour <= 23; hour++) {
  for (const minute of [0, 30]) {
    if (hour === 23 && minute === 30) continue; // Skip 11:30 PM
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";
    const label = `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
    const value = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
    TIME_OPTIONS.push({ value, label });
  }
}

export default function EventCreateForm({ venues: initialVenues, userId }: EventCreateFormProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    venue_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    signup_time: "",
    recurrence_rule: "",
    notes: "",
    description: "",
    categories: [] as string[],
    status: "active",
    event_type: ["open_mic"] as string[],
  });

  // Handler for multi-select event type buttons
  const handleEventTypeToggle = (type: string) => {
    setForm(prev => {
      const current = prev.event_type;
      if (current.includes(type)) {
        if (current.length === 1) return prev; // min 1
        return { ...prev, event_type: current.filter(t => t !== type) };
      }
      return { ...prev, event_type: [...current, type] };
    });
  };

  // Handler for multi-select category toggles
  const handleCategoryToggle = (cat: string) => {
    setForm(prev => {
      const current = prev.categories || [];
      if (current.includes(cat)) {
        return { ...prev, categories: current.filter(c => c !== cat) };
      } else {
        return { ...prev, categories: [...current, cat] };
      }
    });
  };

  // Handle image selection (store file for upload after event creation)
  const handleImageSelect = useCallback(async (file: File): Promise<string | null> => {
    // Store the file for later upload
    setPendingImageFile(file);
    // Create a preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    return previewUrl;
  }, []);

  // Remove pending image
  const handleImageRemove = useCallback(async () => {
    setPendingImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  }, [imagePreviewUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required");
      setSaving(false);
      return;
    }

    // Create the event first
    const { data: newEvent, error: insertError } = await supabase
      .from("events")
      .insert({
        title: form.title,
        venue_id: form.venue_id || null,
        day_of_week: form.day_of_week || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        signup_time: form.signup_time || null,
        recurrence_rule: form.recurrence_rule || null,
        notes: form.notes || null,
        description: form.description || null,
        categories: form.categories.length > 0 ? form.categories : null,
        status: form.status,
        event_type: form.event_type,
      })
      .select("id")
      .single();

    if (insertError || !newEvent) {
      setError(insertError?.message || "Failed to create event");
      setSaving(false);
      return;
    }

    // If there's a pending image, upload it and set as cover
    if (pendingImageFile) {
      try {
        const fileExt = pendingImageFile.name.split(".").pop() || "jpg";
        const fileName = `${newEvent.id}/${crypto.randomUUID()}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("event-images")
          .upload(fileName, pendingImageFile, { upsert: false });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Event created but image upload failed");
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from("event-images")
            .getPublicUrl(fileName);

          // Insert record into event_images table
          await supabase
            .from("event_images")
            .insert({
              event_id: newEvent.id,
              image_url: publicUrl,
              storage_path: fileName,
              uploaded_by: userId,
            });

          // Set as cover image (first image is always cover)
          await supabase
            .from("events")
            .update({ cover_image_url: publicUrl })
            .eq("id", newEvent.id);

          toast.success("Image uploaded and set as cover!");
        }
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error("Event created but image upload failed");
      }
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => router.push("/dashboard/admin/events"), 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded text-red-800 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/30 rounded text-green-800 dark:text-green-400 text-sm">
          Event created! Redirecting...
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Title *</label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
      </div>

      <VenueSelector
        venues={venues}
        selectedVenueId={form.venue_id}
        onVenueChange={(venueId) => setForm(prev => ({ ...prev, venue_id: venueId }))}
        onVenueCreated={(newVenue) => setVenues(prev => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)))}
        required
        disabled={saving}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Day of Week</label>
          <select
            name="day_of_week"
            value={form.day_of_week}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Select day...</option>
            {DAYS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Event Type <span className="font-normal">(select all that apply)</span></label>
          <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
            Choose one or more event types. Multiple tags improve clarity and discovery.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FORM_EVENT_TYPE_OPTIONS.map(([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => handleEventTypeToggle(type)}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  form.event_type.includes(type)
                    ? "bg-[var(--color-accent-primary)]/10 border-[var(--color-border-accent)] text-[var(--color-text-primary)]"
                    : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)]"
                }`}
              >
                <span className="text-lg mr-1">{config.icon}</span>
                <span className="text-sm font-medium">{config.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Start Time</label>
          <select
            name="start_time"
            value={form.start_time}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Select time...</option>
            {TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">End Time</label>
          <select
            name="end_time"
            value={form.end_time}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Select time...</option>
            {TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Signup Time</label>
          <select
            name="signup_time"
            value={form.signup_time}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
          >
            <option value="">Select time...</option>
            {TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Recurrence Rule</label>
        <input
          type="text"
          name="recurrence_rule"
          value={form.recurrence_rule}
          onChange={handleChange}
          placeholder="Every Monday, 1st and 3rd Tuesday, etc."
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
      </div>

      {/* Categories (multi-select toggles) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Categories
          <span className="font-normal ml-1">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryToggle(cat)}
              aria-pressed={form.categories.includes(cat)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                form.categories.includes(cat)
                  ? "bg-[var(--color-accent-primary)]/20 border-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                  : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-primary)]/50"
              }`}
            >
              <span className="capitalize">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Status</label>
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
        />
      </div>

      {/* Cover Image Upload */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Cover Image</label>
        <div className="max-w-xs">
          <ImageUpload
            currentImageUrl={imagePreviewUrl}
            onUpload={handleImageSelect}
            onRemove={handleImageRemove}
            aspectRatio={4 / 3}
            shape="square"
            placeholderText="Add Cover Photo"
            maxSizeMB={5}
          />
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          This image will be displayed on the happening card and detail page.
        </p>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 rounded text-[var(--color-text-primary)] font-medium"
        >
          {saving ? "Creating..." : "Create Event"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/admin/events")}
          className="px-6 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
