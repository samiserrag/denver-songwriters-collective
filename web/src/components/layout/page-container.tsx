import * as React from "react";
import { cn } from "@/lib/utils";
import { ContentTypography } from "@/components/typography/ContentTypography";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "main" | "section" | "article";
  size?: "default" | "narrow" | "wide";
  /** Enable enhanced typography for prose content (larger text, relaxed line-height) */
  typography?: boolean;
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
  typography = false,
}: PageContainerProps) {
  return (
    <Tag
      className={cn(
        "w-full mx-auto",
        sizeClasses[size],
        "px-4 sm:px-6 lg:px-8",
        "py-4 md:py-6 lg:py-8",
        className
      )}
    >
      {typography ? <ContentTypography>{children}</ContentTypography> : children}
    </Tag>
  );
}
