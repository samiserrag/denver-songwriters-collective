/**
 * Regression test: Ensure day_of_week normalization prevents "Monday s" bug
 *
 * This test verifies that groupByDayOfWeek() trims whitespace from day_of_week
 * values so that headers like "Mondays" render correctly (not "Monday s").
 */
import { describe, it, expect } from 'vitest';
import { groupByDayOfWeek } from '@/app/happenings/page';

describe('groupByDayOfWeek', () => {
  it('trims trailing whitespace from day_of_week values', () => {
    const events = [
      { id: '1', day_of_week: 'Monday ', title: 'Test Event 1' },
      { id: '2', day_of_week: 'Monday', title: 'Test Event 2' },
    ];

    const groups = groupByDayOfWeek(events);

    // Both events should be grouped under "Monday" (trimmed key)
    expect(groups.has('Monday')).toBe(true);
    expect(groups.get('Monday')?.length).toBe(2);

    // Should NOT have a separate "Monday " key
    expect(groups.has('Monday ')).toBe(false);
  });

  it('trims leading whitespace from day_of_week values', () => {
    const events = [
      { id: '1', day_of_week: ' Tuesday', title: 'Test Event' },
    ];

    const groups = groupByDayOfWeek(events);

    expect(groups.has('Tuesday')).toBe(true);
    expect(groups.get('Tuesday')?.length).toBe(1);
    expect(groups.has(' Tuesday')).toBe(false);
  });

  it('handles mixed whitespace day values correctly', () => {
    const events = [
      { id: '1', day_of_week: ' Wednesday ', title: 'Test Event' },
    ];

    const groups = groupByDayOfWeek(events);

    expect(groups.has('Wednesday')).toBe(true);
    expect(groups.get('Wednesday')?.length).toBe(1);
  });

  it('produces correct day keys for pluralization (no space before s)', () => {
    const events = [
      { id: '1', day_of_week: 'Thursday ', title: 'Test Event' },
    ];

    const groups = groupByDayOfWeek(events);
    const keys = [...groups.keys()];

    // The key should be exactly "Thursday" so that "{day}s" produces "Thursdays"
    expect(keys).toContain('Thursday');

    // Verify pluralization would work correctly
    const dayKey = keys.find(k => k.includes('Thursday'));
    expect(`${dayKey}s`).toBe('Thursdays');
    expect(`${dayKey}s`).not.toBe('Thursday s');
  });

  it('filters out events with unknown day values', () => {
    const events = [
      { id: '1', day_of_week: 'InvalidDay', title: 'Bad Event' },
      { id: '2', day_of_week: 'Friday', title: 'Good Event' },
    ];

    const groups = groupByDayOfWeek(events);

    expect(groups.has('Friday')).toBe(true);
    expect(groups.has('InvalidDay')).toBe(false);
  });

  it('handles null/undefined day_of_week gracefully', () => {
    const events = [
      { id: '1', day_of_week: null, title: 'No Day Event' },
      { id: '2', day_of_week: undefined, title: 'Undefined Day' },
      { id: '3', day_of_week: 'Saturday', title: 'Valid Event' },
    ];

    const groups = groupByDayOfWeek(events);

    expect(groups.has('Saturday')).toBe(true);
    expect(groups.get('Saturday')?.length).toBe(1);
  });
});
