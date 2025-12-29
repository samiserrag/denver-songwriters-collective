/**
 * Component Tests: StudioBookingForm
 * Tests the studio booking form UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock hooks and modules
vi.mock('@/hooks/useStudioBooking', () => ({
  useBookStudio: vi.fn(),
  validateFutureTime: vi.fn(),
  getNextAvailableTime: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/lib/utils/datetime', () => ({
  formatAppointmentTime: vi.fn((time: string) => time),
  toDateTimeLocalValue: vi.fn(() => '2025-02-15T14:00'),
}));

vi.mock('@/lib/supabase/rpc', () => ({
  formatPrice: vi.fn((cents: number) => `$${(cents / 100).toFixed(2)}`),
}));

// Import after mocking
import { StudioBookingForm } from '@/components/examples/StudioBookingForm';
import { useBookStudio, validateFutureTime, getNextAvailableTime } from '@/hooks/useStudioBooking';
import { supabase } from '@/lib/supabase/client';

describe('Components: StudioBookingForm', () => {
  const mockBookStudio = vi.fn();
  const mockReset = vi.fn();

  const mockServices = [
    {
      id: 'service-1',
      studio_id: 'studio-123',
      name: 'Recording Session',
      description: 'Professional recording',
      price_cents: 5000,
      duration_min: 60,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'service-2',
      studio_id: 'studio-123',
      name: 'Mixing Session',
      description: 'Professional mixing',
      price_cents: 7500,
      duration_min: 120,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useBookStudio).mockReturnValue({
      bookStudio: mockBookStudio,
      isLoading: false,
      error: null,
      data: null,
      isDoubleBooking: false,
      reset: mockReset,
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    } as any);

    vi.mocked(validateFutureTime).mockReturnValue(true);
    vi.mocked(getNextAvailableTime).mockReturnValue('2025-02-15T14:00:00Z');
  });

  describe('INT-C07: Renders services', () => {
    it('should populate dropdown with available services', async () => {
      render(<StudioBookingForm services={mockServices} />);

      await waitFor(() => {
        expect(screen.getByText('Choose a service...')).toBeInTheDocument();
        expect(screen.getByText(/Recording Session/)).toBeInTheDocument();
        expect(screen.getByText(/Mixing Session/)).toBeInTheDocument();
      });
    });
  });

  describe('INT-C08: Submit calls hook', () => {
    it('should call bookStudio with correct args on submit', async () => {
      mockBookStudio.mockResolvedValue({ id: 'appt-123' });

      render(<StudioBookingForm services={mockServices} />);

      await waitFor(async () => {
        // Select service
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'service-1' } });

        // Submit form
        const submitButton = screen.getByText('Book Session');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockBookStudio).toHaveBeenCalledWith(
          'service-1',
          expect.any(String) // ISO timestamp
        );
      });
    });
  });

  describe('INT-C09: Shows success state', () => {
    it('should display booking confirmed message after success', async () => {
      const mockAppointment = {
        id: 'appt-123',
        service_id: 'service-1',
        performer_id: 'test-user-id',
        appointment_time: '2025-02-15T14:00:00Z',
        status: 'pending',
      };

      vi.mocked(useBookStudio).mockReturnValue({
        bookStudio: mockBookStudio,
        isLoading: false,
        error: null,
        data: mockAppointment as any,
        isDoubleBooking: false,
        reset: mockReset,
      });

      render(<StudioBookingForm services={mockServices} />);

      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
      expect(screen.getByText(/pending/)).toBeInTheDocument();
    });
  });

  describe('INT-C10: Shows double-book error', () => {
    it('should display Time Slot Unavailable for double booking', async () => {
      vi.mocked(useBookStudio).mockReturnValue({
        bookStudio: mockBookStudio,
        isLoading: false,
        error: new Error('Time slot already booked'),
        data: null,
        isDoubleBooking: true,
        reset: mockReset,
      });

      render(<StudioBookingForm services={mockServices} />);

      expect(screen.getByText('Time Slot Unavailable')).toBeInTheDocument();
    });

    it('should display generic Booking Error for other errors', async () => {
      vi.mocked(useBookStudio).mockReturnValue({
        bookStudio: mockBookStudio,
        isLoading: false,
        error: new Error('Service not found'),
        data: null,
        isDoubleBooking: false,
        reset: mockReset,
      });

      render(<StudioBookingForm services={mockServices} />);

      expect(screen.getByText('Booking Error')).toBeInTheDocument();
    });
  });

  describe('Not authenticated state', () => {
    it('should show sign in message when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      render(<StudioBookingForm services={mockServices} />);

      await waitFor(() => {
        expect(screen.getByText('Please sign in to book studio services')).toBeInTheDocument();
      });
    });
  });

  describe('No services state', () => {
    it('should show message when no services available', async () => {
      render(<StudioBookingForm services={[]} />);

      await waitFor(() => {
        expect(screen.getByText('No studio services available')).toBeInTheDocument();
      });
    });
  });

  describe('Service details display', () => {
    it('should show service details when selected', async () => {
      render(<StudioBookingForm services={mockServices} />);

      await waitFor(async () => {
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'service-1' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Professional recording')).toBeInTheDocument();
        expect(screen.getByText(/60 minutes/)).toBeInTheDocument();
      });
    });
  });

  describe('Validation errors', () => {
    it('should show error if no service selected', async () => {
      render(<StudioBookingForm services={mockServices} />);

      await waitFor(async () => {
        const submitButton = screen.getByText('Book Session');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Please select a service')).toBeInTheDocument();
      });
    });

    it('should show error for past time', async () => {
      vi.mocked(validateFutureTime).mockReturnValue(false);

      render(<StudioBookingForm services={mockServices} />);

      await waitFor(async () => {
        // Select service
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'service-1' } });

        // Submit
        const submitButton = screen.getByText('Book Session');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Please select a time in the future')).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('should show Booking... when in progress', async () => {
      vi.mocked(useBookStudio).mockReturnValue({
        bookStudio: mockBookStudio,
        isLoading: true,
        error: null,
        data: null,
        isDoubleBooking: false,
        reset: mockReset,
      });

      render(<StudioBookingForm services={mockServices} />);

      expect(screen.getByText('Booking...')).toBeInTheDocument();
    });

    it('should disable button when loading', async () => {
      vi.mocked(useBookStudio).mockReturnValue({
        bookStudio: mockBookStudio,
        isLoading: true,
        error: null,
        data: null,
        isDoubleBooking: false,
        reset: mockReset,
      });

      render(<StudioBookingForm services={mockServices} />);

      const button = screen.getByRole('button', { name: /booking/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Book Another Session', () => {
    it('should call reset when clicking Book Another Session', async () => {
      vi.mocked(useBookStudio).mockReturnValue({
        bookStudio: mockBookStudio,
        isLoading: false,
        error: null,
        data: { id: 'appt-123', appointment_time: '2025-02-15T14:00:00Z', status: 'pending' } as any,
        isDoubleBooking: false,
        reset: mockReset,
      });

      render(<StudioBookingForm services={mockServices} />);

      const bookAnotherButton = screen.getByText('Book Another Session');
      fireEvent.click(bookAnotherButton);

      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('onSuccess callback', () => {
    it('should be called on successful booking', async () => {
      const onSuccess = vi.fn();
      mockBookStudio.mockResolvedValue({ id: 'appt-123' });

      render(<StudioBookingForm services={mockServices} onSuccess={onSuccess} />);

      // Note: The onSuccess is passed to useBookStudio, not called directly in component
      // This tests that the prop is properly passed
      expect(useBookStudio).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess: expect.any(Function),
        })
      );
    });
  });
});
