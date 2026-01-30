"use client";

/**
 * Phase 1.0: Map View Component
 *
 * Renders happenings as clustered map pins using Leaflet + OpenStreetMap.
 * Groups multiple events at the same venue into a single pin.
 *
 * STOP-GATE 1 Contract:
 * - One pin per venue (multiple events grouped)
 * - Max 500 pins before showing fallback message
 * - Center on Denver (39.7392, -104.9903), zoom 11
 * - Uses react-leaflet for React integration
 * - Uses leaflet.markercluster for pin clustering
 */

import * as React from "react";
import { useEffect, useState } from "react";
import type { MapPinData, MapPinResult } from "@/lib/map";
import { MAP_DEFAULTS } from "@/lib/map";
import { MapPinPopup } from "./MapPinPopup";

// Leaflet CSS must be imported for proper rendering
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

interface MapViewProps {
  pinResult: MapPinResult;
  className?: string;
}

/**
 * MapView - Main map component
 *
 * Dynamically imports Leaflet components to avoid SSR issues.
 * Shows a fallback message if pin limit is exceeded.
 */
export function MapView({ pinResult, className }: MapViewProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{
    pins: MapPinData[];
  }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamically import Leaflet components (client-side only)
  useEffect(() => {
    async function loadMap() {
      try {
        const { MapContainer, TileLayer, Marker, Popup, Tooltip } = await import("react-leaflet");
        const L = await import("leaflet");
        const { default: MarkerClusterGroup } = await import("react-leaflet-cluster");

        // Fix Leaflet default marker icon issue in Next.js
        // Use local icons from /public/leaflet/ to avoid CSP issues with external CDNs
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "/leaflet/marker-icon-2x.png",
          iconUrl: "/leaflet/marker-icon.png",
          shadowUrl: "/leaflet/marker-shadow.png",
        });

        // Create the inner map component
        const InnerMap = ({ pins }: { pins: MapPinData[] }) => (
          <MapContainer
            center={[MAP_DEFAULTS.CENTER.lat, MAP_DEFAULTS.CENTER.lng]}
            zoom={MAP_DEFAULTS.ZOOM}
            className="h-full w-full rounded-xl"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MarkerClusterGroup
              chunkedLoading
              showCoverageOnHover={true}
              spiderfyOnMaxZoom={true}
              removeOutsideVisibleBounds={true}
              maxClusterRadius={60}
            >
              {pins.map((pin) => (
                <Marker key={pin.venueId} position={[pin.latitude, pin.longitude]}>
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                    <span className="font-medium">{pin.venueName}</span>
                    <br />
                    <span className="text-xs text-gray-500">
                      {pin.events.length} happening{pin.events.length !== 1 ? "s" : ""}
                    </span>
                  </Tooltip>
                  <Popup>
                    <MapPinPopup pin={pin} />
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        );

        setMapComponent(() => InnerMap);
      } catch (error) {
        console.error("[MapView] Failed to load Leaflet:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMap();
  }, []);

  // Show limit exceeded message
  if (pinResult.limitExceeded) {
    return (
      <div className={className}>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Too many happenings to display on map
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-4">
            There are more than {MAP_DEFAULTS.MAX_PINS} venues with happenings.
            Try using filters to narrow down your search.
          </p>
          <div className="text-sm text-[var(--color-text-muted)]">
            {pinResult.totalProcessed} happenings processed
            {pinResult.excludedOnlineOnly > 0 && (
              <> · {pinResult.excludedOnlineOnly} online-only excluded</>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl h-[500px] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-[var(--color-text-secondary)]">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (pinResult.pins.length === 0) {
    return (
      <div className={className}>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📍</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            No happenings to show on map
          </h3>
          <p className="text-[var(--color-text-secondary)]">
            {pinResult.excludedOnlineOnly > 0
              ? `${pinResult.excludedOnlineOnly} online-only happenings were excluded from the map.`
              : "Try adjusting your filters to see more happenings."}
          </p>
          {pinResult.excludedMissingCoords > 0 && (
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              {pinResult.excludedMissingCoords} happening{pinResult.excludedMissingCoords !== 1 ? "s" : ""} with no venue assigned
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render the map
  return (
    <div className={className}>
      {/* Stats bar */}
      <div className="mb-3 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <span>
          {pinResult.pins.length} venue{pinResult.pins.length !== 1 ? "s" : ""} with{" "}
          {pinResult.pins.reduce((sum, pin) => sum + pin.events.length, 0)} happening
          {pinResult.pins.reduce((sum, pin) => sum + pin.events.length, 0) !== 1 ? "s" : ""}
        </span>
        {(pinResult.excludedOnlineOnly > 0 || pinResult.excludedMissingCoords > 0) && (
          <span className="text-[var(--color-text-muted)]">
            {pinResult.excludedOnlineOnly > 0 && (
              <>{pinResult.excludedOnlineOnly} online-only</>
            )}
            {pinResult.excludedOnlineOnly > 0 && pinResult.excludedMissingCoords > 0 && " · "}
            {pinResult.excludedMissingCoords > 0 && (
              <>{pinResult.excludedMissingCoords} no venue assigned</>
            )}
          </span>
        )}
      </div>

      {/* Map container */}
      <div className="h-[500px] md:h-[600px] rounded-xl overflow-hidden border border-[var(--color-border-default)]">
        {MapComponent && <MapComponent pins={pinResult.pins} />}
      </div>
    </div>
  );
}

export default MapView;
