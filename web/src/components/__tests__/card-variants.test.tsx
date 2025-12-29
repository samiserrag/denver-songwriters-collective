/**
 * Phase 4.3: HappeningCard Layout Tests
 *
 * Tests verify the 3-line list layout follows the spec:
 * - Line 1: Date + Title + Details →
 * - Line 2: Time · Signup · Venue · Cost · Age · ☆
 * - Line 3: Event Type · DSC Presents · Availability
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HappeningCard } from '../happenings/HappeningCard';
import type { HappeningEvent } from '../happenings/HappeningCard';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/happenings',
}));

// Mock supabase client
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

describe('HappeningCard Phase 4.3 Layout', () => {
  const mockOpenMicEvent: HappeningEvent = {
    id: 'test-open-mic-1',
    title: 'Monday Night Open Mic',
    event_type: 'open_mic',
    day_of_week: 'Monday',
    status: 'active',
    slug: 'monday-night-open-mic',
    venue_name: 'Mercury Cafe',
    start_time: '19:00:00',
    signup_time: '18:30:00',
    is_free: true,
  };

  const mockDscEvent: HappeningEvent = {
    id: 'test-dsc-1',
    title: 'Songwriter Showcase',
    event_type: 'showcase',
    is_dsc_event: true,
    event_date: '2025-01-15',
    start_time: '19:00:00',
    venue_name: 'The Oriental Theater',
    capacity: 50,
    rsvp_count: 10,
    is_free: false,
    cost_label: '$10',
    age_policy: '21+',
  };

  describe('Line 1: Date + Title + Details', () => {
    it('should display event title', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Monday Night Open Mic')).toBeInTheDocument();
    });

    it('should display Details → link for active events', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Details →')).toBeInTheDocument();
    });

    it('should display Schedule TBD for needs_verification status', () => {
      const unverifiedEvent = { ...mockOpenMicEvent, status: 'needs_verification' };
      render(<HappeningCard event={unverifiedEvent} />);
      expect(screen.getByText('Schedule TBD')).toBeInTheDocument();
    });

    it('should display Ended for past events', () => {
      const pastEvent = { ...mockDscEvent, event_date: '2020-01-15' };
      render(<HappeningCard event={pastEvent} />);
      expect(screen.getByText('Ended')).toBeInTheDocument();
    });
  });

  describe('Line 2: Decision Facts', () => {
    it('should display start time', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      // formatTimeToAMPM omits :00 for even hours (7 PM instead of 7:00 PM)
      expect(screen.getByText('7 PM')).toBeInTheDocument();
    });

    it('should display signup time', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Sign-up: 6:30 PM')).toBeInTheDocument();
    });

    it('should display Sign-up: NA when no signup time', () => {
      const noSignupEvent = { ...mockOpenMicEvent, signup_time: null };
      render(<HappeningCard event={noSignupEvent} />);
      expect(screen.getByText('Sign-up: NA')).toBeInTheDocument();
    });

    it('should display venue name', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Mercury Cafe')).toBeInTheDocument();
    });

    it('should display Online for online-only events', () => {
      const onlineEvent = { ...mockOpenMicEvent, location_mode: 'online' as const, venue_name: null };
      render(<HappeningCard event={onlineEvent} />);
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('should display Free for free events', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('should display cost label for paid events', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('$10')).toBeInTheDocument();
    });

    it('should display em dash for unknown cost', () => {
      const unknownCostEvent = { ...mockOpenMicEvent, is_free: null };
      render(<HappeningCard event={unknownCostEvent} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('should display age policy when set', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('21+')).toBeInTheDocument();
    });

    it('should display favorite star', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByLabelText('Add favorite')).toBeInTheDocument();
    });
  });

  describe('Line 3: Context', () => {
    it('should display event type', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Open Mic')).toBeInTheDocument();
    });

    it('should display DSC Presents for DSC events', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('DSC Presents')).toBeInTheDocument();
    });

    it('should not display DSC Presents for non-DSC events', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.queryByText('DSC Presents')).not.toBeInTheDocument();
    });

    it('should display availability for events with capacity', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('40 spots available')).toBeInTheDocument();
    });
  });

  describe('Visual Treatment', () => {
    it('should have left border accent', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const article = container.querySelector('article');
      expect(article?.className).toContain('border-l-');
    });

    it('should have rounded right corners only', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const article = container.querySelector('article');
      expect(article?.className).toContain('rounded-r-lg');
    });

    it('should have hover transition', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const article = container.querySelector('article');
      expect(article?.className).toContain('transition-all');
    });

    it('should have reduced opacity for past events', () => {
      const pastEvent = { ...mockDscEvent, event_date: '2020-01-15' };
      const { container } = render(<HappeningCard event={pastEvent} />);
      const article = container.querySelector('article');
      expect(article?.className).toContain('opacity-70');
    });
  });

  describe('No images in list view', () => {
    it('should not render image section', () => {
      const { container } = render(
        <HappeningCard event={{ ...mockOpenMicEvent, cover_image_url: 'https://example.com/image.jpg' }} />
      );
      expect(container.querySelectorAll('img').length).toBe(0);
    });
  });

  describe('No emoji in UI', () => {
    it('should not contain emoji characters', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const text = container.textContent || '';
      // Check for common emoji ranges (not star which is used for favorites)
      const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BE}]/u;
      const nonStarText = text.replace(/[★☆]/g, '');
      expect(nonStarText).not.toMatch(emojiPattern);
    });
  });
});
