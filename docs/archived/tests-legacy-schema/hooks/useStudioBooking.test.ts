/**
 * Hook Tests: useStudioBooking
 * Tests React hooks for studio appointment booking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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
import {
  useBookStudio,
  validateFutureTime,
  validateBusinessHours,
  getNextAvailableTime,
} from '@/hooks/useStudioBooking';

describe('Hooks: useStudioBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // useBookStudio
  // ============================================

  describe('useBookStudio', () => {
    describe('INT-H07: Success with callback', () => {
      it('should call onSuccess callback on successful booking', async () => {
        const mockAppointment = {
          id: 'appt-123',
          service_id: 'service-456',
          performer_id: 'test-user-id',
          appointment_time: '2025-02-15T14:00:00Z',
          status: 'pending',
        };

        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: mockAppointment,
          error: null,
        } as any);

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useBookStudio({ onSuccess }));

        await act(async () => {
          await result.current.bookStudio('service-456', '2025-02-15T14:00:00Z');
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledWith(mockAppointment);
        expect(result.current.data).toEqual(mockAppointment);
      });
    });

    describe('INT-H08: isDoubleBooking flag', () => {
      it('should set isDoubleBooking when time slot is taken', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Time slot already booked' },
        } as any);

        const { result } = renderHook(() => useBookStudio());

        await act(async () => {
          await result.current.bookStudio('service-456', '2025-02-15T14:00:00Z');
        });

        expect(result.current.isDoubleBooking).toBe(true);
        expect(result.current.error).not.toBeNull();
      });

      it('should not set isDoubleBooking for other errors', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Service not found' },
        } as any);

        const { result } = renderHook(() => useBookStudio());

        await act(async () => {
          await result.current.bookStudio('invalid-service', '2025-02-15T14:00:00Z');
        });

        expect(result.current.isDoubleBooking).toBe(false);
        expect(result.current.error).not.toBeNull();
      });
    });

    describe('Error callback', () => {
      it('should call onError callback on failure', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Appointment time must be in the future' },
        } as any);

        const onError = vi.fn();
        const { result } = renderHook(() => useBookStudio({ onError }));

        await act(async () => {
          await result.current.bookStudio('service-456', '2020-01-01T14:00:00Z');
        });

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('Loading state', () => {
      it('should toggle loading state during request', async () => {
        let resolveRpc: (value: any) => void;
        const rpcPromise = new Promise((resolve) => {
          resolveRpc = resolve;
        });

        vi.mocked(supabase.rpc).mockReturnValueOnce(rpcPromise as any);

        const { result } = renderHook(() => useBookStudio());

        expect(result.current.isLoading).toBe(false);

        // Start booking (don't await)
        const bookingPromise = act(async () => {
          result.current.bookStudio('service-456', '2025-02-15T14:00:00Z');
        });

        // Should be loading
        await waitFor(() => {
          expect(result.current.isLoading).toBe(true);
        });

        // Resolve the RPC
        resolveRpc!({ data: { id: 'appt-123' }, error: null });
        await bookingPromise;

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe('reset function', () => {
      it('should clear all state', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: { id: 'appt-123' },
          error: null,
        } as any);

        const { result } = renderHook(() => useBookStudio());

        await act(async () => {
          await result.current.bookStudio('service-456', '2025-02-15T14:00:00Z');
        });

        expect(result.current.data).not.toBeNull();

        act(() => {
          result.current.reset();
        });

        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.isDoubleBooking).toBe(false);
      });
    });
  });

  // ============================================
  // Validation Helpers
  // ============================================

  describe('validateFutureTime', () => {
    describe('SB-001: Future time', () => {
      it('should return true for future dates', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        expect(validateFutureTime(tomorrow.toISOString())).toBe(true);
      });
    });

    describe('SB-002: Past time', () => {
      it('should return false for past dates', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        expect(validateFutureTime(yesterday.toISOString())).toBe(false);
      });
    });

    describe('SB-003: Invalid input', () => {
      it('should return false for invalid date strings', () => {
        expect(validateFutureTime('not-a-date')).toBe(false);
        expect(validateFutureTime('')).toBe(false);
      });
    });
  });

  describe('validateBusinessHours', () => {
    describe('SB-004: Within hours', () => {
      it('should return true for 2 PM', () => {
        const date = new Date();
        date.setHours(14, 0, 0, 0);
        
        expect(validateBusinessHours(date.toISOString())).toBe(true);
      });
    });

    describe('SB-005: Before open', () => {
      it('should return false for 6 AM', () => {
        const date = new Date();
        date.setHours(6, 0, 0, 0);
        
        expect(validateBusinessHours(date.toISOString())).toBe(false);
      });
    });

    describe('SB-006: After close', () => {
      it('should return false for 11 PM', () => {
        const date = new Date();
        date.setHours(23, 0, 0, 0);
        
        expect(validateBusinessHours(date.toISOString())).toBe(false);
      });
    });

    describe('Custom hours', () => {
      it('should respect custom start/end hours', () => {
        const date = new Date();
        date.setHours(7, 0, 0, 0);
        
        // Default: 8-22
        expect(validateBusinessHours(date.toISOString())).toBe(false);
        
        // Custom: 6-20
        expect(validateBusinessHours(date.toISOString(), 6, 20)).toBe(true);
      });
    });
  });

  describe('getNextAvailableTime', () => {
    describe('SB-007: Returns valid ISO string', () => {
      it('should return a valid ISO timestamp', () => {
        const result = getNextAvailableTime();
        
        expect(typeof result).toBe('string');
        expect(new Date(result).toString()).not.toBe('Invalid Date');
      });

      it('should be in the future', () => {
        const result = getNextAvailableTime();
        const resultDate = new Date(result);
        
        expect(resultDate.getTime()).toBeGreaterThan(Date.now() - 60000); // Within 1 min
      });

      it('should be rounded to 30-minute increment', () => {
        const result = getNextAvailableTime();
        const resultDate = new Date(result);
        const minutes = resultDate.getMinutes();
        
        expect(minutes === 0 || minutes === 30).toBe(true);
        expect(resultDate.getSeconds()).toBe(0);
        expect(resultDate.getMilliseconds()).toBe(0);
      });
    });
  });
});
