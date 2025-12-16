"use client";

import { useState, useRef, useEffect } from "react";

interface AddToCalendarButtonProps {
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate?: Date;
  /** If true, the event is all-day */
  allDay?: boolean;
}

interface CalendarLinks {
  google: string;
  ical: string;
  outlook: string;
}

function formatDateForGoogle(date: Date): string {
  // Google Calendar format: YYYYMMDDTHHmmSSZ
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatDateForICS(date: Date): string {
  // ICS format: YYYYMMDDTHHmmSS (local time without Z for simplicity)
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "");
}

function formatDateForOutlook(date: Date): string {
  // Outlook web uses ISO format
  return date.toISOString();
}

function generateCalendarLinks(props: AddToCalendarButtonProps): CalendarLinks {
  const { title, description, location, startDate, endDate } = props;

  // Default end time to 2 hours after start if not provided
  const end = endDate || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || "");
  const encodedLocation = encodeURIComponent(location || "");

  // Google Calendar
  const googleStart = formatDateForGoogle(startDate);
  const googleEnd = formatDateForGoogle(end);
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${googleStart}/${googleEnd}&details=${encodedDescription}&location=${encodedLocation}`;

  // Outlook Web
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodedTitle}&startdt=${formatDateForOutlook(startDate)}&enddt=${formatDateForOutlook(end)}&body=${encodedDescription}&location=${encodedLocation}`;

  // iCal/Apple Calendar - creates a downloadable .ics file
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Denver Songwriters Collective//EN",
    "BEGIN:VEVENT",
    `DTSTART:${formatDateForICS(startDate)}`,
    `DTEND:${formatDateForICS(end)}`,
    `SUMMARY:${title.replace(/,/g, "\\,")}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n").replace(/,/g, "\\,")}` : "",
    location ? `LOCATION:${location.replace(/,/g, "\\,")}` : "",
    `UID:${startDate.getTime()}-${Math.random().toString(36).substr(2, 9)}@dsc`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  const ical = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

  return { google, ical, outlook };
}

export function AddToCalendarButton(props: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const links = generateCalendarLinks(props);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const calendarOptions = [
    {
      name: "Google Calendar",
      href: links.google,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm-9.75 15H6.75v-3h3v3zm0-4.5H6.75v-3h3v3zm0-4.5H6.75V6h3v3zm4.5 9h-3v-3h3v3zm0-4.5h-3v-3h3v3zm0-4.5h-3V6h3v3zm4.5 9h-3v-3h3v3zm0-4.5h-3v-3h3v3zm0-4.5h-3V6h3v3z" />
        </svg>
      ),
      download: false,
    },
    {
      name: "Apple Calendar",
      href: links.ical,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      ),
      download: "event.ics",
    },
    {
      name: "Outlook",
      href: links.outlook,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3h-3zm0 4.5v3h3v-3h-3zm0 4.5v1.83l3-1.83v-3zm-4-9h-3v3h3v-3zm0 4.5h-3v3h3v-3zm0 4.5h-3v3h3v-3zm-4-9H7v3h3v-3zm0 4.5H7v3h3v-3zm-3 4.5v3h3v-3H7zm8-6h-4V18h4v-6z" />
        </svg>
      ),
      download: false,
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Add to Calendar
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-48 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] shadow-lg overflow-hidden">
          {calendarOptions.map((option) => (
            <a
              key={option.name}
              href={option.href}
              target={option.download ? undefined : "_blank"}
              rel={option.download ? undefined : "noopener noreferrer"}
              download={option.download || undefined}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <span className="text-[var(--color-text-secondary)]">{option.icon}</span>
              <span className="text-sm font-medium">{option.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
