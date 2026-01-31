"use client";

import * as React from "react";

interface LineupStateBannerProps {
  lastUpdated: Date | null;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  /** Whether to show a subtle version (for TV display) or prominent version (for control page) */
  variant?: "prominent" | "subtle";
  /** Phase 4.100: Show "Connection restored" banner temporarily after recovery */
  showRecovered?: boolean;
  /** Phase 4.100: Show extended hint after 5+ minutes disconnected (display only) */
  showExtendedHint?: boolean;
}

/**
 * Shows connection health and last-updated timestamp for lineup polling.
 *
 * Phase 4.99: Required for live event reliability and host trust.
 */
export function LineupStateBanner({
  lastUpdated,
  connectionStatus,
  variant = "prominent",
  showRecovered = false,
  showExtendedHint = false,
}: LineupStateBannerProps) {
  const [secondsAgo, setSecondsAgo] = React.useState(0);

  // Update "seconds ago" every second
  React.useEffect(() => {
    if (!lastUpdated) return;

    const updateSeconds = () => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      setSecondsAgo(diff);
    };

    updateSeconds();
    const interval = setInterval(updateSeconds, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 120) return "1 min ago";
    return `${Math.floor(seconds / 60)} mins ago`;
  };

  if (variant === "subtle") {
    // Subtle version for TV display - only show warnings and recovery
    // Phase 4.100: Show recovered banner when transitioning from disconnected
    if (showRecovered) {
      return (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm bg-green-900/80 text-green-200">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Connection restored
          </span>
        </div>
      );
    }

    if (connectionStatus === "connected" && secondsAgo < 15) {
      return null; // Hide when everything is fine
    }

    return (
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 items-end">
        <div className={`px-3 py-2 rounded-lg text-sm ${
          connectionStatus === "disconnected"
            ? "bg-red-900/80 text-red-200"
            : connectionStatus === "reconnecting"
            ? "bg-amber-900/80 text-amber-200"
            : secondsAgo >= 15
            ? "bg-amber-900/80 text-amber-200"
            : "bg-gray-900/80 text-gray-400"
        }`}>
          {connectionStatus === "disconnected" ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Connection lost
            </span>
          ) : connectionStatus === "reconnecting" ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Reconnecting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Updated {formatTimeAgo(secondsAgo)}
            </span>
          )}
        </div>
        {/* Phase 4.100: Extended disconnection hint after 5+ minutes */}
        {showExtendedHint && connectionStatus === "disconnected" && (
          <div className="px-3 py-2 rounded-lg text-xs bg-red-900/60 text-red-300">
            Still offline — check Wi-Fi or refresh page
          </div>
        )}
      </div>
    );
  }

  // Prominent version for lineup control page
  // Phase 4.100: Show recovered banner when transitioning from disconnected
  if (showRecovered) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm bg-green-900/30 border border-green-500/50 text-green-300">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        <span className="font-medium">✓ Connection restored</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
      connectionStatus === "disconnected"
        ? "bg-red-900/30 border border-red-500/50 text-red-300"
        : connectionStatus === "reconnecting"
        ? "bg-amber-900/30 border border-amber-500/50 text-amber-300"
        : "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
    }`}>
      {/* Status indicator */}
      <span className={`w-2 h-2 rounded-full ${
        connectionStatus === "connected"
          ? "bg-green-500"
          : connectionStatus === "reconnecting"
          ? "bg-amber-500 animate-pulse"
          : "bg-red-500"
      }`}></span>

      {/* Status message */}
      {connectionStatus === "disconnected" ? (
        <span className="font-medium">
          ⚠️ Connection lost — attempting to reconnect
        </span>
      ) : connectionStatus === "reconnecting" ? (
        <span>
          Reconnecting...
        </span>
      ) : (
        <span>
          Last updated: {lastUpdated ? formatTimeAgo(secondsAgo) : "never"}
        </span>
      )}
    </div>
  );
}
