"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsListProps {
  notifications: Notification[];
  compact?: boolean; // For embedding in dashboard
}

export default function NotificationsList({ notifications, compact = false }: NotificationsListProps) {
  const [items, setItems] = useState(notifications);

  // Mark all as read on mount
  useEffect(() => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds })
      }).then(() => {
        setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      });
    }
  }, [notifications]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { timeZone: "America/Denver" });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "waitlist_promotion": return "🎉";
      case "cohost_invitation": return "📬";
      case "invitation_response": return "✉️";
      case "host_approved": return "🎤";
      case "host_rejected": return "❌";
      case "event_cancelled": return "🚫";
      default: return "🔔";
    }
  };

  if (items.length === 0) {
    if (compact) {
      return null; // Parent handles empty state in compact mode
    }
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔔</div>
        <h2 className="text-xl text-[var(--color-text-primary)] mb-2">No notifications</h2>
        <p className="text-[var(--color-text-secondary)]">You&apos;re all caught up!</p>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {items.map((notification) => (
        <div
          key={notification.id}
          className={`${compact ? "p-3" : "p-4"} rounded-lg border transition-colors ${
            notification.is_read
              ? "bg-[var(--color-bg-tertiary)]/50 border-transparent"
              : "bg-[var(--color-bg-tertiary)] border-[var(--color-border-default)]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={compact ? "text-lg" : "text-2xl"}>{getIcon(notification.type)}</div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-[var(--color-text-primary)] font-medium ${compact ? "text-sm truncate" : ""}`}>
                {notification.title}
              </h3>
              {notification.message && !compact && (
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">{notification.message}</p>
              )}
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{formatDate(notification.created_at)}</p>
            </div>
            {notification.link && (
              <Link
                href={notification.link}
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-sm shrink-0"
              >
                View →
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
