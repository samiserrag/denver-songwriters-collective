/**
 * React hook for showcase lineup management (Admin/Host only)
 * Handles setting performer lineup with validation
 */
'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { setShowcaseLineup } from '@/lib/supabase/rpc';
import type { EventSlot, MutationState } from '@/lib/supabase/types';
import { parseSupabaseError, isUnauthorizedError, isValidationError } from '@/lib/supabase/errors';

// ============================================
// SET LINEUP HOOK
// ============================================

interface UseSetLineupOptions {
  onSuccess?: (slots: EventSlot[]) => void;
  onError?: (error: Error) => void;
}

interface UseSetLineupResult {
  setLineup: (eventId: string, performerIds: string[]) => Promise<EventSlot[] | null>;
  isLoading: boolean;
  error: Error | null;
  data: EventSlot[] | null;
  isUnauthorized: boolean;
  isValidationError: boolean;
  reset: () => void;
}

/**
 * Hook for setting showcase event lineup (admin/host only)
 * @param options - Success/error callbacks
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * const { setLineup, isLoading, error, isUnauthorized } = useSetLineup({
 *   onSuccess: (slots) => {
 *     console.log('Lineup updated!', slots);
 *   }
 * });
 *
 * await setLineup(eventId, [performerId1, performerId2, performerId3]);
 * ```
 */
export function useSetLineup(options?: UseSetLineupOptions): UseSetLineupResult {
  const [state, setState] = useState<MutationState<EventSlot[]>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const setLineup = useCallback(
    async (eventId: string, performerIds: string[]): Promise<EventSlot[] | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await setShowcaseLineup(supabase, eventId, performerIds);

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
    setLineup,
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    isUnauthorized: state.error ? isUnauthorizedError(state.error) : false,
    isValidationError: state.error ? isValidationError(state.error) : false,
    reset,
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check for duplicate performer IDs in the lineup
 */
export function hasDuplicatePerformers(performerIds: string[]): boolean {
  const unique = new Set(performerIds);
  return unique.size !== performerIds.length;
}

/**
 * Get duplicate performer IDs
 */
export function getDuplicatePerformers(performerIds: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  performerIds.forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  });

  return Array.from(duplicates);
}

/**
 * Validate that performerIds array is not empty
 */
export function validateLineupNotEmpty(performerIds: string[]): boolean {
  return performerIds.length > 0;
}

/**
 * Validate that all IDs are valid UUIDs (basic check)
 */
export function validateUUIDs(performerIds: string[]): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return performerIds.every((id) => uuidRegex.test(id));
}

/**
 * Get validation errors for lineup input
 */
export function getLineupValidationErrors(performerIds: string[]): string[] {
  const errors: string[] = [];

  if (!validateLineupNotEmpty(performerIds)) {
    errors.push('Lineup cannot be empty');
  }

  if (hasDuplicatePerformers(performerIds)) {
    const duplicates = getDuplicatePerformers(performerIds);
    errors.push(`Duplicate performers found: ${duplicates.join(', ')}`);
  }

  if (!validateUUIDs(performerIds)) {
    errors.push('Invalid performer IDs detected');
  }

  return errors;
}
