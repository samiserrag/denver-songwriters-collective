import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  variant?: "full" | "short" | "icon";
  className?: string;
  inverse?: boolean;
}

function ThemeLogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`csc-logo-shell relative inline-flex overflow-hidden rounded-xl ${className}`} aria-hidden="true">
      <Image
        src="/images/logos/csc-night-theme.png"
        alt=""
        width={1024}
        height={1024}
        className="csc-logo-image csc-logo-night absolute inset-0 h-full w-full object-cover"
      />
      <Image
        src="/images/logos/csc-sunrise-theme.png"
        alt=""
        width={1024}
        height={1024}
        className="csc-logo-image csc-logo-sunrise absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}

export default function Logo({ variant = "full", className = "", inverse = false }: LogoProps) {
  const textPrimary = inverse ? "text-[var(--color-text-on-inverse-primary)]" : "text-[var(--color-text-primary)]";
  const textAccent = "text-[var(--color-accent-primary)]";

  if (variant === "icon") {
    return (
      <Link href="/" className={`flex items-center ${className}`} aria-label="The Colorado Songwriters Collective home">
        <ThemeLogoMark className="h-10 w-10 shadow-lg" />
      </Link>
    );
  }

  if (variant === "short") {
    return (
      <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="The Colorado Songwriters Collective home">
        <ThemeLogoMark className="h-8 w-8" />
        <span className={`font-display text-xl ${textPrimary}`}>CSC</span>
      </Link>
    );
  }

  return (
    <Link href="/" className={`flex items-center gap-3 ${className}`} aria-label="The Colorado Songwriters Collective home">
      <ThemeLogoMark className="h-10 w-10 shadow-lg" />
      <div className="flex flex-col">
        <span className={`font-display text-base 2xl:text-lg ${textPrimary} leading-tight`}>The Colorado Songwriters</span>
        <span className={`text-xs ${textAccent} tracking-widest uppercase`}>Collective</span>
      </div>
    </Link>
  );
}
