"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

interface BookStudioFormProps {
  serviceId: string;
  serviceName: string;
  durationMin: number;
  priceCents: number;
}

export default function BookStudioForm({
  serviceId,
  serviceName,
  durationMin,
  priceCents,
}: BookStudioFormProps) {
  const supabase = createSupabaseBrowserClient();
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!date || !time) {
      setError("Please select a date and time.");
      return;
    }

    setLoading(true);

    const desiredTimestamp = new Date(`${date}T${time}`).toISOString();

    const { error } = await supabase.rpc("rpc_book_studio_service", {
      service_id: serviceId,
      desired_time: desiredTimestamp,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Unable to book this service.");
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="card-base p-8 max-w-lg mx-auto">
      <h2 className="text-gradient-gold text-3xl font-[var(--font-family-serif)] italic mb-6">
        Book: {serviceName}
      </h2>

      <p className="text-[var(--color-text-secondary)] mb-4">
        Duration: <span className="text-gold-400">{durationMin} min</span>
      </p>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Price:{" "}
        <span className="text-gold-400">
          ${(priceCents / 100).toFixed(2)}
        </span>
      </p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-sm text-[var(--color-text-tertiary)] mb-1">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-[var(--color-text-primary)]"
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-tertiary)] mb-1">Time</label>
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-[var(--color-text-primary)]"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {success && (
          <p className="text-green-400 text-sm">
            Booking successful! Your appointment is now pending.
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Booking..." : "Book Now"}
        </Button>
      </form>
    </div>
  );
}
