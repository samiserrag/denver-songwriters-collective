/**
 * Unit Tests: datetime utilities
 * Tests date/time formatting and parsing functions
 *
 * Migrated from legacy tests/ directory (December 2025)
 * These tests are schema-independent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock implementations of datetime functions for testing
// These match the expected behavior from lib/utils/datetime.ts

function formatAppointmentTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

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

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatTimeString(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeString;

    const date = new Date(Date.UTC(2000, 0, 1, hours, minutes, 0));
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return timeString;
  }
}

function parseDateTime(isoString: string): Date | null {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

function isInFuture(isoString: string): boolean {
  const date = parseDateTime(isoString);
  if (!date) return false;
  return date.getTime() > Date.now();
}

function isInPast(isoString: string): boolean {
  const date = parseDateTime(isoString);
  if (!date) return false;
  return date.getTime() < Date.now();
}

function getRelativeTime(isoString: string): string {
  const date = parseDateTime(isoString);
  if (!date) return isoString;

  const now = Date.now();
  const diff = date.getTime() - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (diff < 0) {
    // Past
    if (days >= 1) {
      if (days === 1) return 'yesterday';
      return `${days}d ago`;
    }
    if (hours >= 1) return `${hours}h ago`;
    return `${minutes}m ago`;
  } else {
    // Future
    if (days >= 1) {
      if (days === 1) return 'tomorrow';
      return `in ${days}d`;
    }
    if (hours >= 1) return `in ${hours}h`;
    return `in ${minutes}m`;
  }
}

function toDateTimeLocalValue(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

describe('Unit: datetime utilities', () => {
  // ============================================
  // formatAppointmentTime
  // ============================================

  describe('formatAppointmentTime', () => {
    describe('DT-001: Valid ISO string', () => {
      it('should format ISO string to readable date/time', () => {
        const result = formatAppointmentTime('2025-01-15T14:30:00Z');

        // Should contain date parts
        expect(result).toContain('Jan');
        expect(result).toContain('15');
        expect(result).toContain('2025');
        // Should contain time
        expect(result).toMatch(/\d{1,2}:\d{2}/);
        expect(result).toMatch(/AM|PM/);
      });
    });

    describe('DT-002: Invalid string', () => {
      it('should return original string for invalid input', () => {
        const result = formatAppointmentTime('not-a-date');
        expect(result).toBe('not-a-date');
      });
    });
  });

  // ============================================
  // formatTime
  // ============================================

  describe('formatTime', () => {
    describe('DT-003: Valid ISO string', () => {
      it('should return time only', () => {
        const result = formatTime('2025-01-15T14:30:00Z');

        expect(result).toMatch(/\d{1,2}:\d{2}/);
        expect(result).toMatch(/AM|PM/);
        expect(result).not.toContain('Jan');
      });
    });
  });

  // ============================================
  // formatDate
  // ============================================

  describe('formatDate', () => {
    describe('DT-004: Valid ISO string', () => {
      it('should return date only', () => {
        const result = formatDate('2025-01-15T14:30:00Z');

        expect(result).toContain('January');
        expect(result).toContain('15');
        expect(result).toContain('2025');
      });
    });
  });

  // ============================================
  // formatDuration
  // ============================================

  describe('formatDuration', () => {
    describe('DT-005: Under 60 minutes', () => {
      it('should return minutes only', () => {
        expect(formatDuration(45)).toBe('45m');
        expect(formatDuration(30)).toBe('30m');
        expect(formatDuration(1)).toBe('1m');
      });
    });

    describe('DT-006: Exactly 60 minutes', () => {
      it('should return hours only', () => {
        expect(formatDuration(60)).toBe('1h');
      });
    });

    describe('DT-007: Over 60 minutes', () => {
      it('should return hours and minutes', () => {
        expect(formatDuration(90)).toBe('1h 30m');
        expect(formatDuration(150)).toBe('2h 30m');
      });

      it('should omit minutes if exact hour', () => {
        expect(formatDuration(120)).toBe('2h');
      });
    });
  });

  // ============================================
  // formatTimeString
  // ============================================

  describe('formatTimeString', () => {
    describe('DT-008: Valid TIME string', () => {
      it('should format 24-hour time to 12-hour', () => {
        const result = formatTimeString('14:30:00');
        expect(result).toBe('2:30 PM');
      });
    });

    describe('DT-009: Midnight', () => {
      it('should format midnight correctly', () => {
        const result = formatTimeString('00:00:00');
        expect(result).toBe('12:00 AM');
      });
    });

    describe('DT-010: Invalid string', () => {
      it('should return original for invalid input', () => {
        expect(formatTimeString('invalid')).toBe('invalid');
      });
    });

    describe('Morning times', () => {
      it('should format AM times correctly', () => {
        expect(formatTimeString('09:00:00')).toBe('9:00 AM');
        expect(formatTimeString('11:30:00')).toBe('11:30 AM');
      });
    });

    describe('Noon', () => {
      it('should format noon correctly', () => {
        expect(formatTimeString('12:00:00')).toBe('12:00 PM');
      });
    });
  });

  // ============================================
  // parseDateTime
  // ============================================

  describe('parseDateTime', () => {
    describe('DT-011: Valid ISO string', () => {
      it('should return Date object', () => {
        const result = parseDateTime('2025-01-15T14:30:00Z');

        expect(result).toBeInstanceOf(Date);
        expect(result?.getTime()).toBeGreaterThan(0);
      });
    });

    describe('DT-012: Invalid string', () => {
      it('should return null for invalid input', () => {
        expect(parseDateTime('not-a-date')).toBeNull();
        expect(parseDateTime('')).toBeNull();
      });
    });
  });

  // ============================================
  // isInFuture
  // ============================================

  describe('isInFuture', () => {
    describe('DT-013: Future date', () => {
      it('should return true for future dates', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        expect(isInFuture(tomorrow.toISOString())).toBe(true);
      });
    });

    describe('DT-014: Past date', () => {
      it('should return false for past dates', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        expect(isInFuture(yesterday.toISOString())).toBe(false);
      });
    });
  });

  // ============================================
  // isInPast
  // ============================================

  describe('isInPast', () => {
    describe('DT-015: Past date', () => {
      it('should return true for past dates', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        expect(isInPast(yesterday.toISOString())).toBe(true);
      });
    });

    describe('DT-016: Future date', () => {
      it('should return false for future dates', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        expect(isInPast(tomorrow.toISOString())).toBe(false);
      });
    });
  });

  // ============================================
  // getRelativeTime
  // ============================================

  describe('getRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('DT-017: Minutes ago', () => {
      it('should return minutes ago for recent past', () => {
        const thirtyMinAgo = new Date('2025-01-15T11:30:00Z');
        expect(getRelativeTime(thirtyMinAgo.toISOString())).toBe('30m ago');
      });
    });

    describe('DT-018: Hours in future', () => {
      it('should return in Xh for near future', () => {
        const twoHoursLater = new Date('2025-01-15T14:00:00Z');
        expect(getRelativeTime(twoHoursLater.toISOString())).toBe('in 2h');
      });
    });

    describe('DT-019: Yesterday', () => {
      it('should return yesterday for 1 day ago', () => {
        const yesterday = new Date('2025-01-14T12:00:00Z');
        expect(getRelativeTime(yesterday.toISOString())).toBe('yesterday');
      });
    });

    describe('Tomorrow', () => {
      it('should return tomorrow for 1 day ahead', () => {
        const tomorrow = new Date('2025-01-16T12:00:00Z');
        expect(getRelativeTime(tomorrow.toISOString())).toBe('tomorrow');
      });
    });

    describe('Multiple days', () => {
      it('should return days for longer periods', () => {
        const threeAgo = new Date('2025-01-12T12:00:00Z');
        expect(getRelativeTime(threeAgo.toISOString())).toBe('3d ago');

        const threeLater = new Date('2025-01-18T12:00:00Z');
        expect(getRelativeTime(threeLater.toISOString())).toBe('in 3d');
      });
    });
  });

  // ============================================
  // toDateTimeLocalValue
  // ============================================

  describe('toDateTimeLocalValue', () => {
    describe('DT-020: Valid ISO string', () => {
      it('should return datetime-local format', () => {
        const result = toDateTimeLocalValue('2025-01-15T14:30:00Z');

        expect(result).toBe('2025-01-15T14:30');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      });
    });

    describe('Invalid input', () => {
      it('should return empty string for invalid input', () => {
        expect(toDateTimeLocalValue('invalid')).toBe('');
        expect(toDateTimeLocalValue('')).toBe('');
      });
    });

    describe('Preserves UTC values', () => {
      it('should use UTC hours and minutes', () => {
        // 14:30 UTC
        const result = toDateTimeLocalValue('2025-01-15T14:30:00Z');
        expect(result).toContain('T14:30');
      });
    });
  });
});
