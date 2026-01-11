"use client";

/**
 * Google Maps Helper
 *
 * Helps admins find Google Maps URLs for venues.
 * Select a venue, get a search URL, copy the place URL back.
 */

import { useState, useEffect } from "react";
import {
  generateGoogleMapsSearchUrl,
  getVenueSearchSummary,
} from "@/lib/ops/googleMapsHelper";

interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  google_maps_url: string | null;
}

export default function GoogleMapsHelper() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchVenues() {
      try {
        const response = await fetch("/api/admin/venues");
        if (response.ok) {
          const data = await response.json();
          // Sort by name and filter to those without google_maps_url
          const sorted = data
            .filter((v: Venue) => !v.google_maps_url)
            .sort((a: Venue, b: Venue) => a.name.localeCompare(b.name));
          setVenues(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch venues:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, []);

  const selectedVenue = venues.find((v) => v.id === selectedId);
  const searchUrl = selectedVenue
    ? generateGoogleMapsSearchUrl(selectedVenue)
    : "";
  const summary = selectedVenue ? getVenueSearchSummary(selectedVenue) : "";

  const handleCopy = async () => {
    if (!searchUrl) return;
    try {
      await navigator.clipboard.writeText(searchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <p className="text-[var(--color-text-secondary)]">Loading venues...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        Google Maps URL Helper
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Generate search URLs to find venues on Google Maps. Copy the place URL
        and add it to your CSV.
      </p>

      {venues.length === 0 ? (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded text-green-400">
          All venues have Google Maps URLs!
        </div>
      ) : (
        <div className="space-y-4">
          {/* Venue Dropdown */}
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Select venue without Google Maps URL ({venues.length} remaining)
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            >
              <option value="">-- Select a venue --</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Venue Info */}
          {selectedVenue && (
            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded">
              <p className="text-[var(--color-text-secondary)] text-sm mb-2">
                Search query: <span className="text-[var(--color-text-primary)]">{summary}</span>
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-text-on-accent)] font-medium text-sm"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[var(--color-accent-primary)] hover:underline text-sm"
                >
                  Open in Google Maps →
                </a>
                <p className="text-[var(--color-text-tertiary)] text-xs">
                  Once you find the venue, copy the URL from your browser and
                  paste it into the google_maps_url column in your CSV.
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-[var(--color-text-tertiary)] text-xs space-y-1">
            <p>
              <strong>Workflow:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Export venues to CSV</li>
              <li>Select a venue above and open the search URL</li>
              <li>Find the correct place in Google Maps</li>
              <li>Copy the place URL from your browser</li>
              <li>Paste it into the google_maps_url column in your CSV</li>
              <li>Import the updated CSV</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
