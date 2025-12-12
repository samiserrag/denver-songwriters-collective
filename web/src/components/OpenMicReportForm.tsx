"use client";

import React, { useState } from "react";

export default function OpenMicReportForm({ eventId }: { eventId?: string | null }) {
  const [field, setField] = useState("title");
  const [newValue, setNewValue] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/event-update-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, field, new_value: newValue, notes }),
      });
      if (res.ok) {
        setStatus('Submitted — thank you!');
        setField('title');
        setNewValue('');
        setNotes('');
      } else {
        const json = await res.json();
        setStatus(json?.error ?? 'Submission failed');
      }
    } catch (err) {
      setStatus('Submission failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-4 rounded-lg bg-neutral-900">
      <div className="mb-3">
        <label className="block text-sm text-neutral-300">Field</label>
        <select value={field} onChange={(e) => setField(e.target.value)} className="mt-1 w-full bg-neutral-800 p-2 rounded">
          <option value="title">Title</option>
          <option value="description">Description</option>
          <option value="venue_name">Venue name</option>
          <option value="start_time">Start time</option>
          <option value="day_of_week">Day of week</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-neutral-300">Corrected value</label>
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} className="mt-1 w-full bg-neutral-800 p-2 rounded" />
      </div>

      <div className="mb-3">
        <label className="block text-sm text-neutral-300">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full bg-neutral-800 p-2 rounded" />
      </div>

      <div className="flex items-center gap-3">
        <button disabled={loading} className="px-4 py-2 bg-[var(--color-gold)] rounded text-[var(--color-background)] font-medium">{loading ? 'Submitting...' : 'Submit'}</button>
        {status && <div className="text-sm text-neutral-300">{status}</div>}
      </div>
    </form>
  );
}
