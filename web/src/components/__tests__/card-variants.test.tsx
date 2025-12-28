/**
 * Regression test: Ensure list variant cards don't use grid-only sizing
 *
 * These tests verify that when the unified HappeningCard is rendered in "list" variant,
 * it doesn't have the large media containers that cause layout issues.
 *
 * Phase 3.1: All event types now use the unified HappeningCard component.
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

describe('HappeningCard (Open Mic) list variant', () => {
  const mockOpenMicEvent: HappeningEvent = {
    id: 'test-open-mic-1',
    title: 'Monday Night Open Mic',
    event_type: 'open_mic',
    day_of_week: 'Monday',
    status: 'active',
    slug: 'monday-night-open-mic',
    venue: { name: 'Test Venue' },
  };

  it('should not render image section in list variant', () => {
    const { container } = render(
      <HappeningCard event={mockOpenMicEvent} variant="list" />
    );

    // List variant should not have any img tags
    expect(container.querySelectorAll('img').length).toBe(0);
  });

  it('should render image section in grid variant when image exists', () => {
    const eventWithImage = { ...mockOpenMicEvent, cover_image_url: 'https://example.com/image.jpg' };
    const { container } = render(
      <HappeningCard event={eventWithImage} variant="grid" />
    );

    // Should have an img tag in grid variant with image
    expect(container.querySelectorAll('img').length).toBe(1);
  });

  it('should not render day badge overlay in list variant (date shown inline)', () => {
    const { container } = render(
      <HappeningCard event={mockOpenMicEvent} variant="list" />
    );

    // The day badge overlay uses backdrop-blur and is inside the image section
    // In list variant, image section doesn't render, so no backdrop-blur day badges
    const backdropElements = container.querySelectorAll('.backdrop-blur');

    // None of the backdrop elements should contain "Monday" as the day badge
    const dayBadgeTexts = Array.from(backdropElements)
      .map(el => el.textContent)
      .filter(text => text === 'Monday');

    expect(dayBadgeTexts.length).toBe(0);
  });
});

describe('HappeningCard (DSC Event) list variant', () => {
  const mockDscEvent: HappeningEvent = {
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

  it('should not have image section in list variant', () => {
    const { container } = render(
      <HappeningCard event={mockDscEvent} variant="list" />
    );

    // List variant should not have any img tags
    expect(container.querySelectorAll('img').length).toBe(0);
  });

  it('should render date badge inline in list variant', () => {
    const { container } = render(
      <HappeningCard event={mockDscEvent} variant="list" />
    );

    // Should have date label visible (JAN 14 or 15 depending on timezone)
    expect(container.textContent).toMatch(/JAN/i);
    // Date parsing may show 14 or 15 depending on timezone - just check it has a day number
    expect(container.textContent).toMatch(/1[45]/);
  });
});

describe('HappeningCard list variant density guards', () => {
  const mockOpenMicEvent: HappeningEvent = {
    id: 'test-open-mic-1',
    title: 'Monday Night Open Mic',
    event_type: 'open_mic',
    day_of_week: 'Monday',
    status: 'active',
    slug: 'monday-night-open-mic',
    venue: { name: 'Test Venue' },
  };

  const mockDscEvent: HappeningEvent = {
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

  it('HappeningCard list variant uses tight density classes (open mic)', () => {
    const { getByTestId } = render(
      <HappeningCard event={mockOpenMicEvent} variant="list" />
    );
    const cls = getByTestId('happening-card-content').className;

    expect(cls).toMatch(/\bp-3\b/);
    expect(cls).not.toMatch(/\bp-4\b/);
    expect(cls).toMatch(/\bspace-y-1\b/);
    expect(cls).not.toMatch(/\bspace-y-2\b/);
  });

  it('HappeningCard list variant uses tight density classes (dsc event)', () => {
    const { getByTestId } = render(
      <HappeningCard event={mockDscEvent} variant="list" />
    );
    const cls = getByTestId('happening-card-content').className;

    expect(cls).toMatch(/\bp-3\b/);
    expect(cls).not.toMatch(/\bp-4\b/);
    expect(cls).toMatch(/\bspace-y-1\b/);
    expect(cls).not.toMatch(/\bspace-y-2\b/);
  });

  it('HappeningCard grid variant keeps standard density classes', () => {
    const { getByTestId } = render(
      <HappeningCard event={mockOpenMicEvent} variant="grid" />
    );
    const cls = getByTestId('happening-card-content').className;

    expect(cls).toMatch(/\bp-5\b/);
    expect(cls).toMatch(/\bspace-y-3\b/);
    expect(cls).not.toMatch(/\bp-3\b/);
  });
});
