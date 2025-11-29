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
    <div className="w-full flex flex-col items-center justify-center text-center py-20 px-4">
      {icon && <div className="text-[48px] mb-4 text-gold-400">{icon}</div>}

      <h2 className="text-2xl font-semibold text-gold-400 mb-2">
        {title}
      </h2>

      {subtitle && (
        <p className="text-neutral-400 mb-6 max-w-md">
          {subtitle}
        </p>
      )}

      {ctaText && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-2 px-5 py-2 rounded-full bg-gold-400 text-black hover:bg-gold-300 transition"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}
