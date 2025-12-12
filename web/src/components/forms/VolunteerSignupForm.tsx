"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const VOLUNTEER_ROLES = [
  { id: "event_setup", label: "Event Setup & Breakdown" },
  { id: "door_greeter", label: "Door Greeter & Check-in" },
  { id: "sound_tech", label: "Sound & Tech Support" },
  { id: "photography", label: "Photography & Videography" },
  { id: "social_media", label: "Social Media & Promotion" },
  { id: "website_testing", label: "Website Testing & Feedback" },
  { id: "outreach", label: "Venue & Partner Outreach" },
  { id: "hosting", label: "Open Mic Hosting" },
  { id: "other", label: "Other (describe below)" },
];

const AVAILABILITY_OPTIONS = [
  { id: "weekday_evenings", label: "Weekday Evenings" },
  { id: "friday_nights", label: "Friday Nights" },
  { id: "saturday_nights", label: "Saturday Nights" },
  { id: "weekend_afternoons", label: "Weekend Afternoons" },
  { id: "flexible", label: "Flexible Schedule" },
];

export function VolunteerSignupForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    roles: [] as string[],
    availability: [] as string[],
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter((r) => r !== roleId)
        : [...prev.roles, roleId],
    }));
  };

  const handleAvailabilityToggle = (availId: string) => {
    setFormData((prev) => ({
      ...prev,
      availability: prev.availability.includes(availId)
        ? prev.availability.filter((a) => a !== availId)
        : [...prev.availability, availId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { error: insertError } = await supabase.from("volunteer_signups").insert({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        preferred_roles: formData.roles,
        availability: formData.availability,
        notes: formData.notes || null,
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        roles: [],
        availability: [],
        notes: "",
      });
    } catch (err) {
      console.error("Volunteer signup error:", err);
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 p-8 text-center space-y-4">
        <div className="text-4xl">Thank you for signing up to volunteer with DSC. We will be in touch soon.</div>
        <h3 className="text-xl font-semibold text-white">Thank You!</h3>
        <p className="text-neutral-300">
          We have received your volunteer sign-up. Someone from DSC will reach out to you soon.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 px-4 py-2 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-400)] underline"
        >
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded-lg text-white focus:border-[var(--color-gold)] focus:outline-none"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded-lg text-white focus:border-[var(--color-gold)] focus:outline-none"
            placeholder="your@email.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-neutral-300 mb-1">
          Phone <span className="text-neutral-500">(optional)</span>
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded-lg text-white focus:border-[var(--color-gold)] focus:outline-none"
          placeholder="(303) 555-1234"
        />
      </div>

      <div>
        <label className="block text-sm text-neutral-300 mb-3">
          What would you like to help with? <span className="text-neutral-500">(select all that apply)</span>
        </label>
        <div className="grid sm:grid-cols-2 gap-2">
          {VOLUNTEER_ROLES.map((role) => (
            <label
              key={role.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                formData.roles.includes(role.id)
                  ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10"
                  : "border-neutral-700 hover:border-neutral-500"
              }`}
            >
              <input
                type="checkbox"
                checked={formData.roles.includes(role.id)}
                onChange={() => handleRoleToggle(role.id)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border flex items-center justify-center ${
                  formData.roles.includes(role.id)
                    ? "bg-[var(--color-gold)] border-[var(--color-gold)]"
                    : "border-neutral-500"
                }`}
              >
                {formData.roles.includes(role.id) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-neutral-200">{role.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-neutral-300 mb-3">
          When are you generally available? <span className="text-neutral-500">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleAvailabilityToggle(option.id)}
              className={`px-4 py-2 rounded-full border text-sm transition ${
                formData.availability.includes(option.id)
                  ? "border-[var(--color-gold)] bg-[var(--color-gold)]/20 text-[var(--color-gold)]"
                  : "border-neutral-600 text-neutral-300 hover:border-neutral-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-neutral-300 mb-1">
          Anything else you would like us to know?
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded-lg text-white focus:border-[var(--color-gold)] focus:outline-none resize-none"
          placeholder="Special skills, experience, or anything else you want to share..."
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] rounded-lg text-[var(--color-background)] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting..." : "Sign Up to Volunteer"}
      </button>
    </form>
  );
}
