/**
 * Phase 5.08: Signup Meta Helper
 *
 * Provides consistent signup method display across all surfaces:
 * - Timeline cards (HappeningCard)
 * - Series cards (SeriesCard)
 * - Event detail pages
 *
 * Precedence rule:
 * - If timeslots enabled (has_timeslots=true): show "Online signup"
 * - If timeslots disabled + signup_time present: show "Signups at {time}"
 * - Otherwise: null (no meta to show)
 */

import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";

export interface SignupMetaInput {
  /** Whether online timeslots are enabled for this event */
  hasTimeslots: boolean | null | undefined;
  /** In-person signup time (HH:MM:SS format) */
  signupTime: string | null | undefined;
}

export interface SignupMetaResult {
  /** Whether to show the signup meta chip/text */
  show: boolean;
  /** The display label (e.g., "Online signup" or "Signups at 6:30 PM") */
  label: string | null;
  /** The type of signup method */
  type: "online" | "in_person" | null;
}

/**
 * Get signup method display meta for an event.
 *
 * @param input - The timeslots and signup_time values
 * @returns SignupMetaResult with show flag, label, and type
 *
 * @example
 * // Online timeslots enabled
 * getSignupMeta({ hasTimeslots: true, signupTime: "18:30:00" })
 * // Returns: { show: true, label: "Online signup", type: "online" }
 *
 * @example
 * // In-person signup only
 * getSignupMeta({ hasTimeslots: false, signupTime: "18:30:00" })
 * // Returns: { show: true, label: "Signups at 6:30 PM", type: "in_person" }
 *
 * @example
 * // No signup configured
 * getSignupMeta({ hasTimeslots: false, signupTime: null })
 * // Returns: { show: false, label: null, type: null }
 */
export function getSignupMeta(input: SignupMetaInput): SignupMetaResult {
  const { hasTimeslots, signupTime } = input;

  // Rule 1: Timeslots enabled takes precedence
  if (hasTimeslots) {
    return {
      show: true,
      label: "Online signup",
      type: "online",
    };
  }

  // Rule 2: In-person signup time
  if (signupTime) {
    const formattedTime = formatTimeToAMPM(signupTime);
    return {
      show: true,
      label: `Signups at ${formattedTime}`,
      type: "in_person",
    };
  }

  // No signup method configured
  return {
    show: false,
    label: null,
    type: null,
  };
}
