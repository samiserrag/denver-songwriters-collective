/**
 * Phase ABC6: Date Key Contract
 *
 * Shared helpers for per-occurrence data handling across all API routes.
 * This module provides:
 * - Date key validation (YYYY-MM-DD format)
 * - Effective date key computation (next occurrence if not provided)
 * - Cancelled occurrence detection
 *
 * INVARIANT: All RSVP/comment/timeslot/lineup operations must be scoped by date_key.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  computeNextOccurrence,
  getTodayDenver,
  type EventForOccurrence,
} from "./nextOccurrence";

/**
 * Strict YYYY-MM-DD date key validation regex.
 */
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a date key is in strict YYYY-MM-DD format.
 * Returns true if valid, false otherwise.
 */
export function isValidDateKey(dateKey: string | null | undefined): dateKey is string {
  if (!dateKey) return false;
  if (!DATE_KEY_REGEX.test(dateKey)) return false;
  // Also verify it's a real date
  const parsed = new Date(`${dateKey}T12:00:00Z`);
  return !isNaN(parsed.getTime());
}

/**
 * Error codes for date key contract violations.
 */
export const DATE_KEY_ERRORS = {
  INVALID_DATE_KEY: "INVALID_DATE_KEY",
  OCCURRENCE_CANCELLED: "OCCURRENCE_CANCELLED",
  EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
} as const;

export type DateKeyErrorCode = (typeof DATE_KEY_ERRORS)[keyof typeof DATE_KEY_ERRORS];

export interface DateKeyError {
  code: DateKeyErrorCode;
  message: string;
}

export interface DateKeyContractResult {
  success: true;
  effectiveDateKey: string;
  wasComputed: boolean;
}

export interface DateKeyContractError {
  success: false;
  error: DateKeyError;
}

export type DateKeyResult = DateKeyContractResult | DateKeyContractError;

/**
 * Resolve effective date_key for an operation.
 *
 * If date_key is provided and valid, use it directly.
 * If date_key is missing, compute the next occurrence for the event.
 *
 * @param eventId - The event ID
 * @param providedDateKey - Optional date_key from client
 * @returns DateKeyResult with effective date_key or error
 */
export async function resolveEffectiveDateKey(
  eventId: string,
  providedDateKey: string | null | undefined
): Promise<DateKeyResult> {
  // If provided, validate format
  if (providedDateKey !== null && providedDateKey !== undefined) {
    if (!isValidDateKey(providedDateKey)) {
      return {
        success: false,
        error: {
          code: DATE_KEY_ERRORS.INVALID_DATE_KEY,
          message: `Invalid date_key format: ${providedDateKey}. Expected YYYY-MM-DD.`,
        },
      };
    }
    return {
      success: true,
      effectiveDateKey: providedDateKey,
      wasComputed: false,
    };
  }

  // No date_key provided - compute from event
  const supabase = await createSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, event_date, day_of_week, recurrence_rule, is_recurring, start_time")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return {
      success: false,
      error: {
        code: DATE_KEY_ERRORS.EVENT_NOT_FOUND,
        message: `Event not found: ${eventId}`,
      },
    };
  }

  // Compute next occurrence
  const todayKey = getTodayDenver();
  const occurrence = computeNextOccurrence(event as EventForOccurrence, { todayKey });

  return {
    success: true,
    effectiveDateKey: occurrence.date,
    wasComputed: true,
  };
}

/**
 * Check if a specific occurrence is cancelled.
 *
 * @param eventId - The event ID
 * @param dateKey - The date key to check
 * @returns true if cancelled, false otherwise
 */
export async function isOccurrenceCancelled(
  eventId: string,
  dateKey: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: override } = await supabase
    .from("occurrence_overrides")
    .select("status")
    .eq("event_id", eventId)
    .eq("date_key", dateKey)
    .single();

  return override?.status === "cancelled";
}

/**
 * Validate date_key and check if occurrence is cancelled.
 * Use this before any write operation (RSVP, comment, claim).
 *
 * @param eventId - The event ID
 * @param providedDateKey - Optional date_key from client
 * @returns DateKeyResult with effective date_key or error (including OCCURRENCE_CANCELLED)
 */
export async function validateDateKeyForWrite(
  eventId: string,
  providedDateKey: string | null | undefined
): Promise<DateKeyResult> {
  // First resolve the effective date_key
  const resolved = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!resolved.success) {
    return resolved;
  }

  // Check if this occurrence is cancelled
  const cancelled = await isOccurrenceCancelled(eventId, resolved.effectiveDateKey);
  if (cancelled) {
    return {
      success: false,
      error: {
        code: DATE_KEY_ERRORS.OCCURRENCE_CANCELLED,
        message: `This occurrence (${resolved.effectiveDateKey}) has been cancelled.`,
      },
    };
  }

  return resolved;
}

/**
 * Format a date key for display in user-facing messages.
 * E.g., "2026-01-18" -> "January 18, 2026"
 */
export function formatDateKeyForDisplay(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Format a date key for short display.
 * E.g., "2026-01-18" -> "Sat, Jan 18"
 */
export function formatDateKeyShort(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Format a date key for email display in MM-DD-YYYY format.
 * E.g., "2026-01-18" -> "01-18-2026"
 */
export function formatDateKeyForEmail(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}-${day}-${year}`;
}

/**
 * Get the day of week name from a date key.
 * E.g., "2026-01-18" -> "Saturday"
 */
export function getDayOfWeekFromDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/Denver",
  });
}

/**
 * Standard API response helper for date_key errors.
 * Returns appropriate HTTP status and body.
 */
export function dateKeyErrorResponse(error: DateKeyError): Response {
  const status =
    error.code === DATE_KEY_ERRORS.OCCURRENCE_CANCELLED
      ? 409
      : error.code === DATE_KEY_ERRORS.EVENT_NOT_FOUND
        ? 404
        : 400;

  return Response.json(
    { error: error.message, code: error.code },
    { status }
  );
}
