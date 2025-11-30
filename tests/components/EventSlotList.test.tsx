/**
 * Component Tests: EventSlotList
 * Tests the slot list UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock hooks
vi.mock('@/hooks/useOpenMicSlots', () => ({
  useClaimSlot: vi.fn(),
  useUnclaimSlot: vi.fn(),
  useAvailableSlots: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/lib/utils/datetime', () => ({
  formatTimeString: vi.fn((time: string) => time),
}));

// Import after mocking
import { EventSlotList } from '@/components/examples/EventSlotList';
import { useClaimSlot, useUnclaimSlot, useAvailableSlots } from '@/hooks/useOpenMicSlots';
import { supabase } from '@/lib/supabase/client';

describe('Components: EventSlotList', () => {
  const mockRefetch = vi.fn();
  const mockClaimSlot = vi.fn();
  const mockUnclaimSlot = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useAvailableSlots).mockReturnValue({
      slots: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    vi.mocked(useClaimSlot).mockReturnValue({
      claimSlot: mockClaimSlot,
      isLoading: false,
      error: null,
      data: null,
      reset: mockReset,
    });

    vi.mocked(useUnclaimSlot).mockReturnValue({
      unclaimSlot: mockUnclaimSlot,
      isLoading: false,
      error: null,
      data: null,
      reset: mockReset,
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'current-user-id' } },
      error: null,
    } as any);
  });

  describe('INT-C01: Renders slots', () => {
    it('should display slot cards when slots are available', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
        {
          id: 'slot-2',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 2,
          start_time: '19:15:00',
          end_time: '19:30:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('Slot #1')).toBeInTheDocument();
        expect(screen.getByText('Slot #2')).toBeInTheDocument();
      });
    });
  });

  describe('INT-C02: Loading state', () => {
    it('should show loading spinner when loading', () => {
      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: [],
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      expect(screen.getByText('Loading slots...')).toBeInTheDocument();
    });
  });

  describe('INT-C03: Error state', () => {
    it('should display error message when error occurs', () => {
      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: [],
        isLoading: false,
        error: new Error('Failed to load slots'),
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      expect(screen.getByText('Error loading slots')).toBeInTheDocument();
      expect(screen.getByText('Failed to load slots')).toBeInTheDocument();
    });

    it('should show Try Again button on error', () => {
      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: [],
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      const tryAgainButton = screen.getByText('Try Again');
      expect(tryAgainButton).toBeInTheDocument();

      fireEvent.click(tryAgainButton);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('INT-C04: Claim button works', () => {
    it('should call claimSlot when clicking Claim Slot button', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      mockClaimSlot.mockResolvedValue({ id: 'slot-1' });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        const claimButton = screen.getByText('Claim Slot');
        fireEvent.click(claimButton);
      });

      expect(mockClaimSlot).toHaveBeenCalledWith('slot-1');
    });
  });

  describe('INT-C05: Unclaim button works', () => {
    it('should call unclaimSlot when clicking Unclaim Slot button', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: 'current-user-id', // User owns this slot
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      mockUnclaimSlot.mockResolvedValue({ id: 'slot-1', performer_id: null });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        const unclaimButton = screen.getByText('Unclaim Slot');
        fireEvent.click(unclaimButton);
      });

      expect(mockUnclaimSlot).toHaveBeenCalledWith('slot-1');
    });
  });

  describe('INT-C06: No auth state', () => {
    it('should show sign in message when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('Sign in to claim slots')).toBeInTheDocument();
      });
    });
  });

  describe('Empty slots state', () => {
    it('should show message when no slots available', () => {
      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      expect(screen.getByText('No available slots for this event.')).toBeInTheDocument();
    });
  });

  describe('Your Slot badge', () => {
    it('should show Your Slot badge for owned slots', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: 'current-user-id',
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('Your Slot')).toBeInTheDocument();
      });
    });
  });

  describe('Claim error display', () => {
    it('should display claim error message', async () => {
      vi.mocked(useClaimSlot).mockReturnValue({
        claimSlot: mockClaimSlot,
        isLoading: false,
        error: new Error('Slot not available'),
        data: null,
        reset: mockReset,
      });

      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('Slot not available')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh button', () => {
    it('should call refetch when clicking refresh', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      const refreshButton = screen.getByLabelText('Refresh slots');
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Loading states on buttons', () => {
    it('should show Claiming... when claim is in progress', async () => {
      vi.mocked(useClaimSlot).mockReturnValue({
        claimSlot: mockClaimSlot,
        isLoading: true,
        error: null,
        data: null,
        reset: mockReset,
      });

      const mockSlots = [
        {
          id: 'slot-1',
          event_id: 'event-123',
          performer_id: null,
          slot_index: 1,
          start_time: '19:00:00',
          end_time: '19:15:00',
        },
      ];

      vi.mocked(useAvailableSlots).mockReturnValue({
        slots: mockSlots,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<EventSlotList eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('Claiming...')).toBeInTheDocument();
      });
    });
  });
});
