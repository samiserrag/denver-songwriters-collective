/**
 * React hook for studio service booking
 * Handles appointment creation with double-booking protection
 */
'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { bookStudioService } from '@/lib/supabase/rpc';
import type { StudioAppointment, MutationState } from '@/lib/supabase/types';
import { parseSupabaseError, isDoubleBookingError } from '@/lib/supabase/errors';

// ============================================
// BOOK STUDIO HOOK
// ============================================

interface UseBookStudioOptions {
  onSuccess?: (appointment: StudioAppointment) => void;
  onError?: (error: Error) => void;
}

interface UseBookStudioResult {
  bookStudio: (serviceId: string, desiredTime: string) => Promise<StudioAppointment | null>;
  isLoading: boolean;
  error: Error | null;
  data: StudioAppointment | null;
  isDoubleBooking: boolean;
  reset: () => void;
}

/**
 * Hook for booking a studio service appointment
 * @param options - Success/error callbacks
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * const { bookStudio, isLoading, error } = useBookStudio({
 *   onSuccess: (appointment) => {
 *     console.log('Booked!', appointment);
 *   }
 * });
 *
 * await bookStudio(serviceId, '2025-01-15T14:00:00Z');
 * ```
 */
export function useBookStudio(options?: UseBookStudioOptions): UseBookStudioResult {
  const [state, setState] = useState<MutationState<StudioAppointment>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const bookStudio = useCallback(
    async (serviceId: string, desiredTime: string): Promise<StudioAppointment | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await bookStudioService(supabase, serviceId, desiredTime);

        setState({
          data: result,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        });

        // Call success callback if provided
        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const error = parseSupabaseError(err);

        setState({
          data: null,
          error,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });

        // Call error callback if provided
        if (options?.onError) {
          options.onError(error);
        }

        return null;
      }
    },
    [options?.onSuccess, options?.onError]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    bookStudio,
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    isDoubleBooking: state.error ? isDoubleBookingError(state.error) : false,
    reset,
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that the desired time is in the future
 */
export function validateFutureTime(desiredTime: string): boolean {
  try {
    const date = new Date(desiredTime);
    return date.getTime() > Date.now();
  } catch {
    return false;
  }
}

/**
 * Validate that the desired time is during reasonable hours
 * (8 AM - 10 PM by default)
 */
export function validateBusinessHours(
  desiredTime: string,
  startHour = 8,
  endHour = 22
): boolean {
  try {
    const date = new Date(desiredTime);
    const hour = date.getHours();
    return hour >= startHour && hour < endHour;
  } catch {
    return false;
  }
}

/**
 * Get the next available time slot (rounds up to next 30-min increment)
 */
export function getNextAvailableTime(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = minutes < 30 ? 30 : 60;

  now.setMinutes(roundedMinutes);
  now.setSeconds(0);
  now.setMilliseconds(0);

  if (roundedMinutes === 60) {
    now.setHours(now.getHours() + 1);
  }

  return now.toISOString();
}
