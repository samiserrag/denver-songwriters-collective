"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  EVENT_TYPE_CONFIG,
  DAYS_OF_WEEK,
  FREQUENCIES,
  type EventType
} from "@/types/events";

interface EventFormProps {
  mode: "create" | "edit";
  event?: {
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    capacity: number | null;
    venue_name: string | null;
    venue_address: string | null;
    day_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    recurrence_rule: string | null;
    host_notes: string | null;
    cover_image_url: string | null;
  };
}

export default function EventForm({ mode, event }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(event?.cover_image_url || null);

  const [formData, setFormData] = useState({
    title: event?.title || "",
    description: event?.description || "",
    event_type: (event?.event_type || "song_circle") as EventType,
    capacity: event?.capacity?.toString() || "",
    venue_name: event?.venue_name || "",
    address: event?.venue_address || "",
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
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
          Cover Image
          <span className="text-[var(--color-warm-gray)] font-normal ml-1">(optional)</span>
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
        <p className="mt-2 text-xs text-[var(--color-warm-gray)]">
          Recommended: 1200x675px or larger, 16:9 aspect ratio
        </p>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
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
                  ? "bg-[var(--color-gold)]/10 border-[var(--color-gold)] text-[var(--color-warm-white)]"
                  : "bg-[var(--color-indigo-950)]/50 border-white/10 text-[var(--color-warm-gray-light)] hover:border-white/20"
              }`}
            >
              <div className="text-xl mb-1">{config.icon}</div>
              <div className="text-sm font-medium">{config.label}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-warm-gray)]">{selectedTypeConfig.description}</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
          Event Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="e.g., Wednesday Night Song Circle"
          required
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="What should attendees expect? Any requirements?"
          rows={4}
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none resize-none"
        />
      </div>

      {/* Venue */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
          Venue Name *
        </label>
        <input
          type="text"
          value={formData.venue_name}
          onChange={(e) => updateField("venue_name", e.target.value)}
          placeholder="e.g., Mercury Cafe"
          required
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
          Address
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => updateField("address", e.target.value)}
          placeholder="Full street address (e.g., 2199 California St, Denver, CO 80205)"
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--color-warm-gray)]">
          Include city and zip code for Google Maps directions
        </p>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
            Day of Week
          </label>
          <select
            value={formData.day_of_week}
            onChange={(e) => updateField("day_of_week", e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] focus:border-[var(--color-gold)] focus:outline-none"
          >
            <option value="">Select day</option>
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
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
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none"
          />
          <p className="text-xs text-[var(--color-warm-gray)] mt-1">Format: 7:00 PM</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
            End Time
          </label>
          <input
            type="text"
            value={formData.end_time}
            onChange={(e) => updateField("end_time", e.target.value)}
            placeholder="9:00 PM"
            pattern="^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM|am|pm)$"
            title="Enter time in format: 9:00 PM"
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none"
          />
          <p className="text-xs text-[var(--color-warm-gray)] mt-1">Format: 9:00 PM</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
            Frequency
          </label>
          <select
            value={formData.recurrence_rule}
            onChange={(e) => updateField("recurrence_rule", e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] focus:border-[var(--color-gold)] focus:outline-none"
          >
            {FREQUENCIES.map(freq => (
              <option key={freq.value} value={freq.value}>{freq.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
            Capacity
            <span className="text-[var(--color-warm-gray)] font-normal ml-1">(leave empty for unlimited)</span>
          </label>
          <input
            type="number"
            value={formData.capacity}
            onChange={(e) => updateField("capacity", e.target.value)}
            placeholder="e.g., 12"
            min="1"
            className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none"
          />
        </div>
      </div>

      {/* Host Notes (private) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-gray-light)] mb-2">
          Host Notes
          <span className="text-[var(--color-warm-gray)] font-normal ml-1">(private, only visible to hosts)</span>
        </label>
        <textarea
          value={formData.host_notes}
          onChange={(e) => updateField("host_notes", e.target.value)}
          placeholder="Internal notes, setup reminders, etc."
          rows={3}
          className="w-full px-4 py-3 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:border-[var(--color-gold)] focus:outline-none resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create Event" : "Save Changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => router.push("/dashboard/my-events")}
            className="px-6 py-3 bg-[var(--color-indigo-950)]/50 hover:bg-[var(--color-indigo-950)]/70 text-[var(--color-warm-white)] rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
