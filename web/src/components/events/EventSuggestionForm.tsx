"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Event {
  id: string;
  title: string;
  venue_name?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  signup_time?: string | null;
  recurrence_rule?: string | null;
  category?: string | null;
  description?: string | null;
  slug?: string | null;
}

interface Props {
  event: Event;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORIES = ["music", "comedy", "poetry", "variety", "other"];

export default function EventSuggestionForm({ event }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: event.title || "",
    venue_name: event.venue_name || "",
    day_of_week: event.day_of_week || "",
    start_time: event.start_time || "",
    end_time: event.end_time || "",
    signup_time: event.signup_time || "",
    recurrence_rule: event.recurrence_rule || "",
    category: event.category || "",
    description: event.description || "",
  });

  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session?.user?.email) {
        setSubmitterEmail(session.user.email);
      }
    };
    checkAuth();
  }, [supabase.auth]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLoggedIn) {
      const slug = event.slug || event.id;
      router.push(`/login?redirectTo=/open-mics/${slug}`);
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
      day_of_week: event.day_of_week || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      signup_time: event.signup_time || "",
      recurrence_rule: event.recurrence_rule || "",
      category: event.category || "",
      description: event.description || "",
    };

    for (const [key, newValue] of Object.entries(formData)) {
      const oldValue = originalValues[key] || "";
      if (newValue !== oldValue) {
        changes.push({ field: key, old_value: oldValue, new_value: newValue });
      }
    }

    if (changes.length === 0) {
      setError("No changes detected. Please modify at least one field.");
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
        <p className="text-neutral-400 text-sm mt-1">Your suggestions will be reviewed.</p>
      </div>
    );
  }

  if (isLoggedIn === null) return null;

  const slug = event.slug || event.id;

  return (
    <div className="mt-8">
      {!isOpen ? (
        <button
          onClick={() => {
            if (!isLoggedIn) {
              router.push(`/login?redirectTo=/open-mics/${slug}`);
            } else {
              setIsOpen(true);
            }
          }}
          className="text-teal-400 hover:text-teal-300 underline text-sm"
        >
          {isLoggedIn ? "Suggest updates to this listing" : "Sign in to suggest updates"}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Suggest Updates</h3>
          <p className="text-neutral-400 text-sm mb-4">
            Edit any fields that need correction. Only changed fields will be submitted.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Venue Name</label>
              <input
                type="text"
                value={formData.venue_name}
                onChange={(e) => handleChange("venue_name", e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Day of Week</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => handleChange("day_of_week", e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              >
                <option value="">Select day...</option>
                {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              >
                <option value="">Select...</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Start Time</label>
              <input
                type="text"
                value={formData.start_time}
                onChange={(e) => handleChange("start_time", e.target.value)}
                placeholder="7:00 PM"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">End Time</label>
              <input
                type="text"
                value={formData.end_time}
                onChange={(e) => handleChange("end_time", e.target.value)}
                placeholder="10:00 PM"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Signup Time</label>
              <input
                type="text"
                value={formData.signup_time}
                onChange={(e) => handleChange("signup_time", e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Recurrence</label>
              <input
                type="text"
                value={formData.recurrence_rule}
                onChange={(e) => handleChange("recurrence_rule", e.target.value)}
                placeholder="Every Monday"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Your Name (optional)</label>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Your Email</label>
              <input
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
                readOnly={!!submitterEmail}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-neutral-300 mb-1">Notes for Reviewers</label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={2}
              placeholder="Source or reason for changes..."
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-white"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded text-white font-medium disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Suggestions"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
