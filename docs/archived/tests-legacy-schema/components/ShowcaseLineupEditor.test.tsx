/**
 * Component Tests: ShowcaseLineupEditor
 * Tests the showcase lineup editor UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock hooks and modules
vi.mock('@/hooks/useShowcaseLineup', () => ({
  useSetLineup: vi.fn(),
  hasDuplicatePerformers: vi.fn(),
  getLineupValidationErrors: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Import after mocking
import { ShowcaseLineupEditor } from '@/components/examples/ShowcaseLineupEditor';
import { useSetLineup, hasDuplicatePerformers, getLineupValidationErrors } from '@/hooks/useShowcaseLineup';
import { supabase } from '@/lib/supabase/client';

describe('Components: ShowcaseLineupEditor', () => {
  const mockSetLineup = vi.fn();
  const mockReset = vi.fn();

  const mockPerformers = [
    { id: 'performer-1', full_name: 'Alice Artist', role: 'performer' as const },
    { id: 'performer-2', full_name: 'Bob Beatmaker', role: 'performer' as const },
    { id: 'performer-3', full_name: 'Carol Composer', role: 'performer' as const },
  ];

  const mockEvent = {
    id: 'event-123',
    host_id: 'host-user',
    title: 'Summer Showcase',
    is_showcase: true,
    event_date: '2025-06-15',
    start_time: '19:00:00',
    end_time: '22:00:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSetLineup).mockReturnValue({
      setLineup: mockSetLineup,
      isLoading: false,
      error: null,
      data: null,
      isUnauthorized: false,
      isValidationError: false,
      reset: mockReset,
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'admin-user-id' } },
      error: null,
    } as any);

    // Mock profile query for role check
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    } as any);

    vi.mocked(hasDuplicatePerformers).mockReturnValue(false);
    vi.mocked(getLineupValidationErrors).mockReturnValue([]);
  });

  describe('INT-C11: Renders performers', () => {
    it('should display available performers list', async () => {
      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={[]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Alice Artist')).toBeInTheDocument();
        expect(screen.getByText('Bob Beatmaker')).toBeInTheDocument();
        expect(screen.getByText('Carol Composer')).toBeInTheDocument();
      });
    });
  });

  describe('INT-C12: Add performer', () => {
    it('should move performer to lineup when add is clicked', async () => {
      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={[]}
        />
      );

      await waitFor(async () => {
        // Find and click add button for Alice
        const addButtons = screen.getAllByText('Add to Lineup');
        fireEvent.click(addButtons[0]);
      });

      await waitFor(() => {
        // Alice should now be in Current Lineup section
        const lineupSection = screen.getByTestId('current-lineup');
        expect(lineupSection).toContainElement(screen.getByText('Alice Artist'));
      });
    });
  });

  describe('INT-C13: Remove performer', () => {
    it('should remove performer from lineup when remove is clicked', async () => {
      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1']}
        />
      );

      await waitFor(async () => {
        const removeButton = screen.getByText('Remove');
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        // Alice should be back in Available section
        const availableSection = screen.getByTestId('available-performers');
        expect(availableSection).toContainElement(screen.getByText('Alice Artist'));
      });
    });
  });

  describe('INT-C14: Reorder works', () => {
    it('should move performer up when up arrow is clicked', async () => {
      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1', 'performer-2']}
        />
      );

      await waitFor(async () => {
        // Find move up button for second performer (Bob)
        const moveUpButtons = screen.getAllByLabelText('Move up');
        fireEvent.click(moveUpButtons[0]); // Second item's move up
      });

      await waitFor(() => {
        const lineupItems = screen.getAllByTestId('lineup-item');
        expect(lineupItems[0]).toHaveTextContent('Bob Beatmaker');
        expect(lineupItems[1]).toHaveTextContent('Alice Artist');
      });
    });

    it('should move performer down when down arrow is clicked', async () => {
      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1', 'performer-2']}
        />
      );

      await waitFor(async () => {
        const moveDownButtons = screen.getAllByLabelText('Move down');
        fireEvent.click(moveDownButtons[0]); // First item's move down
      });

      await waitFor(() => {
        const lineupItems = screen.getAllByTestId('lineup-item');
        expect(lineupItems[0]).toHaveTextContent('Bob Beatmaker');
        expect(lineupItems[1]).toHaveTextContent('Alice Artist');
      });
    });
  });

  describe('INT-C15: Submit calls hook', () => {
    it('should call setLineup with performer IDs when save is clicked', async () => {
      mockSetLineup.mockResolvedValue([{ id: 'slot-1' }]);

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1', 'performer-2']}
        />
      );

      await waitFor(async () => {
        const saveButton = screen.getByText('Save Lineup');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockSetLineup).toHaveBeenCalledWith('event-123', [
          'performer-1',
          'performer-2',
        ]);
      });
    });
  });

  describe('INT-C16: Validation errors', () => {
    it('should show error for duplicate performers', async () => {
      vi.mocked(hasDuplicatePerformers).mockReturnValue(true);
      vi.mocked(getLineupValidationErrors).mockReturnValue([
        'Duplicate performers detected',
      ]);

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1', 'performer-1']}
        />
      );

      await waitFor(async () => {
        const saveButton = screen.getByText('Save Lineup');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Duplicate performers detected')).toBeInTheDocument();
      });
    });
  });

  describe('Unauthorized state', () => {
    it('should show access denied message for non-admin', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'performer' },
              error: null,
            }),
          }),
        }),
      } as any);

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={[]}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(
          screen.getByText(/must be an admin or event host/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Server-side unauthorized', () => {
    it('should display unauthorized message from hook', async () => {
      vi.mocked(useSetLineup).mockReturnValue({
        setLineup: mockSetLineup,
        isLoading: false,
        error: new Error('Only admins or event host can set showcase lineup'),
        data: null,
        isUnauthorized: true,
        isValidationError: false,
        reset: mockReset,
      });

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1']}
        />
      );

      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  describe('Success state', () => {
    it('should show success message after saving', async () => {
      vi.mocked(useSetLineup).mockReturnValue({
        setLineup: mockSetLineup,
        isLoading: false,
        error: null,
        data: [{ id: 'slot-1', performer_id: 'performer-1' }] as any,
        isUnauthorized: false,
        isValidationError: false,
        reset: mockReset,
      });

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1']}
        />
      );

      expect(screen.getByText('Lineup Saved!')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show Saving... when in progress', async () => {
      vi.mocked(useSetLineup).mockReturnValue({
        setLineup: mockSetLineup,
        isLoading: true,
        error: null,
        data: null,
        isUnauthorized: false,
        isValidationError: false,
        reset: mockReset,
      });

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1']}
        />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should disable save button when loading', async () => {
      vi.mocked(useSetLineup).mockReturnValue({
        setLineup: mockSetLineup,
        isLoading: true,
        error: null,
        data: null,
        isUnauthorized: false,
        isValidationError: false,
        reset: mockReset,
      });

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={['performer-1']}
        />
      );

      const button = screen.getByRole('button', { name: /saving/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Empty lineup', () => {
    it('should show empty state when no performers in lineup', async () => {
      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={[]}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('Add performers from the list below')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Host can edit', () => {
    it('should allow event host to edit lineup', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'host-user' } }, // Same as event.host_id
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'host' }, // Not admin, but is the host
              error: null,
            }),
          }),
        }),
      } as any);

      render(
        <ShowcaseLineupEditor
          event={mockEvent as any}
          performers={mockPerformers as any}
          initialLineup={[]}
        />
      );

      await waitFor(() => {
        // Should not show Access Denied
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
        // Should show the editor
        expect(screen.getByText('Save Lineup')).toBeInTheDocument();
      });
    });
  });
});
