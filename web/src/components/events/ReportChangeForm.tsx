"use client";

import { useState } from "react";

interface Props {
  eventId: string;
  eventTitle: string;
}

const FIELD_OPTIONS = [
  { value: "title", label: "Event Name" },
  { value: "venue_name", label: "Venue Name" },
  { value: "venue_address", label: "Venue Address" },
  { value: "day_of_week", label: "Day of Week" },
  { value: "start_time", label: "Start Time" },
  { value: "end_time", label: "End Time" },
  { value: "signup_time", label: "Signup Time" },
  { value: "description", label: "Description" },
  { value: "status", label: "Status (closed, cancelled, etc.)" },
  { value: "other", label: "Other" },
];

export default function ReportChangeForm({ eventId, eventTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [fieldName, setFieldName] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/change-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          field_name: fieldName,
          proposed_value: proposedValue,
          notes: notes || undefined,
          reporter_email: reporterEmail || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit report");
      }

      setSuccess(true);
      setIsOpen(false);
      // Reset form
      setFieldName("");
      setProposedValue("");
      setNotes("");
      setReporterEmail("");
    } catch (err) {
      console.error("Submission error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-center">
        <p className="text-green-300 font-medium">Thanks! A human will review this.</p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-2 text-sm text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] underline"
        >
          Report another change
        </button>
      </div>
    );
  }

  return (
    <div>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Report a change
        </button>
      ) : (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Report a Change</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-[var(--color-text-secondary)] text-sm mb-4">
            Help keep &quot;{eventTitle}&quot; up to date. Report any incorrect information.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                What needs to be changed? <span className="text-red-400">*</span>
              </label>
              <select
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              >
                <option value="">Select a field...</option>
                {FIELD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                What should it say? <span className="text-red-400">*</span>
              </label>
              <textarea
                value={proposedValue}
                onChange={(e) => setProposedValue(e.target.value)}
                required
                maxLength={500}
                rows={2}
                placeholder="Enter the correct information..."
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {proposedValue.length}/500 characters
              </p>
            </div>

            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Additional notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="How do you know this? Any helpful context..."
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Your email (optional)
              </label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="We may follow up if we have questions"
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !fieldName || !proposedValue}
                className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-background)] font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border-default)] rounded text-[var(--color-text-primary)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
