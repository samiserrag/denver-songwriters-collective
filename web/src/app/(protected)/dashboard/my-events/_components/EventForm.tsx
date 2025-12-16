"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui/ImageUpload";
import VenueSelector from "@/components/ui/VenueSelector";
import {
  EVENT_TYPE_CONFIG,
  DAYS_OF_WEEK,
  FREQUENCIES,
  type EventType
} from "@/types/events";

interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

interface EventFormProps {
  mode: "create" | "edit";
  venues: Venue[];
  event?: {
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    capacity: number | null;
    venue_id: string | null;
    day_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    recurrence_rule: string | null;
    host_notes: string | null;
    cover_image_url: string | null;
  };
}

export default function EventForm({ mode, venues: initialVenues, event }: EventFormProps) {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(event?.cover_image_url || null);

  const [formData, setFormData] = useState({
    title: event?.title || "",
    description: event?.description || "",
    event_type: (event?.event_type || "song_circle") as EventType,
    capacity: event?.capacity?.toString() || "",
    venue_id: event?.venue_id || "",
    day_of_week: event?.day_of_week || "",
    start_time: event?.start_time || "",
    end_time: event?.end_time || "",
    recurrence_rule: event?.recurrence_rule || "weekly",
    host_notes: event?.host_notes || ""
  });

  const selectedTypeConfig = EVENT_TYPE_CONFIG[formData.event_type];

  const handleImageUpload = async (file: File): Promise<string | null> => {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("event-images")
      .getPublicUrl(fileName);

    setCoverImageUrl(publicUrl);
    return publicUrl;
  };

  const handleImageRemove = async () => {
    setCoverImageUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const url = mode === "create"
        ? "/api/my-events"
        : `/api/my-events/${event?.id}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const body = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        cover_image_url: coverImageUrl
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save event");
      }

      if (mode === "create") {
        router.push(`/dashboard/my-events/${data.id}`);
      } else {
        setSuccess("Changes saved successfully!");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Cover Image
          <span className="text-[var(--color-text-secondary)] font-normal ml-1">(optional)</span>
        </label>
        <div className="max-w-xs">
          <ImageUpload
            currentImageUrl={coverImageUrl}
            onUpload={handleImageUpload}
            onRemove={handleImageRemove}
            aspectRatio={16 / 9}
            shape="square"
            placeholderText="Add Cover Photo"
            maxSizeMB={5}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Recommended: 1200x675px or larger, 16:9 aspect ratio
        </p>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Event Type *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                updateField("event_type", type);
                if (config.defaultCapacity && !formData.capacity) {
                  updateField("capacity", config.defaultCapacity.toString());
                }
              }}
              className={`p-3 rounded-lg border text-left transition-colors ${
                formData.event_type === type
                  ? "bg-[var(--color-accent-primary)]/10 border-[var(--color-border-accent)] text-[var(--color-text-primary)]"
                  : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)]"
              }`}
            >
              <div className="text-xl mb-1">{config.icon}</div>
              <div className="text-sm font-medium">{config.label}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{selectedTypeConfig.description}</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Event Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="e.g., Wednesday Night Song Circle"
          required
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="What should attendees expect? Any requirements?"
          rows={4}
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none resize-none"
        />
      </div>

      {/* Venue */}
      <VenueSelector
        venues={venues}
        selectedVenueId={formData.venue_id}
        onVenueChange={(venueId) => updateField("venue_id", venueId)}
        onVenueCreated={(newVenue) => setVenues(prev => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)))}
        required
        disabled={loading}
      />

      {/* Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Day of Week
          </label>
          <select
            value={formData.day_of_week}
            onChange={(e) => updateField("day_of_week", e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          >
            <option value="">Select day</option>
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Start Time *
          </label>
          <input
            type="text"
            value={formData.start_time}
            onChange={(e) => updateField("start_time", e.target.value)}
            placeholder="7:00 PM"
            pattern="^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM|am|pm)$"
            title="Enter time in format: 7:00 PM"
            required
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Format: 7:00 PM</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            End Time
          </label>
          <input
            type="text"
            value={formData.end_time}
            onChange={(e) => updateField("end_time", e.target.value)}
            placeholder="9:00 PM"
            pattern="^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM|am|pm)$"
            title="Enter time in format: 9:00 PM"
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Format: 9:00 PM</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Frequency
          </label>
          <select
            value={formData.recurrence_rule}
            onChange={(e) => updateField("recurrence_rule", e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          >
            {FREQUENCIES.map(freq => (
              <option key={freq.value} value={freq.value}>{freq.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Capacity
            <span className="text-[var(--color-text-secondary)] font-normal ml-1">(leave empty for unlimited)</span>
          </label>
          <input
            type="number"
            value={formData.capacity}
            onChange={(e) => updateField("capacity", e.target.value)}
            placeholder="e.g., 12"
            min="1"
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          />
        </div>
      </div>

      {/* Host Notes (private) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Host Notes
          <span className="text-[var(--color-text-secondary)] font-normal ml-1">(private, only visible to hosts)</span>
        </label>
        <textarea
          value={formData.host_notes}
          onChange={(e) => updateField("host_notes", e.target.value)}
          placeholder="Internal notes, setup reminders, etc."
          rows={3}
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create Event" : "Save Changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => router.push("/dashboard/my-events")}
            className="px-6 py-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
