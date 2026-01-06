/**
 * Phase 4.1: MissingDetailsChip Component Tests
 *
 * Tests that the chip renders correctly and only when needed.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissingDetailsChip, MissingDetailsChipStatic } from '../events/MissingDetailsChip';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('MissingDetailsChip', () => {
  it('should not render when no details are missing', () => {
    const event = {
      id: 'event-123',
      venue_id: 'venue-456',
      is_free: true,
    };

    const { container } = render(<MissingDetailsChip event={event} />);
    expect(container.firstChild).toBeNull();
  });

  // Phase 4.42k B1: is_free is optional, no longer triggers missing details
  it('should NOT render when only cost is unknown (Phase 4.42k B1)', () => {
    const event = {
      id: 'event-123',
      venue_id: 'venue-456',
      is_free: null,
    };

    const { container } = render(<MissingDetailsChip event={event} />);
    // B1: is_free being null should NOT render the chip
    expect(container.firstChild).toBeNull();
  });

  it('should render when DSC event lacks age policy', () => {
    const event = {
      id: 'event-123',
      venue_id: 'venue-456',
      is_free: true,
      is_dsc_event: true,
      age_policy: null,
    };

    render(<MissingDetailsChip event={event} />);
    expect(screen.getByText('Missing details')).toBeInTheDocument();
  });

  it('should render when online event lacks URL', () => {
    const event = {
      id: 'event-123',
      location_mode: 'online' as const,
      online_url: null,
      is_free: true,
    };

    render(<MissingDetailsChip event={event} />);
    expect(screen.getByText('Missing details')).toBeInTheDocument();
  });

  it('should link to open mic detail page for open_mic events', () => {
    const event = {
      id: 'event-123',
      slug: 'test-open-mic',
      event_type: 'open_mic',
      is_free: null,
    };

    render(<MissingDetailsChip event={event} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/open-mics/test-open-mic#suggest-update');
  });

  it('should link to event detail page for non-open-mic events', () => {
    const event = {
      id: 'event-123',
      event_type: 'showcase',
      is_free: null,
    };

    render(<MissingDetailsChip event={event} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/events/event-123#suggest-update');
  });

  it('should use compact styling when compact prop is true', () => {
    const event = {
      id: 'event-123',
      is_free: null,
    };

    render(<MissingDetailsChip event={event} compact />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('px-2', 'py-0.5', 'text-xs');
  });

  it('should use regular styling when compact prop is false', () => {
    const event = {
      id: 'event-123',
      is_free: null,
    };

    render(<MissingDetailsChip event={event} compact={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('px-3', 'py-1', 'text-sm');
  });

  it('should have appropriate accessibility attributes', () => {
    const event = {
      id: 'event-123',
      is_free: null,
    };

    render(<MissingDetailsChip event={event} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Missing details - click to help complete this listing');
    expect(link).toHaveAttribute('title');
  });
});

describe('MissingDetailsChipStatic', () => {
  it('should not render when no details are missing', () => {
    const event = {
      venue_id: 'venue-456',
      is_free: true,
    };

    const { container } = render(<MissingDetailsChipStatic event={event} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render as a span (not a link)', () => {
    const event = {
      is_free: null,
    };

    render(<MissingDetailsChipStatic event={event} />);
    const chip = screen.getByText('Missing details').parentElement;
    expect(chip?.tagName).toBe('SPAN');
  });

  // Phase 4.42k B1: is_free no longer triggers missing details
  it('should include reasons in tooltip (B1: excludes cost)', () => {
    const event = {
      is_free: null,
      is_dsc_event: true,
      age_policy: null,
      // Need another missing field since is_free no longer counts
      venue_id: null,
      location_mode: 'venue',
    };

    render(<MissingDetailsChipStatic event={event} />);
    const chip = screen.getByText('Missing details').parentElement;
    expect(chip).toHaveAttribute('title');
    // B1: is_free no longer triggers, so we check for other reasons
    expect(chip?.getAttribute('title')).not.toContain('Cost information unknown');
    expect(chip?.getAttribute('title')).toContain('DSC event missing age policy');
    expect(chip?.getAttribute('title')).toContain('Missing venue information');
  });
});
