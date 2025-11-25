/**
 * React hooks for open mic slot management
 * Handles claiming, unclaiming, and fetching available slots
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  claimOpenMicSlot,
  unclaimOpenMicSlot,
  getAvailableSlotsForEvent,
  getAllSlotsForEvent,
} from '@/lib/supabase/rpc';
import type { EventSlot, MutationState } from '@/lib/supabase/types';
import { parseSupabaseError } from '@/lib/supabase/errors';

// ============================================
// CLAIM SLOT HOOK
// ============================================

interface UseClaimSlotResult {
  claimSlot: (slotId: string) => Promise<EventSlot | null>;
  isLoading: boolean;
  error: Error | null;
  data: EventSlot | null;
  reset: () => void;
}

/**
 * Hook for claiming an open mic slot
 * @returns Mutation functions and state
 */
export function useClaimSlot(): UseClaimSlotResult {
  const [state, setState] = useState<MutationState<EventSlot>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const claimSlot = useCallback(async (slotId: string): Promise<EventSlot | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await claimOpenMicSlot(supabase, slotId);
      setState({
        data: result,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });
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
      return null;
    }
  }, []);

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
    claimSlot,
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    reset,
  };
}

// ============================================
// UNCLAIM SLOT HOOK
// ============================================

interface UseUnclaimSlotResult {
  unclaimSlot: (slotId: string) => Promise<EventSlot | null>;
  isLoading: boolean;
  error: Error | null;
  data: EventSlot | null;
  reset: () => void;
}

/**
 * Hook for unclaiming a previously claimed slot
 * @returns Mutation functions and state
 */
export function useUnclaimSlot(): UseUnclaimSlotResult {
  const [state, setState] = useState<MutationState<EventSlot>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const unclaimSlot = useCallback(async (slotId: string): Promise<EventSlot | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await unclaimOpenMicSlot(supabase, slotId);
      setState({
        data: result,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });
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
      return null;
    }
  }, []);

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
    unclaimSlot,
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    reset,
  };
}

// ============================================
// GET AVAILABLE SLOTS HOOK
// ============================================

interface UseAvailableSlotsResult {
  slots: EventSlot[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching available slots for an event
 * Auto-refreshes when eventId changes
 * @param eventId - The event ID to fetch slots for
 * @param autoRefresh - Whether to auto-refresh (default: false)
 * @param refreshInterval - Refresh interval in ms (default: 30000)
 */
export function useAvailableSlots(
  eventId: string | null,
  autoRefresh = false,
  refreshInterval = 30000
): UseAvailableSlotsResult {
  const [slots, setSlots] = useState<EventSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!eventId) {
      setSlots([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getAvailableSlotsForEvent(supabase, eventId);
      setSlots(result);
    } catch (err) {
      setError(parseSupabaseError(err));
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Fetch on mount and when eventId changes
  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !eventId) return;

    const interval = setInterval(() => {
      fetchSlots();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, eventId, refreshInterval, fetchSlots]);

  return {
    slots,
    isLoading,
    error,
    refetch: fetchSlots,
  };
}

// ============================================
// GET ALL SLOTS HOOK (INCLUDING CLAIMED)
// ============================================

interface UseAllSlotsResult {
  slots: EventSlot[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching ALL slots for an event (including claimed)
 * Auto-refreshes when eventId changes
 * @param eventId - The event ID to fetch slots for
 * @param autoRefresh - Whether to auto-refresh (default: false)
 * @param refreshInterval - Refresh interval in ms (default: 30000)
 */
export function useAllSlots(
  eventId: string | null,
  autoRefresh = false,
  refreshInterval = 30000
): UseAllSlotsResult {
  const [slots, setSlots] = useState<EventSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!eventId) {
      setSlots([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getAllSlotsForEvent(supabase, eventId);
      setSlots(result);
    } catch (err) {
      setError(parseSupabaseError(err));
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Fetch on mount and when eventId changes
  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !eventId) return;

    const interval = setInterval(() => {
      fetchSlots();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, eventId, refreshInterval, fetchSlots]);

  return {
    slots,
    isLoading,
    error,
    refetch: fetchSlots,
  };
}
