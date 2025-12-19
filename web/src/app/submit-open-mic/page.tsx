"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { PageContainer, HeroSection } from "@/components/layout";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORIES = ["comedy", "poetry", "music", "variety", "other"];

type SubmitMode = "new" | "claim" | null;

interface ExistingEvent {
  id: string;
  title: string;
  venue_name?: string | null;
  day_of_week?: string | null;
  slug?: string | null;
}

export default function SubmitOpenMicPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<SubmitMode>(null);
  const [existingEvents, setExistingEvents] = useState<ExistingEvent[]>([]);
  const [searchExisting, setSearchExisting] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");

  // New open mic form data
  const [formData, setFormData] = useState({
    title: "",
    venue_name: "",
    venue_address: "",
    venue_city: "Denver",
    venue_state: "CO",
    day_of_week: "",
    start_time: "",
    end_time: "",
    signup_time: "",
    recurrence_rule: "",
    category: "",
    description: "",
    notes: "",
  });

  // Host claim data
  const [claimEventId, setClaimEventId] = useState<string | null>(null);
  const [claimNotes, setClaimNotes] = useState("");

  // Fetch existing events for claiming
  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase
        .from("events")
        .select("id, title, venue_name, day_of_week, slug")
        .eq("event_type", "open_mic")
        .order("title");
      setExistingEvents(data ?? []);
    }
    fetchEvents();
  }, [supabase]);

  // Filter existing events for search
  const filteredEvents = searchExisting.trim()
    ? existingEvents.filter(
        (e) =>
          e.title.toLowerCase().includes(searchExisting.toLowerCase()) ||
          (e.venue_name?.toLowerCase().includes(searchExisting.toLowerCase()))
      )
    : existingEvents;

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login?redirectTo=/submit-open-mic");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Submit as a suggestion for new event
      const { error: insertError } = await supabase.from("event_update_suggestions").insert({
        event_id: null, // null indicates new event suggestion
        field: "_new_event",
        old_value: null,
        new_value: JSON.stringify(formData),
        status: "pending",
        submitter_email: user.email,
        notes: `New open mic submission: ${formData.title} at ${formData.venue_name}`,
        batch_id: crypto.randomUUID(),
      });

      if (insertError) throw insertError;

      setSuccess("new");
      setFormData({
        title: "",
        venue_name: "",
        venue_address: "",
        venue_city: "Denver",
        venue_state: "CO",
        day_of_week: "",
        start_time: "",
        end_time: "",
        signup_time: "",
        recurrence_rule: "",
        category: "",
        description: "",
        notes: "",
      });
    } catch (err) {
      console.error("Submit error:", err);
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !claimEventId) return;

    setSubmitting(true);
    setError("");

    try {
      const { error: insertError } = await supabase.from("event_update_suggestions").insert({
        event_id: claimEventId,
        field: "_host_claim",
        old_value: null,
        new_value: user.email,
        status: "pending",
        submitter_email: user.email,
        notes: claimNotes || "Host claim request",
        batch_id: crypto.randomUUID(),
      });

      if (insertError) throw insertError;

      setSuccess("claim");
      setClaimEventId(null);
      setClaimNotes("");
    } catch (err) {
      console.error("Claim error:", err);
      setError("Failed to submit claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <PageContainer>
        <div className="py-16 text-center text-[var(--color-text-tertiary)]">Loading...</div>
      </PageContainer>
    );
  }

  // Success state
  if (success) {
    return (
      <div>
        <HeroSection minHeight="md">
          <PageContainer>
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <h1 className="text-gradient-gold text-3xl font-serif italic mb-4">
                {success === "new" ? "Submission Received!" : "Claim Request Submitted!"}
              </h1>
              <p className="text-[var(--color-text-secondary)] mb-6">
                {success === "new"
                  ? "Thank you for submitting a new open mic. Our team will review it shortly."
                  : "Your host claim request has been submitted. We'll verify and get back to you."}
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/open-mics"
                  className="px-6 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-lg text-[var(--color-text-on-accent)]"
                >
                  Browse Open Mics
                </Link>
                <button
                  onClick={() => {
                    setSuccess(null);
                    setMode(null);
                  }}
                  className="px-6 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded-lg text-[var(--color-text-primary)]"
                >
                  Submit Another
                </button>
              </div>
            </div>
          </PageContainer>
        </HeroSection>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div>
        <HeroSection minHeight="md">
          <PageContainer>
            <h1 className="text-gradient-gold text-3xl font-serif italic mb-4">
              Submit or Claim an Open Mic
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Sign in to submit a new open mic or claim one you host.
            </p>
            <Link
              href="/login?redirectTo=/submit-open-mic"
              className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-lg text-[var(--color-text-on-accent)] font-semibold"
            >
              Sign In to Continue
            </Link>
          </PageContainer>
        </HeroSection>

        <PageContainer>
          <div className="py-8">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Looking to update an existing listing?</h2>
            <p className="text-[var(--color-text-tertiary)] mb-4">
              Visit the open mic&apos;s detail page and use the &ldquo;Suggest updates&rdquo; form. No account needed for suggestions!
            </p>
            <Link href="/open-mics" className="text-[var(--color-text-accent)] hover:underline">
              Browse Open Mics →
            </Link>
          </div>
        </PageContainer>
      </div>
    );
  }

  // Mode selection
  if (!mode) {
    return (
      <div>
        <HeroSection minHeight="md">
          <PageContainer>
            <h1 className="text-gradient-gold text-3xl font-serif italic mb-2">
              Submit or Claim an Open Mic
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              Help keep the Denver open mic community informed and accurate.
            </p>
          </PageContainer>
        </HeroSection>

        <PageContainer>
          <div className="py-8 grid md:grid-cols-2 gap-6">
            {/* Submit New */}
            <button
              onClick={() => setMode("new")}
              className="p-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-accent-muted)] hover:bg-[var(--color-border-accent)] text-left transition"
            >
              <div className="text-3xl mb-3">🎤</div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Submit New Open Mic</h2>
              <p className="text-[var(--color-text-tertiary)] text-sm">
                Know of an open mic not in our directory? Submit it for review and we&apos;ll add it.
              </p>
            </button>

            {/* Claim Existing */}
            <button
              onClick={() => setMode("claim")}
              className="p-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-accent-muted)] hover:bg-[var(--color-border-accent)] text-left transition"
            >
              <div className="text-3xl mb-3">👑</div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Claim as Host</h2>
              <p className="text-[var(--color-text-tertiary)] text-sm">
                Are you the host of an open mic? Claim it to manage the listing and keep it updated.
              </p>
            </button>
          </div>

          <div className="py-6 border-t border-[var(--color-border-subtle)]">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Just want to suggest an update?</h3>
            <p className="text-[var(--color-text-tertiary)] mb-4">
              Visit the open mic&apos;s page and use the suggestion form. You can update times, venue info, and more.
            </p>
            <Link href="/open-mics" className="text-[var(--color-text-accent)] hover:underline">
              Browse Open Mics →
            </Link>
          </div>
        </PageContainer>
      </div>
    );
  }

  // Submit New Form
  if (mode === "new") {
    return (
      <div>
        <HeroSection minHeight="sm">
          <PageContainer>
            <button onClick={() => setMode(null)} className="text-[var(--color-text-accent)] hover:underline mb-4">
              ← Back
            </button>
            <h1 className="text-gradient-gold text-3xl font-serif italic">Submit New Open Mic</h1>
          </PageContainer>
        </HeroSection>

        <PageContainer>
          <form onSubmit={handleSubmitNew} className="py-8 max-w-2xl">
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Open Mic Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                    placeholder="e.g., Comedy Night at The Venue"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)]"
                  >
                    <option value="">Select category...</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Venue Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.venue_name}
                    onChange={(e) => handleChange("venue_name", e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Venue Address</label>
                  <input
                    type="text"
                    value={formData.venue_address}
                    onChange={(e) => handleChange("venue_address", e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)]"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Day of Week <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.day_of_week}
                    onChange={(e) => handleChange("day_of_week", e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)]"
                  >
                    <option value="">Select day...</option>
                    {DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Start Time</label>
                  <input
                    type="text"
                    value={formData.start_time}
                    onChange={(e) => handleChange("start_time", e.target.value)}
                    placeholder="e.g., 7:00 PM"
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Signup Time</label>
                  <input
                    type="text"
                    value={formData.signup_time}
                    onChange={(e) => handleChange("signup_time", e.target.value)}
                    placeholder="e.g., 6:30 PM"
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Recurrence</label>
                <input
                  type="text"
                  value={formData.recurrence_rule}
                  onChange={(e) => handleChange("recurrence_rule", e.target.value)}
                  placeholder="e.g., Every Monday, First Tuesday of month"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  placeholder="Tell us about this open mic..."
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={2}
                  placeholder="Cover charge, equipment provided, etc."
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                />
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-lg text-[var(--color-text-on-accent)] font-semibold disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Open Mic"}
              </button>
            </div>
          </form>
        </PageContainer>
      </div>
    );
  }

  // Claim Existing Form
  if (mode === "claim") {
    return (
      <div>
        <HeroSection minHeight="sm">
          <PageContainer>
            <button onClick={() => setMode(null)} className="text-[var(--color-text-accent)] hover:underline mb-4">
              ← Back
            </button>
            <h1 className="text-gradient-gold text-3xl font-serif italic">Claim as Host</h1>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Select the open mic you host to claim management access.
            </p>
          </PageContainer>
        </HeroSection>

        <PageContainer>
          <form onSubmit={handleSubmitClaim} className="py-8 max-w-2xl">
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Search Open Mics</label>
              <input
                type="text"
                value={searchExisting}
                onChange={(e) => setSearchExisting(e.target.value)}
                placeholder="Search by name or venue..."
                className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border border-[var(--color-border-input)] rounded-lg">
              {filteredEvents.length === 0 ? (
                <div className="p-4 text-[var(--color-text-tertiary)] text-center">No open mics found</div>
              ) : (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setClaimEventId(event.id)}
                    className={`w-full p-3 text-left border-b border-[var(--color-border-input)] last:border-0 hover:bg-[var(--color-accent-muted)] ${
                      claimEventId === event.id ? "bg-[var(--color-accent-primary)]/10 border-l-4 border-l-[var(--color-accent-primary)]" : ""
                    }`}
                  >
                    <div className="font-medium text-[var(--color-text-primary)]">{event.title}</div>
                    <div className="text-sm text-[var(--color-text-tertiary)]">
                      {event.venue_name} • {event.day_of_week}
                    </div>
                  </button>
                ))
              )}
            </div>

            {claimEventId && (
              <div className="mt-6">
                <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                  Tell us how you&apos;re connected to this open mic
                </label>
                <textarea
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  rows={3}
                  placeholder="I'm the host / I run this venue / etc."
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-lg text-[var(--color-text-on-accent)] font-semibold disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Claim Request"}
                </button>
              </div>
            )}
          </form>
        </PageContainer>
      </div>
    );
  }

  return null;
}
