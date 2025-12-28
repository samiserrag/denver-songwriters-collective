'use client';

import { useEffect } from 'react';
import { appLogger } from '@/lib/appLogger';

export default function HappeningsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    appLogger.logError(error, 'HappeningsPage', { digest: error.digest });
    console.error('Happenings error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-display mb-4">Something went wrong</h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          We couldn&apos;t load the events. This might be a temporary issue.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[var(--color-accent-primary)] text-white rounded-lg hover:opacity-90 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
