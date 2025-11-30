import * as React from "react";
import { cn } from "@/lib/utils";

interface AdminFormCardProps {
  title?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function AdminFormCard({
  title = "Admin Form",
  description,
  className,
  children,
}: AdminFormCardProps) {
  return (
    <div className={cn("card-base p-6", className)}>
      <h3 className="font-semibold text-[var(--color-warm-white)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-warm-gray)] mb-4">
          {description}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}
