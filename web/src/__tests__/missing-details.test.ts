/**
 * Phase 4.1: Missing Details Tests
 *
 * Tests for the missing_details computation logic that determines
 * whether an event has critical information gaps.
 */

import { describe, it, expect } from 'vitest';
import { computeMissingDetails, hasMissingDetails } from '@/lib/events/missingDetails';

describe('computeMissingDetails', () => {
  describe('Online events', () => {
    it('should flag online events without online_url', () => {
      const result = computeMissingDetails({
        location_mode: 'online',
        online_url: null,
        is_free: true,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('Online event missing URL');
    });

    it('should not flag online events with online_url', () => {
      const result = computeMissingDetails({
        location_mode: 'online',
        online_url: 'https://zoom.us/j/123',
        is_free: true,
      });

      expect(result.reasons).not.toContain('Online event missing URL');
    });
  });

  describe('Hybrid events', () => {
    it('should flag hybrid events without online_url', () => {
      const result = computeMissingDetails({
        location_mode: 'hybrid',
        online_url: null,
        venue_id: 'some-venue-id',
        is_free: true,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('Hybrid event missing online URL');
    });

    it('should flag hybrid events without physical location', () => {
      const result = computeMissingDetails({
        location_mode: 'hybrid',
        online_url: 'https://zoom.us/j/123',
        venue_id: null,
        custom_location_name: null,
        is_free: true,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('Hybrid event missing physical location');
    });

    it('should not flag complete hybrid events', () => {
      const result = computeMissingDetails({
        location_mode: 'hybrid',
        online_url: 'https://zoom.us/j/123',
        venue_id: 'some-venue-id',
        is_free: true,
      });

      expect(result.reasons).not.toContain('Hybrid event missing online URL');
      expect(result.reasons).not.toContain('Hybrid event missing physical location');
    });
  });

  describe('Venue events', () => {
    it('should not flag venue events with venue_id', () => {
      const result = computeMissingDetails({
        location_mode: 'venue',
        venue_id: 'some-venue-id',
        is_free: true,
      });

      expect(result.reasons).not.toContain('Missing venue information');
    });

    it('should not flag venue events with custom_location_name', () => {
      const result = computeMissingDetails({
        location_mode: 'venue',
        venue_id: null,
        custom_location_name: "Joe's Coffee Shop",
        is_free: true,
      });

      expect(result.reasons).not.toContain('Missing venue information');
    });

    it('should not flag venue events with venue_name (legacy)', () => {
      const result = computeMissingDetails({
        location_mode: 'venue',
        venue_id: null,
        venue_name: 'Some Venue',
        is_free: true,
      });

      // venue_name alone doesn't trigger "Missing venue" but does trigger "orphan"
      expect(result.reasons).not.toContain('Missing venue information');
      expect(result.reasons).toContain('Venue not linked to database');
    });
  });

  describe('DSC events age policy', () => {
    it('should flag DSC events without age_policy', () => {
      const result = computeMissingDetails({
        is_dsc_event: true,
        age_policy: null,
        venue_id: 'some-venue',
        is_free: true,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('DSC event missing age policy');
    });

    it('should not flag DSC events with age_policy', () => {
      const result = computeMissingDetails({
        is_dsc_event: true,
        age_policy: '21+',
        venue_id: 'some-venue',
        is_free: true,
      });

      expect(result.reasons).not.toContain('DSC event missing age policy');
    });

    it('should not flag non-DSC events without age_policy', () => {
      const result = computeMissingDetails({
        is_dsc_event: false,
        age_policy: null,
        venue_id: 'some-venue',
        is_free: true,
      });

      expect(result.reasons).not.toContain('DSC event missing age policy');
    });
  });

  describe('Cost information', () => {
    it('should flag events with unknown cost (is_free = null)', () => {
      const result = computeMissingDetails({
        is_free: null,
        venue_id: 'some-venue',
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('Cost information unknown');
    });

    it('should flag events with undefined cost', () => {
      const result = computeMissingDetails({
        is_free: undefined,
        venue_id: 'some-venue',
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('Cost information unknown');
    });

    it('should not flag free events', () => {
      const result = computeMissingDetails({
        is_free: true,
        venue_id: 'some-venue',
      });

      expect(result.reasons).not.toContain('Cost information unknown');
    });

    it('should not flag paid events', () => {
      const result = computeMissingDetails({
        is_free: false,
        venue_id: 'some-venue',
      });

      expect(result.reasons).not.toContain('Cost information unknown');
    });
  });

  describe('Orphan venues', () => {
    it('should flag orphan venues (venue_name but no venue_id)', () => {
      const result = computeMissingDetails({
        venue_name: "Joe's Bar",
        venue_id: null,
        custom_location_name: null,
        is_free: true,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain('Venue not linked to database');
    });

    it('should not flag linked venues', () => {
      const result = computeMissingDetails({
        venue_name: "Joe's Bar",
        venue_id: 'venue-123',
        is_free: true,
      });

      expect(result.reasons).not.toContain('Venue not linked to database');
    });

    it('should not flag custom locations', () => {
      const result = computeMissingDetails({
        venue_name: null,
        venue_id: null,
        custom_location_name: 'Private Residence',
        is_free: true,
      });

      expect(result.reasons).not.toContain('Venue not linked to database');
    });
  });

  describe('hasMissingDetails helper', () => {
    it('should return true for events with missing details', () => {
      expect(hasMissingDetails({ is_free: null })).toBe(true);
    });

    it('should return false for complete events', () => {
      expect(hasMissingDetails({
        venue_id: 'venue-123',
        is_free: true,
      })).toBe(false);
    });
  });

  describe('Multiple missing fields', () => {
    it('should report all missing fields', () => {
      const result = computeMissingDetails({
        location_mode: 'hybrid',
        online_url: null,
        venue_id: null,
        custom_location_name: null,
        is_free: null,
        is_dsc_event: true,
        age_policy: null,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons.length).toBeGreaterThanOrEqual(4);
      expect(result.reasons).toContain('Hybrid event missing online URL');
      expect(result.reasons).toContain('Hybrid event missing physical location');
      expect(result.reasons).toContain('Cost information unknown');
      expect(result.reasons).toContain('DSC event missing age policy');
    });
  });
});
