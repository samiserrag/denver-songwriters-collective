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
  /** Optional attendance capacity (null = unlimited) */
  capacity: number | null;
  onCapacityChange: (capacity: number | null) => void;
}

export default function SlotConfigSection({
  eventType,
  config,
  onChange,
  disabled = false,
  capacity,
  onCapacityChange,
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
      // When switching away from timeslot types, disable timeslots
      onChange({
        ...config,
        has_timeslots: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  const handleTimeslotsToggle = () => {
    if (config.has_timeslots) {
      // Turning off
      onChange({
        ...config,
        has_timeslots: false,
      });
    } else {
      // Turning on
      onChange({
        ...config,
        has_timeslots: true,
        total_slots: eventType === "open_mic" ? 10 : 8,
        slot_duration_minutes: eventType === "open_mic" ? 10 : 15,
      });
    }
  };

  const handleChange = (field: keyof SlotConfig, value: number | boolean) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const isTimeslotType = TIMESLOT_EVENT_TYPES.includes(eventType);

  return (
    <div className="space-y-6">
      {/* Phase 4.46: Section Header - "Join & Signup" */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">🎤</span>
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Join &amp; Signup
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            How attendees and performers interact with your event
          </p>
        </div>
      </div>

      {/* Phase 4.46: Audience RSVP Subsection (always visible) */}
      <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">👥</span>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Audience RSVP
          </h4>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Always Available
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          RSVPs let attendees say they&apos;re coming. This is not a performer sign-up.
        </p>

        {/* Attendance Cap */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Attendance Cap (optional)
          </label>
          <input
            type="number"
            value={capacity ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                onCapacityChange(null);
              } else {
                const num = parseInt(val);
                if (!isNaN(num) && num > 0) {
                  onCapacityChange(num);
                }
              }
            }}
            placeholder="Leave blank for unlimited"
            min="1"
            disabled={disabled}
            className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Maximum RSVPs allowed. Leave blank for unlimited attendance.
          </p>
        </div>
      </div>

      {/* Phase 4.46: Performer Slots Subsection (optional) */}
      <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">🎸</span>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Performer Slots
              </h4>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]">
                Optional
              </span>
              {isTimeslotType && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30">
                  Recommended for {eventType === "open_mic" ? "Open Mic" : "Showcase"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Allow performers to claim time slots. Great for open mics and showcases.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTimeslotsToggle}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 ${
              config.has_timeslots
                ? "bg-[var(--color-accent-primary)]"
                : "bg-[var(--color-bg-tertiary)]"
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

        {/* Slot Configuration (only shown when timeslots enabled) */}
        {config.has_timeslots && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border-default)] space-y-4">
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
              </div>

              {/* Slot Duration */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Slot Duration
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
              </div>
            </div>

            {/* Allow Guests Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm font-medium text-[var(--color-text-primary)]">
                  Allow Guest Sign-ups
                </h5>
                <p className="text-sm text-[var(--color-text-secondary)]">
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
          </div>
        )}
      </div>

      {/* Phase 4.46: Mini Preview */}
      <div className="p-4 bg-[var(--color-accent-primary)]/5 border border-[var(--color-border-accent)] rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📋</span>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Preview: What attendees will see
          </h4>
        </div>
        <div className="space-y-2">
          {/* RSVP availability line */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-400">✓</span>
            <span className="text-[var(--color-text-primary)]">
              RSVP Available
              {capacity ? (
                <span className="text-[var(--color-text-secondary)]"> ({capacity} spots)</span>
              ) : (
                <span className="text-[var(--color-text-secondary)]"> (unlimited)</span>
              )}
            </span>
          </div>
          {/* Performer slots line (only if enabled) */}
          {config.has_timeslots && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-accent-primary)]">🎤</span>
              <span className="text-[var(--color-text-primary)]">
                {config.total_slots} performer slots
                <span className="text-[var(--color-text-secondary)]"> ({config.slot_duration_minutes} min each)</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { TIMESLOT_EVENT_TYPES };
export type { SlotConfig };
