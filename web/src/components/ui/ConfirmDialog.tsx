"use client";

import * as React from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
}

/**
 * Generic confirmation dialog for destructive/important actions.
 *
 * Phase 4.99: Required for "Stop Event" and "Reset Lineup" actions.
 * CSC UX Principles §7: UX Friction Is a Tool.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "⚠️",
      iconBg: "bg-red-500/20",
      confirmBg: "bg-red-600 hover:bg-red-500",
    },
    warning: {
      icon: "⚠️",
      iconBg: "bg-amber-500/20",
      confirmBg: "bg-amber-600 hover:bg-amber-500",
    },
    default: {
      icon: "❓",
      iconBg: "bg-[var(--color-accent-primary)]/20",
      confirmBg: "bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] p-6 max-w-sm w-full shadow-xl"
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mx-auto mb-4`}>
          <span className="text-2xl">{styles.icon}</span>
        </div>

        {/* Title */}
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[var(--color-text-primary)] text-center mb-2"
        >
          {title}
        </h2>

        {/* Message */}
        <p className="text-[var(--color-text-secondary)] text-center text-sm mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${styles.confirmBg} disabled:opacity-50`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
