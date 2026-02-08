/**
 * Phase 4.6-4.10: HappeningCard Premium Card Polish Tests
 *
 * Tests verify MemberCard-inspired card surface:
 * - card-spotlight class for radial gradient bg + shadow tokens
 * - Hover: shadow-card-hover + border-accent
 * - Poster zoom on hover (scale-[1.02])
 * - Tighter content density
 * - MemberCard-style pills (px-2 py-0.5 text-sm rounded-full border)
 * - 4-tier poster rendering: card image → full poster → default by type → placeholder
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

describe('HappeningCard Phase 4.6 Premium Card Polish', () => {
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
    id: 'test-csc-1',
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

  describe('Title and Content', () => {
    it('should display event title', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Monday Night Open Mic')).toBeInTheDocument();
    });

    it('should display meta line with time, venue, cost', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText(/7 PM/)).toBeInTheDocument();
      expect(screen.getByText(/Mercury Cafe/)).toBeInTheDocument();
      expect(screen.getByText(/Free/)).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    // Phase 4.37: Changed from "Schedule TBD" to "Unconfirmed" for needs_verification status
    // Phase 4.38: Now shows in both overlay and chips row
    it('should display Unconfirmed for needs_verification status', () => {
      const unverifiedEvent = { ...mockOpenMicEvent, status: 'needs_verification' };
      render(<HappeningCard event={unverifiedEvent} />);
      // Multiple Unconfirmed badges (poster overlay + chips row)
      const badges = screen.getAllByText('Unconfirmed');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('should display Ended for past events', () => {
      const pastEvent = { ...mockDscEvent, event_date: '2020-01-15' };
      render(<HappeningCard event={pastEvent} />);
      expect(screen.getByText('Ended')).toBeInTheDocument();
    });
  });

  describe('Chips Row', () => {
    it('should display event type chip', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByText('Open Mic')).toBeInTheDocument();
    });

    it('should display signup chip when signup info exists', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      // Phase 5.08: Updated format from "Sign-up: X" to "Signups at X"
      expect(screen.getByText('Signups at 6:30 PM')).toBeInTheDocument();
    });

    it('should not display signup chip when no signup info', () => {
      const noSignupEvent = { ...mockOpenMicEvent, signup_time: null, signup_mode: null };
      render(<HappeningCard event={noSignupEvent} />);
      // Phase 5.08: Updated format check
      expect(screen.queryByText(/Signups at/)).not.toBeInTheDocument();
    });

    it('should display Online for online-only events', () => {
      const onlineEvent = { ...mockOpenMicEvent, location_mode: 'online' as const, venue_name: null };
      render(<HappeningCard event={onlineEvent} />);
      expect(screen.getByText(/Online/)).toBeInTheDocument();
    });

    it('should display cost label for paid events', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText(/\$10/)).toBeInTheDocument();
    });

    it('should display age policy when set', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('21+')).toBeInTheDocument();
    });

    it('should display CSC chip for CSC events', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('CSC')).toBeInTheDocument();
    });

    it('should not display CSC chip for non-CSC events', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      const cscElements = screen.queryAllByText('CSC');
      expect(cscElements.length).toBe(0);
    });

    it('should display availability for events with capacity', () => {
      render(<HappeningCard event={mockDscEvent} />);
      expect(screen.getByText('40 spots')).toBeInTheDocument();
    });
  });

  describe('Favorite Star', () => {
    it('should display favorite star button', () => {
      render(<HappeningCard event={mockOpenMicEvent} />);
      expect(screen.getByLabelText('Add favorite')).toBeInTheDocument();
    });
  });

  describe('Visual Treatment - MemberCard Surface', () => {
    it('should use card-spotlight class for premium surface', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const article = container.querySelector('article');
      expect(article?.className).toContain('card-spotlight');
    });

    it('should have hover transition', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const article = container.querySelector('article');
      // card-spotlight provides base transition, we use transition-all
      expect(article?.className).toContain('transition-all');
    });

    it('should have reduced opacity for past events', () => {
      const pastEvent = { ...mockDscEvent, event_date: '2020-01-15' };
      const { container } = render(<HappeningCard event={pastEvent} />);
      const article = container.querySelector('article');
      expect(article?.className).toContain('opacity-70');
    });
  });

  describe('Poster thumbnail 4-tier rendering', () => {
    it('should use card image (tier 1) when cover_image_card_url is present', () => {
      render(
        <HappeningCard event={{
          ...mockOpenMicEvent,
          cover_image_card_url: 'https://example.com/card.jpg',
          cover_image_url: 'https://example.com/full.jpg'
        }} />
      );
      expect(screen.getByTestId('card-image')).toBeInTheDocument();
    });

    it('should use blurred background mode (tier 2) when only full poster exists', () => {
      render(
        <HappeningCard event={{
          ...mockOpenMicEvent,
          cover_image_card_url: null,
          cover_image_url: 'https://example.com/full.jpg'
        }} />
      );
      expect(screen.getByTestId('full-poster-contained')).toBeInTheDocument();
      expect(screen.getByTestId('poster-thumbnail')).toBeInTheDocument();
    });

    it('should use default type image (tier 3) for open_mic when no images exist', () => {
      render(
        <HappeningCard event={{
          ...mockOpenMicEvent,
          cover_image_card_url: null,
          cover_image_url: null,
          imageUrl: null
        }} />
      );
      const defaultImage = screen.getByTestId('default-type-image');
      expect(defaultImage).toBeInTheDocument();
      expect(defaultImage.getAttribute('src')).toBe('/images/event-defaults/open-mic.svg');
    });

    it('should use default type image (tier 3) for showcase when no images exist', () => {
      render(
        <HappeningCard event={{
          ...mockDscEvent,
          cover_image_card_url: null,
          cover_image_url: null,
          imageUrl: null
        }} />
      );
      const defaultImage = screen.getByTestId('default-type-image');
      expect(defaultImage).toBeInTheDocument();
      expect(defaultImage.getAttribute('src')).toBe('/images/event-defaults/showcase.svg');
    });

    it('should use default type image (tier 3) for workshop when no images exist', () => {
      render(
        <HappeningCard event={{
          id: 'test-workshop',
          title: 'Songwriting Workshop',
          event_type: 'workshop',
          cover_image_card_url: null,
          cover_image_url: null,
        }} />
      );
      const defaultImage = screen.getByTestId('default-type-image');
      expect(defaultImage).toBeInTheDocument();
      expect(defaultImage.getAttribute('src')).toBe('/images/event-defaults/workshop.svg');
    });

    it('should use fallback default image for unknown event types', () => {
      render(
        <HappeningCard event={{
          id: 'test-unknown',
          title: 'Unknown Event Type',
          event_type: 'some_new_type',
          cover_image_card_url: null,
          cover_image_url: null,
        }} />
      );
      const defaultImage = screen.getByTestId('default-type-image');
      expect(defaultImage).toBeInTheDocument();
      expect(defaultImage.getAttribute('src')).toBe('/images/event-defaults/event.svg');
    });

    it('should render placeholder (tier 4) when event_type is undefined and no images exist', () => {
      const { container } = render(
        <HappeningCard event={{
          id: 'test-no-type',
          title: 'No Type Event',
          event_type: undefined,
          cover_image_card_url: null,
          cover_image_url: null,
          imageUrl: null
        }} />
      );
      expect(screen.getByTestId('placeholder-tile')).toBeInTheDocument();
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });

    it('should have 3:2 aspect ratio container for denser cards', () => {
      // Phase 4.19: Changed from 4:3 to 3:2 for denser card layout
      render(<HappeningCard event={mockOpenMicEvent} />);
      const thumbnail = screen.getByTestId('poster-thumbnail');
      expect(thumbnail.className).toContain('aspect-[3/2]');
    });

    it('should have hover zoom on poster images', () => {
      render(
        <HappeningCard event={{
          ...mockOpenMicEvent,
          cover_image_card_url: 'https://example.com/card.jpg'
        }} />
      );
      const img = screen.getByTestId('card-image');
      expect(img.className).toContain('group-hover:scale-[1.02]');
    });

    it('should have hover zoom on default type images', () => {
      render(
        <HappeningCard event={{
          ...mockOpenMicEvent,
          cover_image_card_url: null,
          cover_image_url: null,
        }} />
      );
      const img = screen.getByTestId('default-type-image');
      expect(img.className).toContain('group-hover:scale-[1.02]');
    });
  });

  describe('Chip styling - MemberCard pill style', () => {
    it('should use text-sm for chips (not text-xs)', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const chips = container.querySelectorAll('.rounded-full.text-sm');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('should display Missing details as warning badge', () => {
      // Event with null values triggers hasMissingDetails
      const eventWithMissing = {
        ...mockDscEvent,
        venue_name: null,
        venue_id: null,
        location_mode: null,
      };
      render(<HappeningCard event={eventWithMissing} />);
      expect(screen.getByText('Missing details')).toBeInTheDocument();
    });
  });

  describe('No emoji in UI', () => {
    it('should not contain emoji characters', () => {
      const { container } = render(<HappeningCard event={mockOpenMicEvent} />);
      const text = container.textContent || '';
      const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BE}]/u;
      const nonStarText = text.replace(/[★☆]/g, '');
      expect(nonStarText).not.toMatch(emojiPattern);
    });
  });
});
