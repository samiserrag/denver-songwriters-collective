"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Venue {
  id: string;
  name: string;
}

interface EventEditFormProps {
  event: {
    id: string;
    title: string;
    venue_id?: string;
    venue_name?: string;
    day_of_week?: string;
    start_time?: string;
    end_time?: string;
    signup_time?: string;
    recurrence_rule?: string;
    notes?: string;
    description?: string;
    category?: string;
    status?: string;
    event_type?: string;
  };
  venues: Venue[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CATEGORIES = ["music", "comedy", "poetry", "variety", "other"];
const STATUSES = ["active", "inactive", "cancelled", "duplicate"];
const EVENT_TYPES = ["open_mic", "showcase", "song_circle", "workshop", "other"];

export default function EventEditForm({ event, venues }: EventEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [form, setForm] = useState({
    title: event.title || "",
    venue_id: event.venue_id || "",
    venue_name: event.venue_name || "",
    day_of_week: event.day_of_week || "",
    start_time: event.start_time || "",
    end_time: event.end_time || "",
    signup_time: event.signup_time || "",
    recurrence_rule: event.recurrence_rule || "",
    notes: event.notes || "",
    description: event.description || "",
    category: event.category || "",
    status: event.status || "active",
    event_type: event.event_type || "open_mic",
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    const supabase = createSupabaseBrowserClient();
    
    const { error: updateError } = await supabase
      .from("events")
      .update({
        title: form.title,
        venue_id: form.venue_id || null,
        venue_name: form.venue_name,
        day_of_week: form.day_of_week,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        signup_time: form.signup_time || null,
        recurrence_rule: form.recurrence_rule,
        notes: form.notes,
        description: form.description,
        category: form.category,
        status: form.status,
        event_type: form.event_type,
      })
      .eq("id", event.id);
    
    setSaving(false);
    
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/admin/events"), 1500);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green-900/50 border border-green-500 rounded text-green-200 text-sm">
          Event updated! Redirecting...
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">Title *</label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Venue</label>
          <select
            name="venue_id"
            value={form.venue_id}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          >
            <option value="">Select venue...</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Venue Name (override)</label>
          <input
            type="text"
            name="venue_name"
            value={form.venue_name}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Day of Week</label>
          <select
            name="day_of_week"
            value={form.day_of_week}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          >
            <option value="">Select day...</option>
            {DAYS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Event Type</label>
          <select
            name="event_type"
            value={form.event_type}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          >
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Start Time</label>
          <input
            type="text"
            name="start_time"
            value={form.start_time}
            onChange={handleChange}
            placeholder="19:00:00"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">Format: HH:MM:SS</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">End Time</label>
          <input
            type="text"
            name="end_time"
            value={form.end_time}
            onChange={handleChange}
            placeholder="22:00:00"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">Format: HH:MM:SS</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Signup Time</label>
          <input
            type="text"
            name="signup_time"
            value={form.signup_time}
            onChange={handleChange}
            placeholder="6:30 PM"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">Recurrence Rule</label>
        <input
          type="text"
          name="recurrence_rule"
          value={form.recurrence_rule}
          onChange={handleChange}
          placeholder="Every Monday, 1st and 3rd Tuesday, etc."
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Category</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          >
            <option value="">Select category...</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
        />
      </div>
      
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 rounded text-white font-medium"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        
        <button
          type="button"
          onClick={() => router.push("/dashboard/admin/events")}
          className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
