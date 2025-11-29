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
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50",
      "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
      "disabled:pointer-events-none disabled:opacity-50",
      "select-none",
    ];

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "bg-[var(--color-gold)] text-[var(--color-indigo-950)] font-semibold hover:bg-[var(--color-gold-200)] hover:shadow-[var(--shadow-glow-gold-sm)] active:bg-[var(--color-gold-400)] rounded-full",
      secondary: "border border-[var(--color-gold)]/60 bg-transparent text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 hover:border-[var(--color-gold)] active:bg-[var(--color-gold)]/20 rounded-full",
      subtle: "bg-transparent text-[var(--color-warm-gray)] hover:text-[var(--color-warm-white)] hover:bg-white/5 active:bg-white/10 rounded-lg",
      ghost: "bg-transparent text-[var(--color-gold)]/80 hover:text-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 active:bg-[var(--color-gold)]/10 rounded-lg",
      outline: "border border-white/20 bg-transparent text-[var(--color-warm-white)] hover:border-white/40 hover:bg-white/5 active:bg-white/10 rounded-full",
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
