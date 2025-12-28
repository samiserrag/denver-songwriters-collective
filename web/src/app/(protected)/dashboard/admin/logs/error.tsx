"use client";

import { useEffect } from "react";

export default function LogsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Logs page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h2 className="text-xl font-bold text-red-500 mb-4">
          Error Loading Logs
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-4">
          {error.message}
        </p>
        {error.digest && (
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
