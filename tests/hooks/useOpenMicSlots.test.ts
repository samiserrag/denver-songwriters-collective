/**
 * Hook Tests: useOpenMicSlots
 * Tests React hooks for slot management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
  },
}));

// Import after mocking
import { supabase } from '@/lib/supabase/client';
import { useClaimSlot, useUnclaimSlot, useAvailableSlots } from '@/hooks/useOpenMicSlots';

describe('Hooks: useOpenMicSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // useClaimSlot
  // ============================================

  describe('useClaimSlot', () => {
    describe('INT-H01: Success flow', () => {
      it('should transition loading states correctly on success', async () => {
        const mockSlot = {
          id: 'slot-123',
          event_id: 'event-456',
          performer_id: 'test-user-id',
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        };

        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: mockSlot,
          error: null,
        } as any);

        const { result } = renderHook(() => useClaimSlot());

        // Initial state
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.data).toBeNull();

        // Trigger claim
        let claimResult: any;
        await act(async () => {
          claimResult = await result.current.claimSlot('slot-123');
        });

        // Final state
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.data).toEqual(mockSlot);
        expect(claimResult).toEqual(mockSlot);
      });
    });

    describe('INT-H02: Error flow', () => {
      it('should set error state on failure', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Slot not available or you already have a slot' },
        } as any);

        const { result } = renderHook(() => useClaimSlot());

        let claimResult: any;
        await act(async () => {
          claimResult = await result.current.claimSlot('slot-123');
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).not.toBeNull();
        expect(result.current.data).toBeNull();
        expect(claimResult).toBeNull();
      });
    });

    describe('reset function', () => {
      it('should reset state to initial values', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: { id: 'slot-123' },
          error: null,
        } as any);

        const { result } = renderHook(() => useClaimSlot());

        await act(async () => {
          await result.current.claimSlot('slot-123');
        });

        expect(result.current.data).not.toBeNull();

        act(() => {
          result.current.reset();
        });

        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ============================================
  // useUnclaimSlot
  // ============================================

  describe('useUnclaimSlot', () => {
    describe('INT-H03: Success flow', () => {
      it('should return slot with null performer_id', async () => {
        const mockSlot = {
          id: 'slot-123',
          event_id: 'event-456',
          performer_id: null,
          slot_index: 1,
        };

        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: mockSlot,
          error: null,
        } as any);

        const { result } = renderHook(() => useUnclaimSlot());

        await act(async () => {
          await result.current.unclaimSlot('slot-123');
        });

        expect(result.current.data?.performer_id).toBeNull();
        expect(result.current.error).toBeNull();
      });
    });

    describe('Error flow', () => {
      it('should handle unauthorized unclaim', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Slot not found or does not belong to you' },
        } as any);

        const { result } = renderHook(() => useUnclaimSlot());

        await act(async () => {
          await result.current.unclaimSlot('slot-123');
        });

        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.message).toContain('belong to you');
      });
    });
  });

  // ============================================
  // useAvailableSlots
  // ============================================

  describe('useAvailableSlots', () => {
    describe('INT-H04: Initial fetch', () => {
      it('should fetch slots on mount', async () => {
        const mockSlots = [
          { id: 'slot-1', slot_index: 1, performer_id: null },
          { id: 'slot-2', slot_index: 2, performer_id: null },
        ];

        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: mockSlots,
          error: null,
        } as any);

        const { result } = renderHook(() => useAvailableSlots('event-123'));

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.slots).toHaveLength(2);
        expect(result.current.error).toBeNull();
      });
    });

    describe('INT-H06: Null eventId', () => {
      it('should not fetch when eventId is null', async () => {
        const { result } = renderHook(() => useAvailableSlots(null));

        expect(result.current.slots).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(supabase.rpc).not.toHaveBeenCalled();
      });
    });

    describe('INT-H05: Auto-refresh', () => {
      it('should refetch at specified interval', async () => {
        vi.useFakeTimers();

        const mockSlots = [{ id: 'slot-1', slot_index: 1 }];
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: mockSlots,
          error: null,
        } as any);

        renderHook(() => useAvailableSlots('event-123', true, 1000));

        // Initial fetch
        await vi.advanceTimersByTimeAsync(0);
        expect(supabase.rpc).toHaveBeenCalledTimes(1);

        // After interval
        await vi.advanceTimersByTimeAsync(1000);
        expect(supabase.rpc).toHaveBeenCalledTimes(2);

        // Another interval
        await vi.advanceTimersByTimeAsync(1000);
        expect(supabase.rpc).toHaveBeenCalledTimes(3);

        vi.useRealTimers();
      });
    });

    describe('refetch function', () => {
      it('should manually refresh slots', async () => {
        vi.mocked(supabase.rpc).mockResolvedValue({
          data: [{ id: 'slot-1' }],
          error: null,
        } as any);

        const { result } = renderHook(() => useAvailableSlots('event-123'));

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Clear mock calls
        vi.mocked(supabase.rpc).mockClear();

        // Manually refetch
        await act(async () => {
          await result.current.refetch();
        });

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
      });
    });

    describe('Error handling', () => {
      it('should set error and clear slots on failure', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Network error' },
        } as any);

        const { result } = renderHook(() => useAvailableSlots('event-123'));

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).not.toBeNull();
        expect(result.current.slots).toEqual([]);
      });
    });
  });
});
