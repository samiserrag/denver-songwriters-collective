"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [hideRead, setHideRead] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();

  // Phase 4.51c: Removed auto-mark-read on mount - users control read state explicitly

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
      case "event_rsvp": return "✅";           // RSVP confirmation
      case "event_comment": return "💬";        // Comment/reply
      case "waitlist_promotion": return "🎉";
      case "cohost_invitation": return "📬";
      case "invitation_response": return "✉️";
      case "host_approved": return "🎤";
      case "host_rejected": return "❌";
      case "event_cancelled": return "🚫";
      default: return "🔔";
    }
  };

  // Mark a single notification as read and navigate
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read optimistically
    if (!notification.is_read) {
      setItems(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      ));

      // Fire and forget - mark as read on server
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] })
      }).catch(err => console.error("Failed to mark notification as read:", err));
    }

    // Navigate to link if present
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    const unreadIds = items.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);

    // Optimistically update UI
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true })
      });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      // Revert on error
      setItems(notifications);
    } finally {
      setMarkingAll(false);
    }
  };

  // Filter items based on hideRead toggle
  const visibleItems = hideRead ? items.filter(n => !n.is_read) : items;
  const unreadCount = items.filter(n => !n.is_read).length;
  const readCount = items.filter(n => n.is_read).length;

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
    <div>
      {/* Controls - only show in full mode */}
      {!compact && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-4">
            {/* Mark all read button */}
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="text-sm text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {markingAll ? "Marking..." : "Mark all read"}
            </button>

            {/* Hide read toggle */}
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={hideRead}
                onChange={(e) => setHideRead(e.target.checked)}
                className="rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
              />
              Hide read
            </label>
          </div>

          {/* Count summary */}
          <div className="text-sm text-[var(--color-text-secondary)]">
            {unreadCount > 0 && (
              <span className="text-[var(--color-text-accent)] font-medium">{unreadCount} unread</span>
            )}
            {unreadCount > 0 && readCount > 0 && " · "}
            {readCount > 0 && hideRead && (
              <span>{readCount} hidden</span>
            )}
          </div>
        </div>
      )}

      {/* Empty state when all filtered out */}
      {visibleItems.length === 0 && hideRead && (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-secondary)]">
            No unread notifications.{" "}
            <button
              onClick={() => setHideRead(false)}
              className="text-[var(--color-text-accent)] hover:underline"
            >
              Show all
            </button>
          </p>
        </div>
      )}

      {/* Notification list */}
      <div className={compact ? "space-y-1" : "space-y-2"}>
        {visibleItems.map((notification) => (
          <div
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={`${compact ? "p-3" : "p-4"} rounded-lg border transition-colors cursor-pointer ${
              notification.is_read
                ? "bg-[var(--color-bg-tertiary)]/50 border-transparent hover:bg-[var(--color-bg-tertiary)]/70"
                : "bg-[var(--color-bg-tertiary)] border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={compact ? "text-lg" : "text-2xl"}>{getIcon(notification.type)}</div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-[var(--color-text-primary)] font-medium ${compact ? "text-sm truncate" : ""} ${!notification.is_read ? "font-semibold" : ""}`}>
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
                  onClick={(e) => e.stopPropagation()} // Prevent double navigation
                  className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-sm shrink-0"
                >
                  View →
                </Link>
              )}
              {/* Unread indicator dot */}
              {!notification.is_read && (
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] shrink-0 mt-2" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
