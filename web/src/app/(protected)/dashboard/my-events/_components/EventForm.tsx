"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui/ImageUpload";
import VenueSelector from "@/components/ui/VenueSelector";
import SlotConfigSection, {
  type SlotConfig,
} from "./SlotConfigSection";
import {
  EVENT_TYPE_CONFIG,
  DAYS_OF_WEEK,
  type EventType
} from "@/types/events";
import { HappeningCard, type HappeningEvent } from "@/components/happenings/HappeningCard";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
// Phase 4.42e: Import Mountain Time date helpers for series date alignment
import {
  getNextDayOfWeekMT,
  weekdayNameFromDateMT,
} from "@/lib/events/formDateHelpers";

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

interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  google_maps_url?: string | null;
  map_link?: string | null;
  website_url?: string | null;
}

// Phase 4.0: Placeholder detection for venue fields
function isPlaceholderValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "tbd" || normalized === "unknown";
}

interface EventFormProps {
  mode: "create" | "edit";
  venues: Venue[];
  canCreateDSC?: boolean; // Whether user can create DSC-branded events
  /** Phase 4.45b: Whether user can create new venues (admin only) */
  canCreateVenue?: boolean;
  /** Whether user is admin (can verify events directly) */
  isAdmin?: boolean;
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
    is_published?: boolean;
    // Phase 3 fields
    timezone?: string | null;
    location_mode?: string | null;
    online_url?: string | null;
    is_free?: boolean | null;
    cost_label?: string | null;
    signup_mode?: string | null;
    signup_url?: string | null;
    signup_deadline?: string | null;
    age_policy?: string | null;
    is_dsc_event?: boolean;
    // External website URL
    external_url?: string | null;
    // Phase 4.0: Custom location fields
    custom_location_name?: string | null;
    custom_address?: string | null;
    custom_city?: string | null;
    custom_state?: string | null;
    custom_latitude?: number | null;
    custom_longitude?: number | null;
    location_notes?: string | null;
    // Verification fields
    last_verified_at?: string | null;
  };
}

