import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-5xl font-bold text-[var(--color-accent-primary)] mb-4">404</h1>
      <p className="text-[var(--color-text-secondary)] mb-6 text-lg">The page you&apos;re looking for doesn&apos;t exist.</p>

      <Link href="/" className="px-6 py-3 rounded-full bg-[var(--color-accent-primary)] text-[var(--color-bg-inverse)] hover:bg-[var(--color-accent-hover)] transition shadow-lg">Return Home</Link>
    </div>
  );
}
