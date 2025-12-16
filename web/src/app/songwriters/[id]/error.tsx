"use client";

export default function SongwriterDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
          Something went wrong
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          We couldn&apos;t load this songwriter&apos;s profile. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-background)] rounded-lg hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
