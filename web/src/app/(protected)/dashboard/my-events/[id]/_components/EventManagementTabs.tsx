"use client";

export type TabId = "details" | "attendees" | "lineup" | "settings";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "details", label: "Details", icon: "📝" },
  { id: "attendees", label: "Attendees", icon: "👥" },
  { id: "lineup", label: "Lineup", icon: "🎤" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

interface EventManagementTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasTimeslots: boolean;
  attendeeCount: number;
  lineupCount: number;
}

/**
 * Phase 5.14: Tabbed navigation for event management
 *
 * Provides clear separation of concerns:
 * - Details: Event form (title, schedule, location, etc.)
 * - Attendees: RSVPs with full profile cards and management
 * - Lineup: Performer signups with full details
 * - Settings: Co-hosts, invites, danger zone
 */
export default function EventManagementTabs({
  activeTab,
  onTabChange,
  hasTimeslots,
  attendeeCount,
  lineupCount,
}: EventManagementTabsProps) {
  return (
    <div className="border-b border-[var(--color-border-default)] mb-6">
      <nav className="flex gap-1" aria-label="Event management tabs">
        {TABS.map((tab) => {
          // Hide Lineup tab if event doesn't have timeslots
          if (tab.id === "lineup" && !hasTimeslots) {
            return null;
          }

          const isActive = activeTab === tab.id;
          const count = tab.id === "attendees" ? attendeeCount : tab.id === "lineup" ? lineupCount : null;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium transition-colors relative
                ${isActive
                  ? "text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-b-2 border-transparent"
                }
              `}
              aria-selected={isActive}
              role="tab"
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count !== null && count > 0 && (
                  <span className={`
                    px-1.5 py-0.5 text-xs rounded-full
                    ${isActive
                      ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                    }
                  `}>
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
