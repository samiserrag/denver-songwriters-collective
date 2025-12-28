"use client";

import { useEffect } from "react";
import { appLogger } from "@/lib/appLogger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to database for admin debugging
    appLogger.logError(error, "GlobalError", {
      digest: error.digest,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
  }, [error]);

  console.error("Global Error:", error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-[var(--color-text-primary)] px-6 py-12">
      <h1 className="text-4xl font-bold text-gold-400 mb-4">
        Something went wrong
      </h1>

      <p className="text-[var(--color-text-tertiary)] mb-8 max-w-lg text-center">
        An unexpected error occurred. If the issue persists, please contact support.
      </p>

      <button
        onClick={reset}
        className="px-6 py-3 rounded-full bg-gold-400 text-[var(--color-text-on-accent)] hover:bg-gold-300 transition shadow-lg"
      >
        Try Again
      </button>
    </div>
  );
}