export default function EventForm({ mode, venues: initialVenues, event, canCreateDSC = false, canCreateVenue = false, isAdmin = false }: EventFormProps) {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(event?.cover_image_url || null);


  // Publish confirmation state - only needed when transitioning from unpublished to published
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  // Phase 4.44c: Advanced section collapse state (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Verification state - for admin/host to confirm event is real and happening
  const [isVerified, setIsVerified] = useState(!!event?.last_verified_at);
  const wasVerified = !!event?.last_verified_at;

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
    host_notes: event?.host_notes || "",
    is_published: event?.is_published ?? false, // New events start as drafts
    // Recurring series fields (only for create mode)
    start_date: "",
    occurrence_count: "4", // Default to 4 events in series
    // Phase 3 scan-first fields
    timezone: event?.timezone || "America/Denver",
    location_mode: event?.location_mode || "venue",
    online_url: event?.online_url || "",
    is_free: event?.is_free ?? null,
    cost_label: event?.cost_label || "",
    signup_mode: event?.signup_mode || "",
    signup_url: event?.signup_url || "",
    signup_deadline: event?.signup_deadline || "",
    age_policy: event?.age_policy || "",
    is_dsc_event: event?.is_dsc_event ?? false,
    external_url: event?.external_url || "",
    // Phase 4.0: Custom location fields
    custom_location_name: event?.custom_location_name || "",
    custom_address: event?.custom_address || "",
    custom_city: event?.custom_city || "",
    custom_state: event?.custom_state || "CO",
    custom_latitude: event?.custom_latitude?.toString() || "",
    custom_longitude: event?.custom_longitude?.toString() || "",
    location_notes: event?.location_notes || "",
  });

  // Phase 4.0: Location selection mode - "venue" or "custom"
  // Determine initial mode based on existing event data
  const [locationSelectionMode, setLocationSelectionMode] = useState<"venue" | "custom">(
    event?.custom_location_name ? "custom" : "venue"
  );

  // Phase 4.47: Slot configuration state - always defaults to no performer slots
  // Performer slots are fully opt-in, no event type auto-enables them
  const [slotConfig, setSlotConfig] = useState<SlotConfig>({
    has_timeslots: false,
    total_slots: 10,
    slot_duration_minutes: 10,
    allow_guests: true,
  });

  const selectedTypeConfig = EVENT_TYPE_CONFIG[formData.event_type];

  // Calculate event duration in minutes (if both start and end times are set)
  const calculateEventDurationMinutes = (): number | null => {
    if (!formData.start_time || !formData.end_time) return null;
    const [startHour, startMin] = formData.start_time.split(":").map(Number);
    const [endHour, endMin] = formData.end_time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    // Handle overnight events (end time < start time)
    if (endMinutes < startMinutes) {
      return (24 * 60 - startMinutes) + endMinutes;
    }
    return endMinutes - startMinutes;
  };

  const eventDurationMinutes = calculateEventDurationMinutes();
  const totalSlotDuration = slotConfig.total_slots * slotConfig.slot_duration_minutes;
  const slotDurationExceedsEvent = eventDurationMinutes !== null &&
    slotConfig.has_timeslots &&
    totalSlotDuration > eventDurationMinutes;

  // ============ PREVIEW HELPERS ============

  // Get location name for preview
  const getPreviewLocation = (): string => {
    if (locationSelectionMode === "custom" && formData.custom_location_name) {
      return formData.custom_location_name;
    }
    if (locationSelectionMode === "venue" && formData.venue_id) {
      const venue = venues.find(v => v.id === formData.venue_id);
      return venue?.name || "";
    }
    if (formData.location_mode === "online") {
      return "Online";
    }
    return "";
  };

  // Build preview event object for HappeningCard
  const previewEvent: HappeningEvent = useMemo(() => {
    const selectedVenue = venues.find(v => v.id === formData.venue_id);
    return {
      id: event?.id || "preview",
      title: formData.title || "Event Title",
      event_type: formData.event_type,
      is_dsc_event: formData.is_dsc_event,
      day_of_week: formData.day_of_week || undefined,
      start_time: formData.start_time || undefined,
      end_time: formData.end_time || undefined,
      venue_id: locationSelectionMode === "venue" ? formData.venue_id || undefined : undefined,
      venue_name: locationSelectionMode === "venue" ? selectedVenue?.name || undefined : undefined,
      location_mode: formData.location_mode as "venue" | "online" | "hybrid" | undefined,
      online_url: formData.online_url || undefined,
      custom_location_name: locationSelectionMode === "custom" ? formData.custom_location_name || undefined : undefined,
      is_free: formData.is_free,
      cost_label: formData.cost_label || undefined,
      age_policy: formData.age_policy || undefined,
      cover_image_url: coverImageUrl || undefined,
      status: formData.is_published ? "active" : "draft",
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      has_timeslots: slotConfig.has_timeslots,
      total_slots: slotConfig.has_timeslots ? slotConfig.total_slots : undefined,
    };
  }, [
    event?.id,
    formData.title,
    formData.event_type,
    formData.is_dsc_event,
    formData.day_of_week,
    formData.start_time,
    formData.end_time,
    formData.venue_id,
    formData.location_mode,
    formData.online_url,
    formData.custom_location_name,
    formData.is_free,
    formData.cost_label,
    formData.age_policy,
    formData.is_published,
    formData.capacity,
    locationSelectionMode,
    venues,
    coverImageUrl,
    slotConfig.has_timeslots,
    slotConfig.total_slots,
  ]);

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

    // Phase 4.42k: Comprehensive validation with error summary
    // This replaces silent HTML5 validation scrolling with explicit error messages
    const missingFields: string[] = [];

    // Required fields validation
    if (!formData.title.trim()) {
      missingFields.push("Title");
    }
    if (!formData.day_of_week) {
      missingFields.push("Day of Week");
    }
    if (!formData.start_time) {
      missingFields.push("Start Time");
    }

    // Location validation (conditional based on mode)
    if (formData.location_mode !== "online") {
      if (locationSelectionMode === "venue" && !formData.venue_id) {
        missingFields.push("Venue");
      }
      if (locationSelectionMode === "custom" && !formData.custom_location_name.trim()) {
        missingFields.push("Location Name");
      }
    }

    // Online URL validation (conditional)
    if ((formData.location_mode === "online" || formData.location_mode === "hybrid") && !formData.online_url) {
      missingFields.push("Online URL");
    }

    // If any required fields are missing, show error summary and scroll to form top
    if (missingFields.length > 0) {
      const fieldList = missingFields.join(", ");
      setError(`Please fill in required fields: ${fieldList}`);
      setLoading(false);
      // Scroll to the error message at top of form
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Phase 4.36: Require publish confirmation when transitioning to published
    // Confirmation is needed when: (1) publishing a new event, OR (2) publishing a previously draft event
    const wasPublished = event?.is_published ?? false;
    const willPublish = formData.is_published;
    const isNewPublish = willPublish && !wasPublished;

    if (isNewPublish && !publishConfirmed) {
      setError("Please confirm you're ready to publish before making this event visible.");
      setLoading(false);
      return;
    }

    try {
      const url = mode === "create"
        ? "/api/my-events"
        : `/api/my-events/${event?.id}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const body = {
        ...formData,
        // Phase 4.43: capacity is independent of timeslots (RSVP always available)
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        cover_image_url: coverImageUrl,
        is_published: formData.is_published,
        // Phase 4.36: Include publish confirmation flag when publishing
        host_publish_confirmed: isNewPublish ? publishConfirmed : undefined,
        // Slot configuration
        has_timeslots: slotConfig.has_timeslots,
        total_slots: slotConfig.has_timeslots ? slotConfig.total_slots : null,
        slot_duration_minutes: slotConfig.has_timeslots ? slotConfig.slot_duration_minutes : null,
        allow_guests: slotConfig.has_timeslots ? slotConfig.allow_guests : null,
        // Series configuration (for create mode)
        start_date: formData.start_date || (formData.day_of_week ? getNextDayOfWeekMT(formData.day_of_week) : null),
        occurrence_count: parseInt(formData.occurrence_count) || 1,
        // Phase 3 fields
        timezone: formData.timezone,
        location_mode: formData.location_mode,
        online_url: formData.online_url || null,
        is_free: formData.is_free,
        cost_label: formData.cost_label || null,
        signup_mode: formData.signup_mode || null,
        signup_url: formData.signup_url || null,
        signup_deadline: formData.signup_deadline || null,
        age_policy: formData.age_policy || null,
        is_dsc_event: canCreateDSC ? formData.is_dsc_event : false,
        external_url: formData.external_url.trim() || null,
        // Phase 4.0: Location selection mode and custom location fields
        location_selection_mode: locationSelectionMode,
        venue_id: locationSelectionMode === "venue" ? formData.venue_id : null,
        custom_location_name: locationSelectionMode === "custom" ? (formData.custom_location_name.trim() || null) : null,
        custom_address: locationSelectionMode === "custom" ? (formData.custom_address.trim() || null) : null,
        custom_city: locationSelectionMode === "custom" ? (formData.custom_city.trim() || null) : null,
        custom_state: locationSelectionMode === "custom" ? (formData.custom_state.trim() || null) : null,
        custom_latitude: locationSelectionMode === "custom" && formData.custom_latitude ? parseFloat(formData.custom_latitude) : null,
        custom_longitude: locationSelectionMode === "custom" && formData.custom_longitude ? parseFloat(formData.custom_longitude) : null,
        location_notes: formData.location_notes.trim() || null,
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
        // Redirect with success message
        const publishStatus = formData.is_published ? "published" : "draft";
        router.push(`/dashboard/my-events/${data.id}?created=true&status=${publishStatus}`);
      } else {
        // Handle verification change (admin only) - call bulk-verify API
        if (isAdmin && isVerified !== wasVerified) {
          try {
            const verifyRes = await fetch("/api/admin/ops/events/bulk-verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventIds: [event?.id],
                action: isVerified ? "verify" : "unverify",
              }),
            });
            if (!verifyRes.ok) {
              console.error("Failed to update verification status");
            }
          } catch (verifyErr) {
            console.error("Verification update error:", verifyErr);
          }
        }
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
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600">
          {success}
        </div>
      )}

      {/* ============ SECTION 1: EVENT TYPE ============ */}
      {/* Phase 4.44c: Intent-first - What kind of event is this? */}
      <div>
        <label className="block text-sm font-medium mb-2">
          <span className="text-red-500">Event Type</span>
          <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
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
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{selectedTypeConfig.description}</p>
      </div>

      {/* ============ SECTION 2: TITLE ============ */}
      <div>
        <label className="block text-sm font-medium mb-2">
          <span className="text-red-500">Event Title</span>
          <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="e.g., Wednesday Night Song Circle"
          required
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
        />
      </div>

      {/* ============ SECTION 3: SCHEDULE ============ */}
      {/* Phase 4.44c: When is this event? */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            <span className="text-red-500">Day of Week</span>
            <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
          </label>
          <select
            value={formData.day_of_week}
            onChange={(e) => {
              updateField("day_of_week", e.target.value);
              // Phase 4.42e: Auto-snap start date to selected weekday (Mountain Time)
              if (e.target.value) {
                updateField("start_date", getNextDayOfWeekMT(e.target.value));
              }
            }}
            required
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          >
            <option value="">Select day</option>
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            <span className="text-red-500">Start Time</span>
            <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
          </label>
          <select
            value={formData.start_time}
            onChange={(e) => updateField("start_time", e.target.value)}
            required
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          >
            <option value="">Select time</option>
            {TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            End Time <span className="font-normal">(optional)</span>
          </label>
          <select
            value={formData.end_time}
            onChange={(e) => updateField("end_time", e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          >
            <option value="">Select time</option>
            {TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ============ SECTION 3b: EVENT SERIES (Progressive Disclosure) ============ */}
      {/* Phase 4.44c: Only shown when day_of_week is selected in create mode */}
      {mode === "create" && formData.day_of_week && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg space-y-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Create Happening Series
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Create multiple happenings for a recurring series. Each happening will have its own page and signups.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <span className="text-red-500">First Event Date</span>
                <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
              </label>
              <input
                type="date"
                value={formData.start_date || getNextDayOfWeekMT(formData.day_of_week)}
                onChange={(e) => {
                  updateField("start_date", e.target.value);
                  // Phase 4.42e: Bi-directional sync - update Day of Week to match selected date
                  if (e.target.value) {
                    updateField("day_of_week", weekdayNameFromDateMT(e.target.value));
                  }
                }}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                <span className="text-red-500">Number of Events</span>
                <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
              </label>
              <select
                value={formData.occurrence_count}
                onChange={(e) => updateField("occurrence_count", e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <option key={n} value={n.toString()}>
                    {n} {n === 1 ? "event" : "events"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview of dates */}
          {formData.start_date && parseInt(formData.occurrence_count) > 1 && (
            <div className="pt-2 border-t border-[var(--color-border-default)]">
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Events will be created for:
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.min(parseInt(formData.occurrence_count), 12) }, (_, i) => {
                  const startDate = new Date(formData.start_date + "T00:00:00");
                  const eventDate = new Date(startDate);
                  eventDate.setDate(startDate.getDate() + (i * 7)); // Weekly
                  return (
                    <span
                      key={i}
                      className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded text-xs text-[var(--color-text-primary)]"
                    >
                      {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" })}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SECTION 4: LOCATION ============ */}
      {/* Phase 4.44c: Where is this event? */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Event Location
          </label>
          <select
            value={formData.location_mode}
            onChange={(e) => setFormData(prev => ({ ...prev, location_mode: e.target.value }))}
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          >
            <option value="venue">In-person venue</option>
            <option value="online">Online only</option>
            <option value="hybrid">Hybrid (venue + online option)</option>
          </select>
        </div>

        {(formData.location_mode === "online" || formData.location_mode === "hybrid") && (
          <div>
            <label className="block text-sm font-medium mb-2">
              <span className="text-red-500">Online URL</span>
              <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
            </label>
            <input
              type="url"
              placeholder="https://zoom.us/j/... or YouTube link"
              value={formData.online_url}
              onChange={(e) => setFormData(prev => ({ ...prev, online_url: e.target.value }))}
              required
              className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
            />
          </div>
        )}

        {/* Venue / Custom Location Selection */}
        {(formData.location_mode === "venue" || formData.location_mode === "hybrid") && (
          <>
            <VenueSelector
              venues={venues}
              selectedVenueId={formData.venue_id}
              onVenueChange={(venueId) => {
                updateField("venue_id", venueId);
                setLocationSelectionMode("venue");
              }}
              onVenueCreated={(newVenue) => setVenues(prev => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)))}
              onCustomLocationSelect={() => {
                updateField("venue_id", "");
                setLocationSelectionMode("custom");
              }}
              showCustomLocationOption={true}
              isCustomLocationSelected={locationSelectionMode === "custom"}
              canCreateVenue={canCreateVenue}
              required
              disabled={loading}
            />

            {/* Venue Summary Panel */}
            {locationSelectionMode === "venue" && formData.venue_id && (() => {
              const selectedVenue = venues.find(v => v.id === formData.venue_id);
              if (!selectedVenue) return null;

              const hasUnknownAddress = isPlaceholderValue(selectedVenue.address);
              const hasUnknownCity = isPlaceholderValue(selectedVenue.city);
              const hasAnyUnknown = hasUnknownAddress || hasUnknownCity;
              const mapsUrl = selectedVenue.google_maps_url || selectedVenue.map_link;

              return (
                <div className={`p-4 rounded-lg border ${hasAnyUnknown ? "bg-amber-900/10 border-amber-500/30" : "bg-[var(--color-bg-tertiary)] border-[var(--color-border-default)]"}`}>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Venue Details
                  </h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-secondary)] w-16">Name:</dt>
                      <dd className="text-[var(--color-text-primary)]">{selectedVenue.name}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-secondary)] w-16">Address:</dt>
                      <dd className={hasUnknownAddress ? "text-amber-400 italic" : "text-[var(--color-text-primary)]"}>
                        {hasUnknownAddress ? "Unknown" : selectedVenue.address}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-secondary)] w-16">City:</dt>
                      <dd className={hasUnknownCity ? "text-amber-400 italic" : "text-[var(--color-text-primary)]"}>
                        {hasUnknownCity ? "Unknown" : `${selectedVenue.city}, ${selectedVenue.state || "CO"}`}
                      </dd>
                    </div>
                    {mapsUrl && (
                      <div className="flex gap-2">
                        <dt className="text-[var(--color-text-secondary)] w-16">Map:</dt>
                        <dd>
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-link)] hover:underline">
                            View on Google Maps ↗
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {hasAnyUnknown && (
                    <p className="mt-3 text-sm text-amber-400">
                      This venue record is incomplete. Consider using a custom location or updating the venue details.
                    </p>
                  )}
                  {/* Phase 4.46: "Venue wrong?" link */}
                  <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                    Venue info wrong?{" "}
                    {canCreateVenue ? (
                      <a
                        href="/dashboard/admin/venues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-link)] hover:underline"
                      >
                        Edit this venue (Admin)
                      </a>
                    ) : (
                      <a
                        href={`mailto:hello@denversongwriterscollective.org?subject=${encodeURIComponent(`Venue Issue: ${selectedVenue.name}`)}&body=${encodeURIComponent(`Venue: ${selectedVenue.name} (${selectedVenue.id})\n\nPlease describe the issue:\n`)}`}
                        className="text-[var(--color-link)] hover:underline"
                      >
                        Report an issue
                      </a>
                    )}
                  </p>
                </div>
              );
            })()}

            {/* Custom Location Fields */}
            {locationSelectionMode === "custom" && (
              <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-accent)]">Custom Location (this happening only)</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    This location applies only to this happening and won&apos;t be added to the venue list.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    <span className="text-red-500">Location Name</span>
                    <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Back room at Joe's Coffee"
                    value={formData.custom_location_name}
                    onChange={(e) => updateField("custom_location_name", e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Street Address <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="123 Main St"
                    value={formData.custom_address}
                    onChange={(e) => updateField("custom_address", e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      City <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Denver"
                      value={formData.custom_city}
                      onChange={(e) => updateField("custom_city", e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      State <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="CO"
                      value={formData.custom_state}
                      onChange={(e) => updateField("custom_state", e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      Latitude <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="39.7392"
                      value={formData.custom_latitude}
                      onChange={(e) => updateField("custom_latitude", e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      Longitude <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-104.9903"
                      value={formData.custom_longitude}
                      onChange={(e) => updateField("custom_longitude", e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Location Notes <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Back room, Meet at north entrance, etc."
                    value={formData.location_notes}
                    onChange={(e) => updateField("location_notes", e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                  />
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Additional instructions for finding the location
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ SECTION 5: DESCRIPTION + COVER IMAGE ============ */}
      {/* Phase 4.44c: Add details about the event */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Description <span className="font-normal">(optional)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="What should attendees expect? Any requirements?"
          rows={4}
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none resize-none"
        />
      </div>

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
            aspectRatio={4/3}
            shape="square"
            placeholderText="Add Cover Photo"
            maxSizeMB={5}
          />
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Recommended: 1200×900px (4:3). Most phone photos are already 4:3.
        </p>
      </div>

      {/* ============ SECTION 6: ATTENDANCE & SIGNUP ============ */}
      {/* Phase 4.44c: Who can attend and how do performers sign up? */}
      <SlotConfigSection
        eventType={formData.event_type}
        config={slotConfig}
        onChange={setSlotConfig}
        disabled={loading}
        capacity={formData.capacity ? parseInt(formData.capacity) : null}
        onCapacityChange={(cap) => updateField("capacity", cap?.toString() || "")}
      />

      {/* Warning: Timeslot duration exceeds event duration */}
      {slotDurationExceedsEvent && (
        <div className="p-4 bg-amber-100 border border-amber-300 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Warning:</strong> Total slot time ({totalSlotDuration} min) exceeds event duration ({eventDurationMinutes} min).
            {totalSlotDuration > eventDurationMinutes! && (
              <span className="block mt-1 text-sm text-[var(--color-text-secondary)]">
                Consider reducing slots to {Math.floor(eventDurationMinutes! / slotConfig.slot_duration_minutes)} or shortening slot duration.
              </span>
            )}
          </p>
        </div>
      )}

      {/* ============ SECTION 7: ADVANCED OPTIONS (Collapsed by default) ============ */}
      {/* Phase 4.44c: Progressive disclosure - less common options */}
      <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Advanced Options
          </span>
          <svg
            className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="p-4 space-y-6 bg-[var(--color-bg-primary)]">
            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Timezone <span className="font-normal">(optional)</span>
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                <option value="America/Denver">Mountain Time (Denver)</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/New_York">Eastern Time</option>
              </select>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Times will be displayed in this timezone</p>
            </div>

            {/* Cost */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Cost <span className="font-normal">(optional)</span>
                </label>
                <select
                  value={formData.is_free === null ? "unknown" : formData.is_free ? "free" : "paid"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      is_free: val === "unknown" ? null : val === "free",
                      cost_label: val === "free" ? "Free" : prev.cost_label
                    }));
                  }}
                  className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                >
                  <option value="unknown">Not specified</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid / Donation</option>
                </select>
              </div>

              {formData.is_free === false && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Cost Details <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="$10, Donation, $5-15, etc."
                    value={formData.cost_label}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_label: e.target.value }))}
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* External Signup Method */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  External Signup Method <span className="font-normal">(optional)</span>
                </label>
                <select
                  value={formData.signup_mode}
                  onChange={(e) => setFormData(prev => ({ ...prev, signup_mode: e.target.value }))}
                  className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                >
                  <option value="">Not specified</option>
                  <option value="walk_in">Walk-in only (no signup)</option>
                  <option value="in_person">Sign up in person at venue</option>
                  <option value="online">Online signup (external)</option>
                  <option value="both">Both (in person + online)</option>
                </select>
              </div>

              {(formData.signup_mode === "online" || formData.signup_mode === "both") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                      Signup URL <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={formData.signup_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, signup_url: e.target.value }))}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                      Signup Deadline <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.signup_deadline}
                      onChange={(e) => setFormData(prev => ({ ...prev, signup_deadline: e.target.value }))}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Age Policy */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Age Policy <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="21+, All ages, 18+ only, etc."
                value={formData.age_policy}
                onChange={(e) => setFormData(prev => ({ ...prev, age_policy: e.target.value }))}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              />
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Leave blank if unknown</p>
            </div>

            {/* External Website Link */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                External Website Link <span className="font-normal">(optional)</span>
              </label>
              <input
                type="url"
                placeholder="https://venue-website.com/event-page"
                value={formData.external_url}
                onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              />
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Link to venue&apos;s website, Facebook event, or other external page for this happening
              </p>
            </div>

            {/* DSC Toggle */}
            {canCreateDSC && (
              <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_dsc_event}
                    onChange={(e) => {
                      const isDSC = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        is_dsc_event: isDSC,
                        age_policy: isDSC && !prev.age_policy ? "18+ only" : prev.age_policy
                      }));
                    }}
                    className="w-5 h-5 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
                  />
                  <div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      This is an official DSC event
                    </span>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      DSC events are curated and represent the Denver Songwriters Collective brand
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Host Notes */}
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
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ============ SECTION 8: PUBLISH ============ */}
      {/* Phase 4.44c: Always at bottom, always visible */}
      <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              {formData.is_published ? "Published" : "Draft"}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              {formData.is_published
                ? "This happening is visible to the public and accepting signups."
                : "This happening is hidden from the public. Publish when ready."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const newPublished = !formData.is_published;
              setFormData(prev => ({ ...prev, is_published: newPublished }));
              // Reset confirmation when toggling off
              if (!newPublished) {
                setPublishConfirmed(false);
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.is_published
                ? "bg-emerald-600"
                : "bg-[var(--color-bg-secondary)]"
            }`}
            role="switch"
            aria-checked={formData.is_published}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.is_published ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Phase 4.36/4.37: Publish confirmation checkbox - only show when publishing a new/draft event */}
        {formData.is_published && !(event?.is_published) && (
          <label className="flex items-start gap-3 cursor-pointer p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <input
              type="checkbox"
              checked={publishConfirmed}
              onChange={(e) => setPublishConfirmed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-[var(--color-border-default)] text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Ready to publish
              </span>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                This will make your happening visible to the community. You can unpublish at any time.
              </p>
            </div>
          </label>
        )}

        {/* Verification checkbox - for admin only in edit mode */}
        {mode === "edit" && isAdmin && formData.is_published && (
          <label className="flex items-start gap-3 cursor-pointer p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-[var(--color-border-default)] text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                ✓ Confirm this happening
              </span>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                {wasVerified
                  ? "This happening has been verified. Uncheck to mark as unconfirmed."
                  : "Mark this happening as confirmed (verified) once you know it&apos;s real and happening."}
              </p>
            </div>
          </label>
        )}
      </div>

      {/* ============ LIVE PREVIEW SECTION ============ */}
      <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Preview
        </h3>

        {/* Card Preview */}
        <div className="mb-6">
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            How your happening will appear in listings:
          </p>
          <div className="pointer-events-none select-none" aria-hidden="true">
            <HappeningCard
              event={previewEvent}
              variant="list"
            />
          </div>
        </div>

        {/* Detail Header Preview */}
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Happening detail page header:
          </p>
          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              {formData.title || "Event Title"}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
              {formData.day_of_week && (
                <span>{formData.day_of_week}s</span>
              )}
              {formData.start_time && (
                <span>{formatTimeToAMPM(formData.start_time)}</span>
              )}
              {getPreviewLocation() && (
                <span>{getPreviewLocation()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create Happening" : "Save Changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => router.push("/dashboard/my-events")}
            className="px-6 py-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
            aria-label="Back without saving (does not cancel event)"
          >
            Back without saving
          </button>
        )}
      </div>
    </form>
  );
}
