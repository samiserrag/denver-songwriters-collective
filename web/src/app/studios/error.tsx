"use client";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Route Error:", error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-6 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text-accent)] mb-4">
        Something went wrong loading this page
      </h1>

      <p className="text-[var(--color-text-tertiary)] mb-8 max-w-lg text-center">
        {error.message || "Unknown error occurred."}
      </p>

      <button
        onClick={reset}
        className="px-6 py-3 rounded-full bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] transition shadow-lg"
      >
        Retry
      </button>
    </div>
  );
}
