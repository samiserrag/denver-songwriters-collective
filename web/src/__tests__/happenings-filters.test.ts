/**
 * Phase 4.2: Happenings Filters Tests
 *
 * Tests for the URL-driven filter system on /happenings.
 * Verifies filter component design, URL param handling, and search matching.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('HappeningsFilters Component', () => {
  const componentPath = path.join(__dirname, '../components/happenings/HappeningsFilters.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf-8');

  describe('Design Tone (Phase 4.2 correction)', () => {
    it('should NOT contain emoji characters in UI labels', () => {
      // Check for common emoji patterns in the component
      // This regex matches common emoji ranges
      const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      expect(componentContent).not.toMatch(emojiPattern);
    });

    it('should use SVG icons, not emoji', () => {
      // Verify SVG icon functions exist
      expect(componentContent).toContain('function SearchIcon');
      expect(componentContent).toContain('function MapPinIcon');
      expect(componentContent).toContain('function TagIcon');
      expect(componentContent).toContain('function MicIcon');
    });

    it('should use human-readable labels, not snake_case', () => {
      // Verify labels use human-readable text
      expect(componentContent).toContain('label: "Open Mics"');
      expect(componentContent).toContain('label: "Shows"');
      expect(componentContent).toContain('label: "Workshops"');
      expect(componentContent).toContain('label: "In-person"');
      expect(componentContent).toContain('label: "Needs verify"');
    });

    it('should use compact DSC badge, not long label', () => {
      // DSC toggle should just say "DSC" (content is on separate line from button tag)
      expect(componentContent).toContain('>');
      expect(componentContent).toContain('DSC');
      expect(componentContent).toContain('</button>');
      // Verify it's not a long descriptive label like "DSC Events Only"
      expect(componentContent).not.toContain('DSC Events Only');
      expect(componentContent).not.toContain('DSC Only');
    });
  });

  describe('URL Parameter Handling', () => {
    it('should read q param for search query', () => {
      expect(componentContent).toContain('searchParams.get("q")');
    });

    it('should read time param for time filter', () => {
      expect(componentContent).toContain('searchParams.get("time")');
    });

    it('should read type param for event type', () => {
      expect(componentContent).toContain('searchParams.get("type")');
    });

    it('should read dsc param for DSC filter', () => {
      expect(componentContent).toContain('searchParams.get("dsc")');
    });

    it('should read verify param for verification status', () => {
      expect(componentContent).toContain('searchParams.get("verify")');
    });

    it('should read location param for location mode', () => {
      expect(componentContent).toContain('searchParams.get("location")');
    });

    it('should read cost param for cost filter', () => {
      expect(componentContent).toContain('searchParams.get("cost")');
    });
  });

  describe('Filter Options', () => {
    it('should have correct time options', () => {
      expect(componentContent).toContain('value: "upcoming"');
      expect(componentContent).toContain('value: "past"');
      expect(componentContent).toContain('value: "all"');
    });

    it('should have correct type options', () => {
      expect(componentContent).toContain('value: "open_mic"');
      expect(componentContent).toContain('value: "showcase"');
      expect(componentContent).toContain('value: "workshop"');
      expect(componentContent).toContain('value: "song_circle"');
      expect(componentContent).toContain('value: "gig"');
    });

    it('should have correct location options', () => {
      expect(componentContent).toContain('value: "venue"');
      expect(componentContent).toContain('value: "online"');
      expect(componentContent).toContain('value: "hybrid"');
    });

    it('should have correct cost options', () => {
      expect(componentContent).toContain('value: "free"');
      expect(componentContent).toContain('value: "paid"');
      expect(componentContent).toContain('value: "unknown"');
    });
  });

  describe('UX Features', () => {
    it('should have debounced search', () => {
      expect(componentContent).toContain('setTimeout');
      expect(componentContent).toContain('300'); // 300ms debounce
    });

    it('should have Clear all button', () => {
      expect(componentContent).toContain('Clear all');
    });

    it('should have active filter pills', () => {
      expect(componentContent).toContain('activeFilters');
      expect(componentContent).toContain('Active:');
    });

    it('should have collapsible More filters section', () => {
      expect(componentContent).toContain('More filters');
      expect(componentContent).toContain('<details');
    });
  });
});

describe('Happenings Page Filter Logic', () => {
  const pagePath = path.join(__dirname, '../app/happenings/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');

  describe('Filter Implementation', () => {
    it('should filter by event_type', () => {
      expect(pageContent).toContain('.eq("event_type", "open_mic")');
      expect(pageContent).toContain('.eq("event_type", "showcase")');
      expect(pageContent).toContain('.eq("event_type", "workshop")');
    });

    it('should filter by DSC events', () => {
      expect(pageContent).toContain('.eq("is_dsc_event", true)');
    });

    it('should filter by verification status', () => {
      expect(pageContent).toContain('verifyFilter === "verified"');
      expect(pageContent).toContain('verifyFilter === "needs_verification"');
    });

    it('should filter by location mode', () => {
      expect(pageContent).toContain('.eq("location_mode", "venue")');
      expect(pageContent).toContain('.eq("location_mode", "online")');
      expect(pageContent).toContain('.eq("location_mode", "hybrid")');
    });

    it('should filter by cost', () => {
      expect(pageContent).toContain('.eq("is_free", true)');
      expect(pageContent).toContain('.eq("is_free", false)');
      expect(pageContent).toContain('.is("is_free", null)');
    });
  });

  describe('Search Implementation', () => {
    it('should search across event title', () => {
      expect(pageContent).toContain('event.title?.toLowerCase().includes(q)');
    });

    it('should search across event description', () => {
      expect(pageContent).toContain('event.description?.toLowerCase().includes(q)');
    });

    it('should search across venue_name', () => {
      expect(pageContent).toContain('event.venue_name?.toLowerCase().includes(q)');
    });

    it('should search across venue_address', () => {
      expect(pageContent).toContain('event.venue_address?.toLowerCase().includes(q)');
    });

    it('should search across custom location fields', () => {
      expect(pageContent).toContain('event.custom_location_name?.toLowerCase().includes(q)');
      expect(pageContent).toContain('event.custom_city?.toLowerCase().includes(q)');
    });

    it('should search across joined venue fields', () => {
      expect(pageContent).toContain('event.venues?.name?.toLowerCase().includes(q)');
      expect(pageContent).toContain('event.venues?.address?.toLowerCase().includes(q)');
    });
  });

  describe('Hero Visibility', () => {
    it('should hide hero when filters are active', () => {
      expect(pageContent).toContain('const showHero = !hasFilters');
    });

    it('should show hero on unfiltered /happenings', () => {
      expect(pageContent).toContain('showHero && (');
      expect(pageContent).toContain('<HeroSection');
    });
  });

  describe('Results Display', () => {
    it('should show results count summary', () => {
      // Phase 4.19 changed to "X events across Y dates (next 90 days)"
      expect(pageContent).toContain('totalDisplayableEvents');
      expect(pageContent).toContain('totalDates');
      expect(pageContent).toContain('(next 90 days)');
    });

    it('should show no results message with filter hint', () => {
      expect(pageContent).toContain('No happenings match your filters');
    });
  });
});

describe('Open Mics Redirect', () => {
  const redirectPath = path.join(__dirname, '../app/open-mics/page.tsx');
  const redirectContent = fs.readFileSync(redirectPath, 'utf-8');

  it('should redirect /open-mics to /happenings?type=open_mic', () => {
    expect(redirectContent).toContain('redirect("/happenings?type=open_mic")');
  });
});
