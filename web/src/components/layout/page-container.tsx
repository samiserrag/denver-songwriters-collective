import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "main" | "section" | "article";
  size?: "default" | "narrow" | "wide";
}

const sizeClasses = {
  narrow: "max-w-4xl",
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
};

export function PageContainer({
  children,
  className,
  as: Tag = "div",
  size = "default",
}: PageContainerProps) {
  return (
    <Tag
      className={cn(
        "w-full mx-auto",
        sizeClasses[size],
        "px-4 sm:px-6 lg:px-8",
        "py-8 md:py-12 lg:py-16",
        className
      )}
    >
      {children}
    </Tag>
  );
}
