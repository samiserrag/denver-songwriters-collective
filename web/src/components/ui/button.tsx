import * as React from "react";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";

type ButtonVariant = "primary" | "secondary" | "subtle" | "ghost" | "outline";
type ButtonSize = "sm" | "default" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", children, asChild, ...props }, ref) => {
    const baseStyles = [
      "inline-flex items-center justify-center gap-2",
      "whitespace-nowrap font-medium",
      "transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/50",
      "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
      "disabled:pointer-events-none disabled:opacity-50",
      "select-none",
    ];

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-glow-gold-sm)] active:bg-[var(--color-accent-hover)] rounded-full",
      secondary: "border border-[var(--color-accent-primary)]/60 bg-transparent text-[var(--color-text-accent)] hover:bg-[var(--color-accent-muted)] hover:border-[var(--color-accent-primary)] active:bg-[var(--color-accent-primary)]/20 rounded-full",
      subtle: "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5 active:bg-white/10 rounded-lg",
      ghost: "bg-transparent text-[var(--color-text-accent)]/80 hover:text-[var(--color-text-accent)] hover:bg-[var(--color-accent-muted)] active:bg-[var(--color-accent-primary)]/10 rounded-lg",
      outline: "border border-[var(--color-border-default)] bg-transparent text-[var(--color-text-primary)] hover:border-[var(--color-border-default)]/40 hover:bg-white/5 active:bg-white/10 rounded-full",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-9 px-4 text-sm",
      default: "h-11 px-6 text-sm",
      lg: "h-12 px-8 text-base",
      icon: "h-10 w-10",
    };

    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
