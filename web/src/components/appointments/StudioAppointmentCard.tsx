"use client";

import { useState } from "react";
import type { StudioOwnedAppointment, AppointmentStatus } from "@/types";
import { format } from "date-fns";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function StudioAppointmentCard({ appointment }: { appointment: StudioOwnedAppointment }) {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const statusColor = {
    pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    confirmed: "text-green-400 bg-green-400/10 border-green-400/30",
    completed: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
  }[appointment.status];

  async function updateStatus(newStatus: AppointmentStatus) {
    setLoading(true);
    const { error } = await supabase
      .from("studio_appointments")
      .update({ status: newStatus })
      .eq("id", appointment.id);

    if (error) {
      alert(`Error: ${error.message}`);
      setLoading(false);
    } else {
      window.location.reload();
    }
  }

  const showConfirm = appointment.status === "pending";
  const showComplete = appointment.status === "confirmed";
  const showCancel = appointment.status === "pending" || appointment.status === "confirmed";

  return (
    <div className="card-base p-6 border border-white/10 rounded-xl">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gold-400 text-xl font-semibold">
            {appointment.service_name}
          </h3>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {appointment.performer_name ?? "Unknown Performer"}
          </p>
        </div>

        <span
          className={clsx(
            "px-3 py-1 text-sm rounded-full border font-medium",
            statusColor
          )}
        >
          {appointment.status}
        </span>
      </div>

      <p className="mt-4 text-[var(--color-text-tertiary)]">
        {format(new Date(appointment.appointment_time), "EEEE, MMM d • h:mm a")}
      </p>

      {(showConfirm || showComplete || showCancel) && (
        <div className="flex gap-2 mt-4">
          {showConfirm && (
            <button
              disabled={loading}
              onClick={() => updateStatus("confirmed")}
              className="text-sm px-3 py-2 rounded-md bg-green-600/30 text-green-400 border border-green-500/40 hover:bg-green-600/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Confirm"}
            </button>
          )}

          {showComplete && (
            <button
              disabled={loading}
              onClick={() => updateStatus("completed")}
              className="text-sm px-3 py-2 rounded-md bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Mark Completed"}
            </button>
          )}

          {showCancel && (
            <button
              disabled={loading}
              onClick={() => updateStatus("cancelled")}
              className="text-sm px-3 py-2 rounded-md bg-red-600/30 text-red-400 border border-red-500/40 hover:bg-red-600/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Cancel"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
