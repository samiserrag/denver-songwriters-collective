"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import type { MapPinData } from "@/lib/map";
import { MapPinPopup } from "./MapPinPopup";

interface MapVenueSheetProps {
  pin: MapPinData | null;
  onClose: () => void;
}

/**
 * Mobile bottom sheet for displaying venue details on map.
 *
 * Phase 1.3: Provides touch-friendly alternative to Leaflet popup on mobile.
 * Uses same MapPinPopup content as desktop for consistency.
 *
 * Features:
 * - Slides up from bottom on mobile
 * - Blocks map interaction via backdrop
 * - Focus trapping for accessibility
 * - Escape key to close
 * - Body scroll lock when open
 */
export function MapVenueSheet({ pin, onClose }: MapVenueSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!pin) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [pin, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!pin) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [pin]);

  // Focus management
  useEffect(() => {
    if (!pin) return;

    // Store currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the sheet
    if (sheetRef.current) {
      sheetRef.current.focus();
    }

    return () => {
      // Restore focus on close
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [pin]);

  // Focus trap
  useEffect(() => {
    if (!pin || !sheetRef.current) return;

    const sheet = sheetRef.current;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    sheet.addEventListener("keydown", handleTab);
    return () => sheet.removeEventListener("keydown", handleTab);
  }, [pin]);

  if (!pin) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      data-testid="map-venue-sheet-container"
    >
      {/* Backdrop - blocks map interaction */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="map-venue-sheet-backdrop"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${pin.venueName} venue details`}
        tabIndex={-1}
        className="relative bg-white rounded-t-xl w-full max-h-[60vh] overflow-y-auto animate-slide-up"
        data-testid="map-venue-sheet"
      >
        {/* Drag handle indicator */}
        <div className="sticky top-0 bg-white pt-3 pb-2 px-4 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{pin.venueName}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - reuses MapPinPopup for consistency */}
        <div className="p-4">
          <MapPinPopup pin={pin} />
        </div>
      </div>
    </div>
  );
}

export default MapVenueSheet;
