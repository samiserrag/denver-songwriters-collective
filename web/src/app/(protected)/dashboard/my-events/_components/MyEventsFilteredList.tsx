"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EVENT_TYPE_CONFIG } from "@/types/events";

// Phase 4.33: Collapsed cancelled section disclosure

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

type FilterTab = "active" | "drafts";

export default function MyEventsFilteredList({ events: initialEvents, isApprovedHost }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const [events, setEvents] = useState<Event[]>(initialEvents);
  // Phase 4.33: Cancelled section is collapsed by default
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelModalState, setCancelModalState] = useState<{
    isOpen: boolean;
    eventId: string;
    eventTitle: string;
  }>({ isOpen: false, eventId: "", eventTitle: "" });
  const [isCancelling, setIsCancelling] = useState(false);

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
        // Phase 4.33: Expand cancelled section to show the moved event
        setShowCancelled(true);
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
      default:
        return events;
    }
  }, [events, activeTab]);

  // Phase 4.33: Cancelled events are shown separately in a collapsible section
  const cancelledEvents = useMemo(() => {
    return events.filter(e => e.status === "cancelled");
  }, [events]);

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
      {/* Filter Tabs - Phase 4.33: Removed Cancelled as primary tab */}
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
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          {activeTab === "active" && "No live events. Publish a draft to make it live!"}
          {activeTab === "drafts" && "No draft events."}
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
                        {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "America/Denver" })}
                      </span>
                      <span className="text-xl font-bold leading-none">
                        {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Denver" })}
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
                        className="flex-shrink-0 p-2 text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Cancel draft"
                        aria-label="Cancel draft"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Phase 4.33: Cancelled events disclosure - collapsed by default */}
      {cancelledEvents.length > 0 && (
        <div className="mt-8 border-t border-[var(--color-border-default)] pt-4">
          <button
            onClick={() => setShowCancelled(!showCancelled)}
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showCancelled ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Cancelled
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
              {cancelledEvents.length}
            </span>
          </button>

          {showCancelled && (
            <div className="mt-4 space-y-4">
              {cancelledEvents.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
                  || EVENT_TYPE_CONFIG.other;

                return (
                  <Link
                    key={event.id}
                    href={`/dashboard/my-events/${event.id}`}
                    className="block p-4 bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg transition-colors opacity-60 hover:opacity-80"
                  >
                    <div className="flex items-start gap-4">
                      {/* Date box - muted */}
                      {event.event_date && (
                        <div className="flex-shrink-0 w-12 h-12 bg-[var(--color-bg-tertiary)] rounded-lg flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
                          <span className="text-xs font-medium uppercase">
                            {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "America/Denver" })}
                          </span>
                          <span className="text-lg font-bold leading-none">
                            {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Denver" })}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-lg">{config.icon}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                            Cancelled
                          </span>
                        </div>
                        <h2 className="text-base text-[var(--color-text-primary)] font-medium line-through decoration-red-500/50">{event.title}</h2>
                        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                          {formatEventDate(event.event_date)} • {event.venue_name}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
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
    </div>
  );
}
