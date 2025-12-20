"use client";

import { useEffect } from "react";

// Event types that default to timeslot mode
const TIMESLOT_EVENT_TYPES = ["open_mic", "showcase"];

interface SlotConfig {
  has_timeslots: boolean;
  total_slots: number;
  slot_duration_minutes: number;
  allow_guests: boolean;
}

interface SlotConfigSectionProps {
  eventType: string;
  config: SlotConfig;
  onChange: (config: SlotConfig) => void;
  disabled?: boolean;
}

export default function SlotConfigSection({
  eventType,
  config,
  onChange,
  disabled = false,
}: SlotConfigSectionProps) {
  // Auto-enable timeslots for open_mic and showcase
  // Note: We intentionally only depend on eventType to avoid loops when onChange updates config
  useEffect(() => {
    const shouldEnableTimeslots = TIMESLOT_EVENT_TYPES.includes(eventType);
    if (shouldEnableTimeslots && !config.has_timeslots) {
      onChange({
        ...config,
        has_timeslots: true,
        total_slots: eventType === "open_mic" ? 10 : 8,
        slot_duration_minutes: eventType === "open_mic" ? 10 : 15,
      });
    } else if (!shouldEnableTimeslots && config.has_timeslots) {
      // When switching away from timeslot types, reset to RSVP mode
      onChange({
        ...config,
        has_timeslots: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  const handleToggle = () => {
    onChange({
      ...config,
      has_timeslots: !config.has_timeslots,
    });
  };

  const handleChange = (field: keyof SlotConfig, value: number | boolean) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const isTimeslotType = TIMESLOT_EVENT_TYPES.includes(eventType);

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              {config.has_timeslots ? "Performance Slots" : "RSVP Mode"}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {config.has_timeslots
                ? "Performers claim individual time slots to perform."
                : "Attendees RSVP for attendance, no performance slots."}
            </p>
            {isTimeslotType && (
              <p className="text-xs text-[var(--color-accent-primary)] mt-1">
                Recommended for {eventType === "open_mic" ? "Open Mic" : "Showcase"} events
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.has_timeslots
                ? "bg-[var(--color-accent-primary)]"
                : "bg-[var(--color-bg-secondary)]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            role="switch"
            aria-checked={config.has_timeslots}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.has_timeslots ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Slot Configuration (only shown when timeslots enabled) */}
      {config.has_timeslots && (
        <div className="space-y-4 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
            Slot Configuration
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Slots */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Number of Slots
              </label>
              <input
                type="number"
                value={config.total_slots}
                onChange={(e) =>
                  handleChange("total_slots", Math.max(1, parseInt(e.target.value) || 1))
                }
                min="1"
                max="50"
                disabled={disabled}
                className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Total performance slots available
              </p>
            </div>

            {/* Slot Duration */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Slot Duration (minutes)
              </label>
              <select
                value={config.slot_duration_minutes}
                onChange={(e) =>
                  handleChange("slot_duration_minutes", parseInt(e.target.value))
                }
                disabled={disabled}
                className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none disabled:opacity-50"
              >
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Time per performer
              </p>
            </div>
          </div>

          {/* Allow Guests Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h5 className="text-sm font-medium text-[var(--color-text-primary)]">
                Allow Guest Sign-ups
              </h5>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Non-members can claim slots via email verification
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleChange("allow_guests", !config.allow_guests)}
              disabled={disabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.allow_guests
                  ? "bg-[var(--color-accent-primary)]"
                  : "bg-[var(--color-bg-tertiary)]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              role="switch"
              aria-checked={config.allow_guests}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.allow_guests ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-[var(--color-accent-primary)]/10 border border-[var(--color-border-accent)] rounded-lg">
            <p className="text-xs text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">How it works:</strong>{" "}
              {config.total_slots} slots × {config.slot_duration_minutes} minutes ={" "}
              {config.total_slots * config.slot_duration_minutes} minutes of performances.
              Slots are first-come, first-served. Each performer can claim one slot.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export { TIMESLOT_EVENT_TYPES };
export type { SlotConfig };
