"use client";

import { useState } from "react";
import type { PerformerAppointment } from "@/types";
import { format } from "date-fns";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AppointmentCardProps {
  appt: PerformerAppointment;
}

export function AppointmentCard({ appt }: AppointmentCardProps) {
  const dateStr = format(new Date(appt.appointment_time), "EEEE, MMM d • h:mm a");
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const canCancel = appt.status === "pending" || appt.status === "confirmed";

  async function handleCancel() {
    setLoading(true);
    const { error } = await supabase
      .from("studio_appointments")
      .update({ status: "cancelled" })
      .eq("id", appt.id);

    if (error) {
      alert(`Error: ${error.message}`);
      setLoading(false);
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="card-base p-6 flex flex-col gap-3 border border-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gold-400">{appt.service_name}</h3>
        <span
          className={
            "text-sm px-3 py-1 rounded-full " +
            (appt.status === "pending"
              ? "bg-yellow-500/20 text-yellow-300"
              : appt.status === "confirmed"
              ? "bg-green-500/20 text-green-300"
              : appt.status === "completed"
              ? "bg-blue-500/20 text-blue-300"
              : "bg-red-500/20 text-red-300")
          }
        >
          {appt.status}
        </span>
      </div>

      <p className="text-[var(--color-text-secondary)] text-sm">
        Studio: <span className="text-[var(--color-text-primary)]">{appt.studio_name}</span>
      </p>

      <p className="text-[var(--color-text-tertiary)] text-sm">
        Appointment: {dateStr}
      </p>

      {canCancel && (
        <button
          disabled={loading}
          onClick={handleCancel}
          className="text-sm mt-2 px-3 py-2 rounded-md bg-red-600/30 text-red-400 border border-red-500/40 hover:bg-red-600/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Cancelling..." : "Cancel Appointment"}
        </button>
      )}
    </div>
  );
}
