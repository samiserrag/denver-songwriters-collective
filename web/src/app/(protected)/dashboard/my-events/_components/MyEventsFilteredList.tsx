"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { EVENT_TYPE_CONFIG } from "@/types/events";

interface Event {
  id: string;
  title: string;
  event_type: string;
  venue_name: string;
  day_of_week: string;
  start_time: string;
  status: string;
  is_published: boolean;
  capacity: number | null;
  rsvp_count: number;
  user_role: string;
}

interface Props {
  events: Event[];
  isApprovedHost: boolean;
}

type FilterTab = "active" | "drafts" | "cancelled";

export default function MyEventsFilteredList({ events, isApprovedHost }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

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
        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
          Cancelled
        </span>
      );
    }
    if (!event.is_published) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
          Draft
        </span>
      );
    }
    // Published and active = Live
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
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
            className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg"
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
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
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
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
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
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{config.icon}</span>
                      {getStatusBadge(event)}
                      <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] rounded">
                        {config.label}
                      </span>
                      {event.user_role === "cohost" && (
                        <span className="text-xs px-2 py-0.5 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded">
                          Co-host
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg text-[var(--color-text-primary)] font-medium">{event.title}</h2>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                      {event.venue_name} {event.day_of_week && `• ${event.day_of_week}`} {event.start_time && event.start_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[var(--color-text-primary)]">{event.rsvp_count}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {event.capacity ? `of ${event.capacity}` : "RSVPs"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
