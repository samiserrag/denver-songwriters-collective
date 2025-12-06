import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  ctaText,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center text-center py-16 px-4">
      {icon && <div className="text-6xl mb-4 opacity-80">{icon}</div>}

      <h3 className="font-[var(--font-family-serif)] text-2xl text-[var(--color-warm-white)] mb-2">
        {title}
      </h3>

      {subtitle && (
        <p className="text-[var(--color-warm-gray)] mb-6 max-w-md mx-auto">
          {subtitle}
        </p>
      )}

      {ctaText && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-medium rounded-lg transition-colors"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}
