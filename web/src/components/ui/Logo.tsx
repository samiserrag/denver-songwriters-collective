import Link from "next/link";

interface LogoProps {
  variant?: "full" | "short" | "icon";
  className?: string;
}

export default function Logo({ variant = "full", className = "" }: LogoProps) {
  if (variant === "icon") {
    return (
      <Link href="/" className={`flex items-center ${className}`}>
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-gold-500)] rounded-lg flex items-center justify-center shadow-lg">
          <span className="text-[var(--color-background)] font-bold text-lg font-display">D</span>
        </div>
      </Link>
    );
  }

  if (variant === "short") {
    return (
      <Link href="/" className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-gold-500)] rounded-lg flex items-center justify-center">
          <span className="text-[var(--color-background)] font-bold text-sm">DSC</span>
        </div>
        <span className="font-display text-xl text-[var(--color-warm-white)]">DSC</span>
      </Link>
    );
  }

  return (
    <Link href="/" className={`flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-gold-500)] rounded-lg flex items-center justify-center shadow-lg">
        <span className="text-[var(--color-background)] font-bold text-sm">DSC</span>
      </div>
      <div className="flex flex-col">
        <span className="font-display text-lg text-[var(--color-warm-white)] leading-tight">Denver Songwriters</span>
        <span className="text-xs text-[var(--color-text-accent)] tracking-widest uppercase">Collective</span>
      </div>
    </Link>
  );
}
