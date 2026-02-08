"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

interface VenueSelectorProps {
  venues: Venue[];
  selectedVenueId: string;
  onVenueChange: (venueId: string) => void;
  onVenueCreated?: (venue: Venue) => void;
  onCustomLocationSelect?: () => void;
  showCustomLocationOption?: boolean;
  isCustomLocationSelected?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Phase 4.45b: Only show "Add new venue" if user can create venues (admin only) */
  canCreateVenue?: boolean;
}

const initialNewVenue = {
  name: "",
  address: "",
  city: "Denver",
  state: "CO",
  zip: "",
  phone: "",
  website_url: "",
  google_maps_url: "",
};

export default function VenueSelector({
  venues,
  selectedVenueId,
  onVenueChange,
  onVenueCreated,
  onCustomLocationSelect,
  showCustomLocationOption = false,
  isCustomLocationSelected = false,
  required = false,
  disabled = false,
  canCreateVenue = false,
}: VenueSelectorProps) {
  const [showNewVenueForm, setShowNewVenueForm] = useState(false);
  const [newVenue, setNewVenue] = useState(initialNewVenue);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!newVenue.name.trim()) {
      setError("Venue name is required");
      return;
    }

    if (!newVenue.address.trim()) {
      setError("Address is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: insertError } = await supabase
        .from("venues")
        .insert({
          name: newVenue.name.trim(),
          address: newVenue.address.trim(),
          city: newVenue.city.trim() || "Denver",
          state: newVenue.state.trim() || "CO",
          zip: newVenue.zip.trim() || null,
          phone: newVenue.phone.trim() || null,
          website_url: newVenue.website_url.trim() || null,
          google_maps_url: newVenue.google_maps_url.trim() || null,
        })
        .select("id, name, address, city, state")
        .single();

      if (insertError) throw insertError;

      // Select the newly created venue
      onVenueChange(data.id);

      // Notify parent so it can update the venues list
      if (onVenueCreated) {
        onVenueCreated(data);
      }

      // Reset and close form
      setNewVenue(initialNewVenue);
      setShowNewVenueForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setCreating(false);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "__new__") {
      setShowNewVenueForm(true);
    } else if (value === "__custom__") {
      setShowNewVenueForm(false);
      if (onCustomLocationSelect) {
        onCustomLocationSelect();
      }
    } else {
      onVenueChange(value);
      setShowNewVenueForm(false);
    }
  };

  // Determine the current dropdown value
  const getSelectValue = () => {
    if (showNewVenueForm) return "__new__";
    if (isCustomLocationSelected) return "__custom__";
    return selectedVenueId;
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-2">
          {required ? (
            <>
              <span className="text-red-500">Location</span>
              <span className="ml-1 text-red-400 text-xs font-normal">*Required</span>
            </>
          ) : (
            <span className="text-[var(--color-text-secondary)]">Location</span>
          )}
        </label>
        <select
          value={getSelectValue()}
          onChange={handleSelectChange}
          required={required && !showNewVenueForm && !isCustomLocationSelected}
          disabled={disabled || creating}
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none disabled:opacity-50"
        >
          <option value="">Select a venue...</option>
          {/* Phase 4.45b: Actions at TOP of dropdown for discoverability */}
          {canCreateVenue && (
            <option value="__new__">+ Add new venue...</option>
          )}
          {showCustomLocationOption && (
            <option value="__custom__">✎ Custom location (this happening only)...</option>
          )}
          {(canCreateVenue || showCustomLocationOption) && (
            <option disabled className="text-[var(--color-text-secondary)]">──────────────</option>
          )}
          {/* Venues list (A-Z) */}
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.city && v.city !== "UNKNOWN" ? ` — ${v.city}` : ""}
            </option>
          ))}
        </select>
        {/* Phase 4.45b: Helper text for non-admins */}
        {!canCreateVenue && showCustomLocationOption && (
          <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
            Can&apos;t find your venue? Use <strong>Custom Location</strong> for one-time or approximate locations.{" "}
            <a
              href="mailto:hello@coloradosongwriterscollective.org?subject=Venue%20Issue%20Report"
              className="text-[var(--color-link)] hover:underline"
            >
              Report a venue issue
            </a>
          </p>
        )}
      </div>

      {showNewVenueForm && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-accent)]/20 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-accent)]">New Venue</h4>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Creates a reusable venue for future events
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewVenueForm(false);
                setNewVenue(initialNewVenue);
                setError(null);
              }}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Venue name *"
                value={newVenue.name}
                onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                disabled={creating}
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Street address *"
                value={newVenue.address}
                onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                disabled={creating}
              />
            </div>
            <input
              type="text"
              placeholder="City"
              value={newVenue.city}
              onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              disabled={creating}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="State"
                value={newVenue.state}
                onChange={(e) => setNewVenue({ ...newVenue, state: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                disabled={creating}
              />
              <input
                type="text"
                placeholder="ZIP"
                value={newVenue.zip}
                onChange={(e) => setNewVenue({ ...newVenue, zip: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                disabled={creating}
              />
            </div>
            <input
              type="text"
              placeholder="Phone (optional)"
              value={newVenue.phone}
              onChange={(e) => setNewVenue({ ...newVenue, phone: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              disabled={creating}
            />
            <input
              type="url"
              placeholder="Website URL (optional)"
              value={newVenue.website_url}
              onChange={(e) => setNewVenue({ ...newVenue, website_url: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              disabled={creating}
            />
            <div className="md:col-span-2">
              <input
                type="url"
                placeholder="Google Maps URL (optional)"
                value={newVenue.google_maps_url}
                onChange={(e) => setNewVenue({ ...newVenue, google_maps_url: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                disabled={creating}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateVenue}
            disabled={creating || !newVenue.name.trim() || !newVenue.address.trim()}
            className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[var(--color-background)] text-sm font-medium transition-colors"
          >
            {creating ? "Creating..." : "Create Venue"}
          </button>
        </div>
      )}
    </div>
  );
}
