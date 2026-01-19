"use client";

/**
 * EventSuggestionForm - Community-powered event corrections
 *
 * Phase 4.1: Expanded field coverage for Phase 3/4 event fields:
 * - Basic: title, venue_name, day_of_week, category, description
 * - Schedule: start_time, end_time, signup_time, recurrence_rule
 * - Cost: is_free, cost_label
 * - Signup: signup_mode, signup_url
 * - Age: age_policy
 * - Location: venue_address, custom location fields
 */

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Event {
  id: string;
  title: string;
  venue_name?: string | null;
  venue_address?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  signup_time?: string | null;
  recurrence_rule?: string | null;
  category?: string | null;
  description?: string | null;
  slug?: string | null;
  // Phase 3/4 fields
  is_free?: boolean | null;
  cost_label?: string | null;
  signup_mode?: string | null;
  signup_url?: string | null;
  age_policy?: string | null;
  location_mode?: string | null;
  online_url?: string | null;
  custom_location_name?: string | null;
  custom_address?: string | null;
  custom_city?: string | null;
  custom_state?: string | null;
  location_notes?: string | null;
  // Phase 4.37: Status for verification suggestion
  status?: string | null;
}

interface Props {
  event: Event;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORIES = ["music", "comedy", "poetry", "variety", "other"];
const SIGNUP_MODES = [
  { value: "", label: "Select..." },
  { value: "in_person", label: "In-person only" },
  { value: "online", label: "Online only" },
  { value: "both", label: "Both online & in-person" },
  { value: "walk_in", label: "Walk-in (no signup)" }
];
const LOCATION_MODES = [
  { value: "", label: "Select..." },
  { value: "venue", label: "Physical venue" },
  { value: "online", label: "Online only" },
  { value: "hybrid", label: "Hybrid (both)" }
];

// Phase 4.37: Status suggestion options
const STATUS_SUGGESTIONS = [
  { value: "", label: "Select status..." },
  { value: "confirmed", label: "Confirmed - This event is happening" },
  { value: "unconfirmed", label: "Unconfirmed - May still happen but not verified" },
  { value: "cancelled", label: "Cancelled - This event is no longer happening" }
];

export default function EventSuggestionForm({ event }: Props) {
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Original fields
  const [formData, setFormData] = useState({
    title: event.title || "",
    venue_name: event.venue_name || "",
    venue_address: event.venue_address || "",
    day_of_week: event.day_of_week || "",
    start_time: event.start_time || "",
    end_time: event.end_time || "",
    signup_time: event.signup_time || "",
    recurrence_rule: event.recurrence_rule || "",
    category: event.category || "",
    description: event.description || "",
    // Phase 3/4 fields
    is_free: event.is_free === true ? "true" : event.is_free === false ? "false" : "",
    cost_label: event.cost_label || "",
    signup_mode: event.signup_mode || "",
    signup_url: event.signup_url || "",
    age_policy: event.age_policy || "",
    location_mode: event.location_mode || "",
    online_url: event.online_url || "",
    custom_location_name: event.custom_location_name || "",
    custom_address: event.custom_address || "",
    custom_city: event.custom_city || "",
    custom_state: event.custom_state || "",
    location_notes: event.location_notes || "",
  });

  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  // Phase 4.37: Status suggestion
  const [suggestedStatus, setSuggestedStatus] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      if (user?.email) {
        setSubmitterEmail(user.email);
      }
    };
    checkAuth();
  }, [supabase.auth]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guest submissions require email
    if (!isLoggedIn && !submitterEmail.trim()) {
      setError("Please provide your email address so we can follow up if needed.");
      return;
    }

    setSubmitting(true);
    setError("");

    const batchId = crypto.randomUUID();
    const changes: { field: string; old_value: string; new_value: string }[] = [];

    // Compare formData with original event values to find changes
    const originalValues: Record<string, string> = {
      title: event.title || "",
      venue_name: event.venue_name || "",
      venue_address: event.venue_address || "",
      day_of_week: event.day_of_week || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      signup_time: event.signup_time || "",
      recurrence_rule: event.recurrence_rule || "",
      category: event.category || "",
      description: event.description || "",
      // Phase 3/4 fields
      is_free: event.is_free === true ? "true" : event.is_free === false ? "false" : "",
      cost_label: event.cost_label || "",
      signup_mode: event.signup_mode || "",
      signup_url: event.signup_url || "",
      age_policy: event.age_policy || "",
      location_mode: event.location_mode || "",
      online_url: event.online_url || "",
      custom_location_name: event.custom_location_name || "",
      custom_address: event.custom_address || "",
      custom_city: event.custom_city || "",
      custom_state: event.custom_state || "",
      location_notes: event.location_notes || "",
    };

    for (const [key, newValue] of Object.entries(formData)) {
      const oldValue = originalValues[key] || "";
      if (newValue !== oldValue) {
        changes.push({ field: key, old_value: oldValue, new_value: newValue });
      }
    }

    // Phase 4.37: Add status suggestion as a separate change
    if (suggestedStatus) {
      changes.push({
        field: "suggested_status",
        old_value: event.status || "",
        new_value: suggestedStatus
      });
    }

    if (changes.length === 0) {
      setError("No changes detected. Please modify at least one field or suggest a status.");
      setSubmitting(false);
      return;
    }

    try {
      // Submit each change to the API
      for (const change of changes) {
        const response = await fetch("/api/event-update-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: event.id,
            batch_id: batchId,
            field: change.field,
            old_value: change.old_value,
            new_value: change.new_value,
            status: "pending",
            submitter_name: submitterName || null,
            submitter_email: submitterEmail || null,
            notes: additionalNotes || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to submit suggestion");
        }
      }

      setSuccess(true);
      setIsOpen(false);
    } catch (err) {
      console.error("Submission error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mt-8 p-4 bg-green-900/30 border border-green-700 rounded-lg text-center">
        <p className="text-green-300 font-medium">Thank you!</p>
        <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Your suggestions will be reviewed.</p>
      </div>
    );
  }

  if (isLoggedIn === null) return null;

  return (
    <div className="mt-8">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] underline text-sm"
        >
          Suggest updates to this listing
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-input)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Suggest Updates</h3>
          <p className="text-[var(--color-text-tertiary)] text-sm mb-4">
            Edit any fields that need correction. Only changed fields will be submitted.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-800 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info Section */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">Basic Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                >
                  <option value="">Select...</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">Schedule</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Day of Week</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => handleChange("day_of_week", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                >
                  <option value="">Select day...</option>
                  {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Recurrence</label>
                <input
                  type="text"
                  value={formData.recurrence_rule}
                  onChange={(e) => handleChange("recurrence_rule", e.target.value)}
                  placeholder="Every Monday, 1st & 3rd Tuesday, etc."
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Start Time</label>
                <input
                  type="text"
                  value={formData.start_time}
                  onChange={(e) => handleChange("start_time", e.target.value)}
                  placeholder="7:00 PM"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">End Time</label>
                <input
                  type="text"
                  value={formData.end_time}
                  onChange={(e) => handleChange("end_time", e.target.value)}
                  placeholder="10:00 PM"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">Location</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Location Type</label>
                <select
                  value={formData.location_mode}
                  onChange={(e) => handleChange("location_mode", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                >
                  {LOCATION_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Venue Name</label>
                <input
                  type="text"
                  value={formData.venue_name}
                  onChange={(e) => handleChange("venue_name", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Venue Address</label>
                <input
                  type="text"
                  value={formData.venue_address}
                  onChange={(e) => handleChange("venue_address", e.target.value)}
                  placeholder="123 Main St, Denver, CO"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>

              {(formData.location_mode === "online" || formData.location_mode === "hybrid") && (
                <div className="md:col-span-2">
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Online URL</label>
                  <input
                    type="url"
                    value={formData.online_url}
                    onChange={(e) => handleChange("online_url", e.target.value)}
                    placeholder="https://zoom.us/j/..."
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Location Notes</label>
                <input
                  type="text"
                  value={formData.location_notes}
                  onChange={(e) => handleChange("location_notes", e.target.value)}
                  placeholder="Back room, upstairs, etc."
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Signup & Cost Section */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">Signup & Cost</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Signup Mode</label>
                <select
                  value={formData.signup_mode}
                  onChange={(e) => handleChange("signup_mode", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                >
                  {SIGNUP_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Signup Time (in-person)</label>
                <input
                  type="text"
                  value={formData.signup_time}
                  onChange={(e) => handleChange("signup_time", e.target.value)}
                  placeholder="6:30 PM"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>

              {(formData.signup_mode === "online" || formData.signup_mode === "both") && (
                <div className="md:col-span-2">
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Signup URL</label>
                  <input
                    type="url"
                    value={formData.signup_url}
                    onChange={(e) => handleChange("signup_url", e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Is it free?</label>
                <select
                  value={formData.is_free}
                  onChange={(e) => handleChange("is_free", e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                >
                  <option value="">Unknown</option>
                  <option value="true">Yes, free</option>
                  <option value="false">No, there&apos;s a cost</option>
                </select>
              </div>

              {formData.is_free === "false" && (
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Cost Details</label>
                  <input
                    type="text"
                    value={formData.cost_label}
                    onChange={(e) => handleChange("cost_label", e.target.value)}
                    placeholder="$5 cover, 2-drink minimum, etc."
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Age Policy</label>
                <input
                  type="text"
                  value={formData.age_policy}
                  onChange={(e) => handleChange("age_policy", e.target.value)}
                  placeholder="21+, All ages, 18+ after 9pm, etc."
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Phase 4.37: Event Status Suggestion */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">Event Status</h4>
            <p className="text-[var(--color-text-tertiary)] text-sm mb-3">
              Is this event still happening? Help us keep our listings accurate.
            </p>
            <div className="max-w-md">
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Status Suggestion</label>
              <select
                value={suggestedStatus}
                onChange={(e) => setSuggestedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
              >
                {STATUS_SUGGESTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submitter Info */}
          <div className="mb-6 pt-4 border-t border-[var(--color-border-subtle)]">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">Your Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Your Name (optional)</label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  Your Email{!isLoggedIn && <span className="text-red-400 ml-1">*</span>}
                </label>
                <input
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder={!isLoggedIn ? "Required for guest submissions" : ""}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
                  readOnly={isLoggedIn && !!submitterEmail}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Notes for Reviewers</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={2}
                placeholder="Source or reason for changes..."
                className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-background)] font-medium disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Suggestions"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
