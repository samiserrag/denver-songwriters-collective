import Link from "next/link";

interface LogoProps {
  variant?: "full" | "short" | "icon";
  className?: string;
  inverse?: boolean;
}

export default function Logo({ variant = "full", className = "", inverse = false }: LogoProps) {
  const textPrimary = inverse ? "text-[var(--color-text-on-inverse-primary)]" : "text-[var(--color-text-primary)]";
  const textAccent = "text-[var(--color-accent-primary)]";

  if (variant === "icon") {
    return (
      <Link href="/" className={`flex items-center ${className}`}>
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-hover)] rounded-lg flex items-center justify-center shadow-lg">
          <span className="text-[var(--color-bg-primary)] font-bold text-lg font-display">C</span>
        </div>
      </Link>
    );
  }

  if (variant === "short") {
    return (
      <Link href="/" className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-hover)] rounded-lg flex items-center justify-center">
          <span className="text-[var(--color-bg-primary)] font-bold text-sm">CSC</span>
        </div>
        <span className={`font-display text-xl ${textPrimary}`}>CSC</span>
      </Link>
    );
  }

  return (
    <Link href="/" className={`flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-hover)] rounded-lg flex items-center justify-center shadow-lg">
        <span className="text-[var(--color-bg-primary)] font-bold text-sm">CSC</span>
      </div>
      <div className="flex flex-col">
        <span className={`font-display text-base 2xl:text-lg ${textPrimary} leading-tight`}>The Colorado Songwriters</span>
        <span className={`text-xs ${textAccent} tracking-widest uppercase`}>Collective</span>
      </div>
    </Link>
  );
}
