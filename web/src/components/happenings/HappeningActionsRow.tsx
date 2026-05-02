import Link from "next/link";
import { CalendarPlus, ListTodo } from "lucide-react";

/**
 * Two top-of-page CTAs that should stay visible on the homepage and the
 * happenings page no matter what filters are active. Lives next to the
 * hero so the "Add" / "Edit existing" entry points are reachable at all
 * times without re-routing through the dashboard.
 *
 * Why unconditional: on `/happenings`, the previous "+ Add Happening"
 * link only rendered inside the hero (when no filters were active) OR
 * inside a page-title block (only when a recognized `typeFilter` was
 * set). When saved-filter auto-apply ran on mount, the hero hid AND
 * `pageTitle` could be `null`, so the entry point silently disappeared
 * shortly after the page loaded. This row replaces that conditional
 * pair so the links always render.
 *
 * `tone` controls the surface so the row reads against either a dark
 * hero photo (`hero`) or the page background (`page`).
 */

type HappeningActionsTone = "hero" | "page";

const TONE_CLASSES: Record<HappeningActionsTone, { container: string; primary: string; secondary: string }> = {
  hero: {
    container: "",
    primary:
      "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg hover:bg-[var(--color-accent-hover)]",
    secondary:
      "bg-white/20 text-white backdrop-blur border border-white/30 hover:bg-white/30",
  },
  page: {
    container: "",
    primary:
      "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-sm hover:bg-[var(--color-accent-hover)]",
    secondary:
      "border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)] hover:bg-[var(--color-bg-tertiary)]",
  },
};

export function HappeningActionsRow({
  tone = "page",
  className,
  align = "center",
}: {
  tone?: HappeningActionsTone;
  className?: string;
  align?: "start" | "center";
}) {
  const styles = TONE_CLASSES[tone];
  const alignmentClass = align === "center" ? "justify-center" : "justify-start";
  const baseLink =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/40";
  return (
    <div
      data-testid="happening-actions-row"
      className={[
        "flex flex-wrap items-center gap-3",
        alignmentClass,
        styles.container,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Link
        href="/dashboard/my-events/new"
        className={`${baseLink} ${styles.primary}`}
        prefetch={false}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Add a Happening
      </Link>
      <Link
        href="/dashboard/my-events"
        className={`${baseLink} ${styles.secondary}`}
        prefetch={false}
      >
        <ListTodo className="h-4 w-4" aria-hidden="true" />
        Edit Existing Happenings
      </Link>
    </div>
  );
}

export default HappeningActionsRow;
