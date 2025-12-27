/**
 * Regression test: Ensure list variant cards don't use grid-only sizing
 *
 * These tests verify that when cards are rendered in "list" variant,
 * they don't have the large media containers that cause layout issues.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import EventCard from '../EventCard';
import { EventCard as DscEventCard } from '../events/EventCard';

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

describe('EventCard (Open Mic) list variant', () => {
  const mockOpenMicEvent = {
    id: 'test-open-mic-1',
    title: 'Monday Night Open Mic',
    event_type: 'open_mic',
    day_of_week: 'Monday',
    status: 'active',
    slug: 'monday-night-open-mic',
    venue: { name: 'Test Venue' },
  };

  it('should not render media section in list variant', () => {
    const { container } = render(
      <EventCard event={mockOpenMicEvent as any} variant="list" />
    );
    const html = container.innerHTML;

    // Should not have the h-32 media container class
    expect(html).not.toMatch(/class="[^"]*h-32[^"]*"/);
  });

  it('should render media section in grid variant', () => {
    const { container } = render(
      <EventCard event={mockOpenMicEvent as any} variant="grid" />
    );
    const html = container.innerHTML;

    // Should have the h-32 media container class
    expect(html).toMatch(/h-32/);
  });

  it('should not render day badge in list variant (since grouping shows day)', () => {
    const { container } = render(
      <EventCard event={mockOpenMicEvent as any} variant="list" />
    );

    // The day badge has specific styling with "Monday" text in a backdrop-blur element
    // In list variant, this should not be present in the media section
    const backdropElements = container.querySelectorAll('.backdrop-blur');

    // None of the backdrop elements should contain "Monday" as the day badge
    // (status badges might still exist but day badge should be hidden)
    const dayBadgeTexts = Array.from(backdropElements)
      .map(el => el.textContent)
      .filter(text => text === 'Monday');

    expect(dayBadgeTexts.length).toBe(0);
  });
});

describe('DscEventCard list variant', () => {
  const mockDscEvent = {
    id: 'test-dsc-1',
    title: 'Songwriter Showcase',
    event_type: 'showcase',
    is_dsc_event: true,
    event_date: '2025-01-15',
    start_time: '19:00:00',
    venue: { name: 'Test Venue' },
    capacity: 50,
    rsvp_count: 10,
  };

  it('should not have aspect-ratio classes in list variant', () => {
    const { container } = render(
      <DscEventCard event={mockDscEvent as any} variant="list" />
    );
    const html = container.innerHTML;

    // Should not have aspect-[4/3] class
    expect(html).not.toMatch(/aspect-\[4\/3\]/);
    expect(html).not.toMatch(/aspect-video/);
    expect(html).not.toMatch(/aspect-square/);
  });

  it('should have aspect-ratio in grid variant', () => {
    const { container } = render(
      <DscEventCard event={mockDscEvent as any} variant="grid" />
    );
    const html = container.innerHTML;

    // Should have aspect-[4/3] class
    expect(html).toMatch(/aspect-\[4\/3\]/);
  });

  it('should render date badge inline in list variant', () => {
    const { container } = render(
      <DscEventCard event={mockDscEvent as any} variant="list" />
    );

    // Should have date label visible (JAN 14 or 15 depending on timezone)
    expect(container.textContent).toMatch(/JAN/i);
    // Date parsing may show 14 or 15 depending on timezone - just check it has a day number
    expect(container.textContent).toMatch(/1[45]/);
  });
});
