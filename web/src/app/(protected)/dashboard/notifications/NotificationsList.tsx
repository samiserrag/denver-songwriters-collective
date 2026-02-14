"use client";

import { useState, useCallback } from "react";
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
  initialCursor?: string | null;
  initialTotal?: number;
}

// Notification type options for filtering
const NOTIFICATION_TYPES = [
  { value: "", label: "All types" },
  { value: "event_rsvp", label: "RSVPs" },
  { value: "event_comment", label: "Comments" },
  { value: "waitlist_promotion", label: "Waitlist" },
  { value: "cohost_invitation", label: "Co-host invites" },
  { value: "invitation_response", label: "Invite responses" },
  { value: "host_approved", label: "Host approved" },
  { value: "event_cancelled", label: "Cancellations" },
];

export default function NotificationsList({
  notifications,
  initialCursor = null,
  initialTotal = 0,
}: NotificationsListProps) {
  const [items, setItems] = useState(notifications);
  const [hideRead, setHideRead] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(!!initialCursor);
  const [total, setTotal] = useState(initialTotal);
  const router = useRouter();

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
      case "event_rsvp": return "✅";
      case "event_comment": return "💬";
      case "waitlist_promotion": return "🎉";
      case "cohost_invitation": return "📬";
      case "invitation_response": return "✉️";
      case "host_approved": return "🎤";
      case "host_rejected": return "❌";
      case "event_cancelled": return "🚫";
      default: return "🔔";
    }
  };

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        cursor,
        limit: "50",
      });
      if (typeFilter) params.set("type", typeFilter);
      if (hideRead) params.set("unread", "true");

      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();

      if (res.ok) {
        setItems(prev => [...prev, ...data.notifications]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to load more notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, typeFilter, hideRead]);

  // Refresh with filters
  const refreshWithFilters = useCallback(async (newTypeFilter: string, newHideRead: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (newTypeFilter) params.set("type", newTypeFilter);
      if (newHideRead) params.set("unread", "true");

      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();

      if (res.ok) {
        setItems(data.notifications);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to refresh notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle type filter change
  const handleTypeFilterChange = (newType: string) => {
    setTypeFilter(newType);
    refreshWithFilters(newType, hideRead);
  };

  // Handle hide read toggle
  const handleHideReadChange = (newHideRead: boolean) => {
    setHideRead(newHideRead);
    refreshWithFilters(typeFilter, newHideRead);
  };

  // Mark a single notification as read and navigate
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      setItems(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      ));

      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] })
      }).catch(err => console.error("Failed to mark notification as read:", err));
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    const unreadIds = items.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true })
      });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      setItems(notifications);
    } finally {
      setMarkingAll(false);
    }
  };

  // Delete all read notifications
  const handleDeleteAllRead = async () => {
    const readCount = items.filter(n => n.is_read).length;
    if (readCount === 0) return;

    if (!confirm(`Delete ${readCount} read notification${readCount === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    const readIds = items.filter(n => n.is_read).map(n => n.id);
    setItems(prev => prev.filter(n => !n.is_read));

    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAllRead: true })
      });
      const data = await res.json();
      if (res.ok) {
        setTotal(prev => prev - (data.deletedCount || 0));
      }
    } catch (err) {
      console.error("Failed to delete read notifications:", err);
      // Restore on error
      setItems(prev => [...prev, ...notifications.filter(n => readIds.includes(n.id))]);
    } finally {
      setDeleting(false);
    }
  };

  // Delete notifications older than 30 days
  const handleDeleteOld = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldCount = items.filter(n => new Date(n.created_at) < thirtyDaysAgo).length;

    if (oldCount === 0) {
      alert("No notifications older than 30 days.");
      return;
    }

    if (!confirm(`Delete ${oldCount} notification${oldCount === 1 ? "" : "s"} older than 30 days? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setItems(prev => prev.filter(n => new Date(n.created_at) >= thirtyDaysAgo));

    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThan: thirtyDaysAgo.toISOString() })
      });
      const data = await res.json();
      if (res.ok) {
        setTotal(prev => prev - (data.deletedCount || 0));
      }
    } catch (err) {
      console.error("Failed to delete old notifications:", err);
      refreshWithFilters(typeFilter, hideRead);
    } finally {
      setDeleting(false);
    }
  };

  // Filter items based on hideRead toggle (for local filtering when not using API)
  const visibleItems = hideRead ? items.filter(n => !n.is_read) : items;
  const unreadCount = items.filter(n => !n.is_read).length;
  const readCount = items.filter(n => n.is_read).length;

  return (
    <div>
      {/* Controls — always visible */}
        <div className="space-y-4 mb-6">
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
            >
              {NOTIFICATION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* Hide read toggle */}
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={hideRead}
                onChange={(e) => handleHideReadChange(e.target.checked)}
                className="rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
              />
              Unread only
            </label>

            {/* Count summary */}
            <div className="text-sm text-[var(--color-text-secondary)] ml-auto">
              {total > 0 && <span>{total} total</span>}
              {unreadCount > 0 && (
                <span className="ml-2 text-[var(--color-text-accent)] font-medium">
                  ({unreadCount} unread)
                </span>
              )}
            </div>
          </div>

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-[var(--color-border-default)]">
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="text-sm text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {markingAll ? "Marking..." : "Mark all read"}
            </button>

            <span className="text-[var(--color-border-default)]">|</span>

            <button
              onClick={handleDeleteAllRead}
              disabled={deleting || readCount === 0}
              className="text-sm text-[var(--color-text-secondary)] hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? "Deleting..." : "Delete read"}
            </button>

            <button
              onClick={handleDeleteOld}
              disabled={deleting}
              className="text-sm text-[var(--color-text-secondary)] hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Delete older than 30 days
            </button>

            {/* Settings link */}
            <Link
              href="/dashboard/settings"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] ml-auto transition-colors"
            >
              Email preferences →
            </Link>
          </div>
        </div>

      {/* Empty states */}
      {visibleItems.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-secondary)]">
            {hideRead ? (
              <>
                No unread notifications.{" "}
                <button
                  onClick={() => handleHideReadChange(false)}
                  className="text-[var(--color-text-accent)] hover:underline"
                >
                  Show all
                </button>
              </>
            ) : typeFilter ? (
              <>
                No notifications of this type.{" "}
                <button
                  onClick={() => handleTypeFilterChange("")}
                  className="text-[var(--color-text-accent)] hover:underline"
                >
                  Clear filter
                </button>
              </>
            ) : (
              "You\u2019re all caught up!"
            )}
          </p>
        </div>
      )}

      {/* Notification list */}
      <div className="space-y-2">
        {visibleItems.map((notification) => (
          <div
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={`p-4 rounded-lg border transition-colors cursor-pointer ${
              notification.is_read
                ? "bg-[var(--color-bg-tertiary)]/50 border-transparent hover:bg-[var(--color-bg-tertiary)]/70"
                : "bg-[var(--color-bg-tertiary)] border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{getIcon(notification.type)}</div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-[var(--color-text-primary)] font-medium ${!notification.is_read ? "font-semibold" : ""}`}>
                  {notification.title}
                </h3>
                {notification.message && (
                  <p className="text-[var(--color-text-secondary)] text-sm mt-1">{notification.message}</p>
                )}
                <p className="text-[var(--color-text-secondary)] text-xs mt-1">{formatDate(notification.created_at)}</p>
              </div>
              {notification.link && (
                <Link
                  href={notification.link}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-sm shrink-0"
                >
                  View →
                </Link>
              )}
              {!notification.is_read && (
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] shrink-0 mt-2" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
