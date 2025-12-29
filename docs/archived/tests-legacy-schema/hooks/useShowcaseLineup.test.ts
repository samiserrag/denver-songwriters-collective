/**
 * Hook Tests: useShowcaseLineup
 * Tests React hooks for showcase lineup management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
  useSetLineup,
  hasDuplicatePerformers,
  getDuplicatePerformers,
  validateLineupNotEmpty,
  validateUUIDs,
  getLineupValidationErrors,
} from '@/hooks/useShowcaseLineup';

describe('Hooks: useShowcaseLineup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // useSetLineup
  // ============================================

  describe('useSetLineup', () => {
    describe('INT-H09: Success flow', () => {
      it('should set lineup successfully as admin', async () => {
        const mockSlots = [
          { id: 'slot-1', slot_index: 1, performer_id: 'performer-1' },
          { id: 'slot-2', slot_index: 2, performer_id: 'performer-2' },
        ];

        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: mockSlots,
          error: null,
        } as any);

        const onSuccess = vi.fn();
        const { result } = renderHook(() => useSetLineup({ onSuccess }));

        await act(async () => {
          await result.current.setLineup('event-123', ['performer-1', 'performer-2']);
        });

        expect(result.current.data).toEqual(mockSlots);
        expect(result.current.error).toBeNull();
        expect(onSuccess).toHaveBeenCalledWith(mockSlots);
      });
    });

    describe('INT-H10: isUnauthorized flag', () => {
      it('should set isUnauthorized when not admin/host', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Only admins or event host can set showcase lineup' },
        } as any);

        const { result } = renderHook(() => useSetLineup());

        await act(async () => {
          await result.current.setLineup('event-123', ['performer-1']);
        });

        expect(result.current.isUnauthorized).toBe(true);
        expect(result.current.error).not.toBeNull();
      });

      it('should set isUnauthorized for permission denied', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'permission denied for table events' },
        } as any);

        const { result } = renderHook(() => useSetLineup());

        await act(async () => {
          await result.current.setLineup('event-123', ['performer-1']);
        });

        expect(result.current.isUnauthorized).toBe(true);
      });
    });

    describe('INT-H11: isValidationError flag', () => {
      it('should set isValidationError for duplicate performers', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Duplicate performer IDs found in lineup input' },
        } as any);

        const { result } = renderHook(() => useSetLineup());

        await act(async () => {
          await result.current.setLineup('event-123', ['performer-1', 'performer-1']);
        });

        expect(result.current.isValidationError).toBe(true);
      });

      it('should set isValidationError for non-existent performers', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'One or more performer IDs do not exist' },
        } as any);

        const { result } = renderHook(() => useSetLineup());

        await act(async () => {
          await result.current.setLineup('event-123', ['fake-id']);
        });

        expect(result.current.isValidationError).toBe(true);
      });
    });

    describe('Error callback', () => {
      it('should call onError callback on failure', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: null,
          error: { message: 'Event not found' },
        } as any);

        const onError = vi.fn();
        const { result } = renderHook(() => useSetLineup({ onError }));

        await act(async () => {
          await result.current.setLineup('fake-event', ['performer-1']);
        });

        expect(onError).toHaveBeenCalledTimes(1);
      });
    });

    describe('reset function', () => {
      it('should clear all state', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
          data: [{ id: 'slot-1' }],
          error: null,
        } as any);

        const { result } = renderHook(() => useSetLineup());

        await act(async () => {
          await result.current.setLineup('event-123', ['performer-1']);
        });

        expect(result.current.data).not.toBeNull();

        act(() => {
          result.current.reset();
        });

        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.isUnauthorized).toBe(false);
        expect(result.current.isValidationError).toBe(false);
      });
    });
  });

  // ============================================
  // Validation Helpers
  // ============================================

  describe('hasDuplicatePerformers', () => {
    describe('VAL-001: No duplicates', () => {
      it('should return false for unique array', () => {
        expect(hasDuplicatePerformers(['a', 'b', 'c'])).toBe(false);
      });
    });

    describe('VAL-002: Has duplicates', () => {
      it('should return true when duplicates exist', () => {
        expect(hasDuplicatePerformers(['a', 'b', 'a'])).toBe(true);
      });
    });
  });

  describe('getDuplicatePerformers', () => {
    describe('VAL-003: One duplicate', () => {
      it('should return the duplicate ID', () => {
        expect(getDuplicatePerformers(['a', 'b', 'a'])).toEqual(['a']);
      });
    });

    describe('VAL-004: Multiple duplicates', () => {
      it('should return all duplicate IDs', () => {
        const result = getDuplicatePerformers(['a', 'a', 'b', 'b', 'c']);
        expect(result).toContain('a');
        expect(result).toContain('b');
        expect(result).not.toContain('c');
      });
    });

    describe('No duplicates', () => {
      it('should return empty array', () => {
        expect(getDuplicatePerformers(['a', 'b', 'c'])).toEqual([]);
      });
    });
  });

  describe('validateLineupNotEmpty', () => {
    describe('VAL-005: Empty array', () => {
      it('should return false for empty array', () => {
        expect(validateLineupNotEmpty([])).toBe(false);
      });
    });

    describe('VAL-006: Non-empty array', () => {
      it('should return true for non-empty array', () => {
        expect(validateLineupNotEmpty(['a'])).toBe(true);
        expect(validateLineupNotEmpty(['a', 'b', 'c'])).toBe(true);
      });
    });
  });

  describe('validateUUIDs', () => {
    describe('VAL-007: Valid UUIDs', () => {
      it('should return true for valid UUIDs', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ];
        expect(validateUUIDs(validUUIDs)).toBe(true);
      });
    });

    describe('VAL-008: Invalid UUIDs', () => {
      it('should return false for invalid UUIDs', () => {
        expect(validateUUIDs(['not-a-uuid'])).toBe(false);
        expect(validateUUIDs(['123'])).toBe(false);
        expect(validateUUIDs([''])).toBe(false);
      });

      it('should return false if any UUID is invalid', () => {
        const mixedUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'invalid',
        ];
        expect(validateUUIDs(mixedUUIDs)).toBe(false);
      });
    });

    describe('Empty array', () => {
      it('should return true for empty array', () => {
        expect(validateUUIDs([])).toBe(true);
      });
    });
  });

  describe('getLineupValidationErrors', () => {
    describe('VAL-009: All valid', () => {
      it('should return empty array for valid input', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ];
        expect(getLineupValidationErrors(validUUIDs)).toEqual([]);
      });
    });

    describe('VAL-010: Empty lineup', () => {
      it('should return error for empty array', () => {
        const errors = getLineupValidationErrors([]);
        expect(errors).toContain('Lineup cannot be empty');
      });
    });

    describe('Multiple errors', () => {
      it('should return all applicable errors', () => {
        const invalidInput = ['invalid-uuid', 'invalid-uuid']; // Empty, duplicates, invalid UUIDs

        const errors = getLineupValidationErrors(invalidInput);
        
        // Should have duplicate and invalid UUID errors
        expect(errors.some(e => e.includes('Duplicate'))).toBe(true);
        expect(errors.some(e => e.includes('Invalid'))).toBe(true);
      });
    });
  });
});
