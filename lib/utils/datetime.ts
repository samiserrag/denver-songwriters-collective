/**
 * Date and time utilities for Open Mic Drop
 * Handles formatting, parsing, and validation
 */

// ============================================
// FORMATTING
// ============================================

/**
 * Format ISO timestamp to readable date and time
 * @param isoString - ISO 8601 timestamp
 * @returns Formatted date string (e.g., "Jan 15, 2025 at 2:30 PM")
 */
export function formatAppointmentTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Format time only from ISO timestamp
 * @param isoString - ISO 8601 timestamp
 * @returns Formatted time (e.g., "2:30 PM")
 */
export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Format date only from ISO timestamp
 * @param isoString - ISO 8601 date or timestamp
 * @returns Formatted date (e.g., "January 15, 2025")
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Format duration in minutes to readable string
 * @param minutes - Duration in minutes
 * @returns Formatted duration (e.g., "1h 30m" or "45m")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format TIME column (HH:MM:SS) to 12-hour format
 * @param timeString - Time in HH:MM:SS format
 * @returns Formatted time (e.g., "2:30 PM")
 */
export function formatTimeString(timeString: string): string {
  try {
    // Parse HH:MM:SS format
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return timeString;
  }
}

// ============================================
// PARSING
// ============================================

/**
 * Parse ISO timestamp to Date object safely
 * @param isoString - ISO 8601 timestamp
 * @returns Date object or null if invalid
 */
export function parseDateTime(isoString: string): Date | null {
  try {
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Convert Date object to ISO timestamp for Supabase
 * @param date - Date object
 * @returns ISO 8601 timestamp
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check if a date/time is in the future
 * @param isoString - ISO timestamp or date string
 * @returns true if in future
 */
export function isInFuture(isoString: string): boolean {
  try {
    const date = new Date(isoString);
    return date.getTime() > Date.now();
  } catch {
    return false;
  }
}

/**
 * Check if a date/time is in the past
 * @param isoString - ISO timestamp or date string
 * @returns true if in past
 */
export function isInPast(isoString: string): boolean {
  try {
    const date = new Date(isoString);
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
}

/**
 * Get relative time description (e.g., "in 2 hours", "yesterday")
 * @param isoString - ISO timestamp
 * @returns Relative time string
 */
export function getRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (Math.abs(diffMins) < 1) return 'now';
    if (Math.abs(diffMins) < 60) {
      return diffMins > 0 ? `in ${diffMins}m` : `${Math.abs(diffMins)}m ago`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (Math.abs(diffDays) === 1) {
      return diffDays > 0 ? 'tomorrow' : 'yesterday';
    }
    return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
  } catch {
    return isoString;
  }
}

/**
 * Create datetime-local input value from ISO string
 * @param isoString - ISO timestamp
 * @returns Format suitable for <input type="datetime-local">
 */
export function toDateTimeLocalValue(isoString?: string): string {
  try {
    const date = isoString ? new Date(isoString) : new Date();
    // Format: YYYY-MM-DDTHH:mm
    return date.toISOString().slice(0, 16);
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}
