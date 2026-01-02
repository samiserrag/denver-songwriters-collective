"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EVENT_TYPE_CONFIG } from "@/types/events";

interface Event {
  id: string;
  title: string;
  event_type: string;
  event_date: string | null;
  venue_name: string;
  day_of_week: string;
  start_time: string;
  status: string;
  is_published: boolean;
  published_at: string | null;
  capacity: number | null;
  rsvp_count: number;
  user_role: string;
  series_id: string | null;
}

interface CancelDraftModalProps {
  isOpen: boolean;
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CancelDraftModal({ isOpen, eventTitle, onConfirm, onCancel, isLoading }: CancelDraftModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Cancel this draft?
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">
          This hides &ldquo;{eventTitle}&rdquo; from your drafts. You can recreate it later.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? "Cancelling..." : "Yes, cancel draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RestoreDraftModalProps {
  isOpen: boolean;
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RestoreDraftModal({ isOpen, eventTitle, onConfirm, onCancel, isLoading }: RestoreDraftModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Restore this event?
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">
          This moves &ldquo;{eventTitle}&rdquo; back to Drafts so it can be edited and published later.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? "Restoring..." : "Restore"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

interface Props {
  events: Event[];
  isApprovedHost: boolean;
}

type FilterTab = "active" | "drafts" | "cancelled";

export default function MyEventsFilteredList({ events: initialEvents, isApprovedHost }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [cancelModalState, setCancelModalState] = useState<{
    isOpen: boolean;
    eventId: string;
    eventTitle: string;
  }>({ isOpen: false, eventId: "", eventTitle: "" });
  const [isCancelling, setIsCancelling] = useState(false);
  const [restoreModalState, setRestoreModalState] = useState<{
    isOpen: boolean;
    eventId: string;
    eventTitle: string;
  }>({ isOpen: false, eventId: "", eventTitle: "" });
  const [isRestoring, setIsRestoring] = useState(false);

  // Check if a cancelled event can be restored (never published)
  const canRestore = useCallback((event: Event) => {
    return event.status === "cancelled" && !event.published_at;
  }, []);

  const handleCancelDraftClick = useCallback((e: React.MouseEvent, event: Event) => {
    e.preventDefault(); // Prevent navigation to event detail
    e.stopPropagation();
    setCancelModalState({
      isOpen: true,
      eventId: event.id,
      eventTitle: event.title,
    });
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    const { eventId } = cancelModalState;
    setIsCancelling(true);

    try {
      const res = await fetch(`/api/my-events/${eventId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Optimistic update: move event to cancelled status
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, status: "cancelled" } : e
          )
        );
        setCancelModalState({ isOpen: false, eventId: "", eventTitle: "" });
        // Switch to cancelled tab to show the moved event
        setActiveTab("cancelled");
        router.refresh();
      } else {
        console.error("Failed to cancel draft");
      }
    } catch (err) {
      console.error("Failed to cancel draft:", err);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelModalState, router]);

  const handleCancelModalClose = useCallback(() => {
    if (!isCancelling) {
      setCancelModalState({ isOpen: false, eventId: "", eventTitle: "" });
    }
  }, [isCancelling]);

  const handleRestoreClick = useCallback((e: React.MouseEvent, event: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setRestoreModalState({
      isOpen: true,
      eventId: event.id,
      eventTitle: event.title,
    });
  }, []);

  const handleRestoreConfirm = useCallback(async () => {
    const { eventId } = restoreModalState;
    setIsRestoring(true);

    try {
      const res = await fetch(`/api/my-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });

      if (res.ok) {
        // Optimistic update: move event back to draft status
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, status: "draft", is_published: false } : e
          )
        );
        setRestoreModalState({ isOpen: false, eventId: "", eventTitle: "" });
        // Switch to drafts tab to show the restored event
        setActiveTab("drafts");
        router.refresh();
      } else {
        const data = await res.json();
        console.error("Failed to restore:", data.error);
      }
    } catch (err) {
      console.error("Failed to restore:", err);
    } finally {
      setIsRestoring(false);
    }
  }, [restoreModalState, router]);

  const handleRestoreModalClose = useCallback(() => {
    if (!isRestoring) {
      setRestoreModalState({ isOpen: false, eventId: "", eventTitle: "" });
    }
  }, [isRestoring]);

  // Compute counts for each tab
  const counts = useMemo(() => {
    const active = events.filter(e => e.status === "active" && e.is_published).length;
    const drafts = events.filter(e => !e.is_published && e.status !== "cancelled").length;
    const cancelled = events.filter(e => e.status === "cancelled").length;
    return { active, drafts, cancelled };
  }, [events]);

  // Filter events based on active tab
  const filteredEvents = useMemo(() => {
    switch (activeTab) {
      case "active":
        return events.filter(e => e.status === "active" && e.is_published);
      case "drafts":
        return events.filter(e => !e.is_published && e.status !== "cancelled");
      case "cancelled":
        return events.filter(e => e.status === "cancelled");
      default:
        return events;
    }
  }, [events, activeTab]);

  // Get badge for event status
  const getStatusBadge = (event: Event) => {
    if (event.status === "cancelled") {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
          Cancelled
        </span>
      );
    }
    if (!event.is_published) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">
          Draft
        </span>
      );
    }
    // Published and active = Live
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
        Live
      </span>
    );
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🎵</div>
        <h2 className="text-xl text-[var(--color-text-primary)] mb-2">No events yet</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          {isApprovedHost
            ? "Create your first event to get started!"
            : "Once you're an approved host, you can create events here."
          }
        </p>
        {isApprovedHost && (
          <Link
            href="/dashboard/my-events/new"
            className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-semibold rounded-lg"
          >
            Create Your First Event
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border-default)] pb-2">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
            activeTab === "active"
              ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent-primary)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
          }`}
        >
          Live
          {counts.active > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">
              {counts.active}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("drafts")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
            activeTab === "drafts"
              ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent-primary)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
          }`}
        >
          Drafts
          {counts.drafts > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              {counts.drafts}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("cancelled")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
            activeTab === "cancelled"
              ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent-primary)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
          }`}
        >
          Cancelled
          {counts.cancelled > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
              {counts.cancelled}
            </span>
          )}
        </button>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          {activeTab === "active" && "No live events. Publish a draft to make it live!"}
          {activeTab === "drafts" && "No draft events."}
          {activeTab === "cancelled" && "No cancelled events."}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
              || EVENT_TYPE_CONFIG.other;

            return (
              <Link
                key={event.id}
                href={`/dashboard/my-events/${event.id}`}
                className="block p-6 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] rounded-lg transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Date box */}
                  {event.event_date && (
                    <div className="flex-shrink-0 w-14 h-14 bg-[var(--color-accent-primary)] rounded-lg flex flex-col items-center justify-center text-[var(--color-text-on-accent)]">
                      <span className="text-xs font-medium uppercase">
                        {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", timeZone: "America/Denver" })}
                      </span>
                      <span className="text-xl font-bold leading-none">
                        {new Date(event.event_date + "T00:00:00").getDate()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xl">{config.icon}</span>
                      {getStatusBadge(event)}
                      <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] rounded">
                        {config.label}
                      </span>
                      {event.series_id && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                          Series
                        </span>
                      )}
                      {event.user_role === "cohost" && (
                        <span className="text-xs px-2 py-0.5 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded">
                          Co-host
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg text-[var(--color-text-primary)] font-medium">{event.title}</h2>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                      {formatEventDate(event.event_date)} • {event.venue_name}
                    </p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{event.rsvp_count}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {event.capacity ? `of ${event.capacity}` : "RSVPs"}
                      </div>
                    </div>
                    {/* Cancel draft button - only show for drafts */}
                    {!event.is_published && event.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={(e) => handleCancelDraftClick(e, event)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-200 rounded-lg transition-colors"
                        aria-label="Cancel draft"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        <span>Cancel draft</span>
                      </button>
                    )}
                    {/* Restore button - only show for cancelled drafts that were never published */}
                    {canRestore(event) && (
                      <button
                        type="button"
                        onClick={(e) => handleRestoreClick(e, event)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-emerald-600 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-200 rounded-lg transition-colors"
                        aria-label="Restore to draft"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                          />
                        </svg>
                        <span>Restore to Draft</span>
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Cancel Draft Modal */}
      <CancelDraftModal
        isOpen={cancelModalState.isOpen}
        eventTitle={cancelModalState.eventTitle}
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelModalClose}
        isLoading={isCancelling}
      />

      {/* Restore Draft Modal */}
      <RestoreDraftModal
        isOpen={restoreModalState.isOpen}
        eventTitle={restoreModalState.eventTitle}
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreModalClose}
        isLoading={isRestoring}
      />
    </div>
  );
}
