export default function SongwriterDetailLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent-primary)] mx-auto"></div>
        <p className="mt-4 text-[var(--color-text-secondary)]">Loading songwriter profile...</p>
      </div>
    </div>
  );
}
