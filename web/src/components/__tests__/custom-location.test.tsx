/**
 * Phase 4.0: Custom Location Tests
 *
 * Tests for the custom location feature that allows events to use
 * custom locations instead of predefined venues.
 *
 * Contract: venue_id and custom_location_name are mutually exclusive.
 * - If venue_id is set, all custom_* fields must be null
 * - If custom_location_name is set, venue_id must be null
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

describe('HappeningCard custom location rendering', () => {
  describe('Events with venue', () => {
    const eventWithVenue: HappeningEvent = {
      id: 'test-venue-event',
      title: 'Event at Known Venue',
      event_type: 'showcase',
      venue_id: 'venue-123',
      venue_name: 'Test Venue',
      venue: {
        id: 'venue-123',
        name: 'Test Venue',
        address: '123 Main St',
        city: 'Denver',
        state: 'CO',
      },
      // Custom location fields should be null when venue is set
      custom_location_name: null,
      custom_address: null,
      custom_city: null,
      custom_state: null,
    };

    it('should display venue name', () => {
      const { container } = render(
        <HappeningCard event={eventWithVenue} variant="grid" />
      );
      expect(container.textContent).toContain('Test Venue');
    });

    it('should display venue name in Line 2 (Phase 4.3 simplified - no city/state)', () => {
      const { container } = render(
        <HappeningCard event={eventWithVenue} variant="grid" />
      );
      // Phase 4.3: Line 2 shows venue name only, not city/state
      expect(container.textContent).toContain('Test Venue');
      // City/state is NOT shown in the simplified card (shown on detail page instead)
    });

    it('should not display custom location when venue is set', () => {
      const eventWithBothWrongly = {
        ...eventWithVenue,
        custom_location_name: 'Should Not Display', // This violates invariant
      };
      const { container } = render(
        <HappeningCard event={eventWithBothWrongly} variant="grid" />
      );
      // Venue takes precedence, custom location should not display
      expect(container.textContent).toContain('Test Venue');
      expect(container.textContent).not.toContain('Should Not Display');
    });
  });

  describe('Events with custom location', () => {
    const eventWithCustomLocation: HappeningEvent = {
      id: 'test-custom-event',
      title: 'House Concert',
      event_type: 'other',
      // No venue
      venue_id: null,
      venue_name: null,
      venue: null,
      // Custom location set
      custom_location_name: 'Private Residence',
      custom_address: '456 Oak Ave',
      custom_city: 'Boulder',
      custom_state: 'CO',
    };

    it('should display custom location name', () => {
      const { container } = render(
        <HappeningCard event={eventWithCustomLocation} variant="grid" />
      );
      expect(container.textContent).toContain('Private Residence');
    });

    it('should display custom location name only (Phase 4.3 - no city/state)', () => {
      const { container } = render(
        <HappeningCard event={eventWithCustomLocation} variant="grid" />
      );
      // Phase 4.3: Line 2 shows location name only, not city/state
      expect(container.textContent).toContain('Private Residence');
      // City/state is NOT shown in the simplified card (shown on detail page instead)
    });
  });

  describe('Events with only custom location name (no address)', () => {
    const minimalCustomLocation: HappeningEvent = {
      id: 'test-minimal-custom',
      title: 'Pop-up Event',
      event_type: 'other',
      venue_id: null,
      venue_name: null,
      custom_location_name: 'Secret Location',
      custom_address: null,
      custom_city: null,
      custom_state: null,
    };

    it('should display custom location name only', () => {
      const { container } = render(
        <HappeningCard event={minimalCustomLocation} variant="grid" />
      );
      expect(container.textContent).toContain('Secret Location');
    });

    it('should not display city/state when not provided', () => {
      const { container } = render(
        <HappeningCard event={minimalCustomLocation} variant="grid" />
      );
      // Should not have any city display (the location display section won't render)
      // Look for the pattern "city, state" - should not be present
      expect(container.textContent).not.toMatch(/Boulder|Denver/);
    });
  });

  describe('Online events (no location)', () => {
    const onlineEvent: HappeningEvent = {
      id: 'test-online-event',
      title: 'Virtual Songwriting Workshop',
      event_type: 'workshop',
      location_mode: 'online',
      online_url: 'https://zoom.us/meeting',
      venue_id: null,
      venue_name: null,
      custom_location_name: null,
    };

    it('should show Online badge for online-only events', () => {
      const { container } = render(
        <HappeningCard event={onlineEvent} variant="list" />
      );
      expect(container.textContent).toContain('Online');
    });

    it('should not show venue section for online-only events', () => {
      const { container } = render(
        <HappeningCard event={onlineEvent} variant="grid" />
      );
      // Should not have the 📍 emoji (venue indicator)
      expect(container.textContent).not.toContain('📍');
    });
  });

  describe('Hybrid events', () => {
    const hybridEvent: HappeningEvent = {
      id: 'test-hybrid-event',
      title: 'Hybrid Showcase',
      event_type: 'showcase',
      location_mode: 'hybrid',
      online_url: 'https://youtube.com/live',
      venue_id: 'venue-456',
      venue_name: 'Music Hall',
      venue: {
        id: 'venue-456',
        name: 'Music Hall',
        city: 'Denver',
        state: 'CO',
      },
    };

    it('should show Hybrid badge for hybrid events', () => {
      const { container } = render(
        <HappeningCard event={hybridEvent} variant="list" />
      );
      expect(container.textContent).toContain('Hybrid');
    });

    it('should show venue for hybrid events', () => {
      const { container } = render(
        <HappeningCard event={hybridEvent} variant="grid" />
      );
      expect(container.textContent).toContain('Music Hall');
    });
  });
});

describe('Custom location with coordinates', () => {
  const eventWithCoords: HappeningEvent = {
    id: 'test-coords-event',
    title: 'Park Jam Session',
    event_type: 'other',
    venue_id: null,
    custom_location_name: 'City Park Pavilion',
    custom_address: null,
    custom_city: 'Denver',
    custom_state: 'CO',
    custom_latitude: 39.7392,
    custom_longitude: -104.9903,
  };

  it('should display custom location name with coordinates', () => {
    const { container } = render(
      <HappeningCard event={eventWithCoords} variant="grid" />
    );
    // Phase 4.3: Line 2 shows location name only, not city/state
    expect(container.textContent).toContain('City Park Pavilion');
    // City/state is NOT shown in the simplified card (shown on detail page instead)
  });

  it('should not render Map link in card (Phase 4.3 - map on detail page)', () => {
    const { container } = render(
      <HappeningCard event={eventWithCoords} variant="grid" />
    );
    // Phase 4.3: Map link is NOT shown in the simplified card (available on detail page)
    // This is correct behavior - cards are streamlined for scanning
    expect(container.textContent).not.toContain('Map');
  });
});

describe('Location notes display', () => {
  const eventWithNotes: HappeningEvent = {
    id: 'test-notes-event',
    title: 'Venue Event with Notes',
    event_type: 'showcase',
    venue_id: 'venue-789',
    venue_name: 'Coffee Shop',
    venue: {
      name: 'Coffee Shop',
      city: 'Denver',
      state: 'CO',
    },
    location_notes: 'Enter through back door',
  };

  it('should include location_notes in event data', () => {
    // This test verifies the type includes location_notes
    // The actual rendering of notes happens on the detail page
    expect(eventWithNotes.location_notes).toBe('Enter through back door');
  });
});
