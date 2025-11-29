"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Global Error:", error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6 py-12">
      <h1 className="text-4xl font-bold text-gold-400 mb-4">
        Something went wrong
      </h1>

      <p className="text-neutral-400 mb-8 max-w-lg text-center">
        An unexpected error occurred. If the issue persists, please contact support.
      </p>

      <button
        onClick={reset}
        className="px-6 py-3 rounded-full bg-gold-400 text-black hover:bg-gold-300 transition shadow-lg"
      >
        Try Again
      </button>
    </div>
  );
}
