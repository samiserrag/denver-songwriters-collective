/**
 * Regression test: Ensure nav never links to legacy listing routes
 *
 * These tests verify that navigation components point to the canonical
 * /happenings route rather than legacy /open-mics or /events listing routes.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Navigation Links', () => {
  const navDir = path.join(__dirname, '../components/navigation');

  it('header should not contain legacy /open-mics listing link', () => {
    const headerPath = path.join(navDir, 'header.tsx');
    const headerContent = fs.readFileSync(headerPath, 'utf-8');

    // Should not have /open-mics as exact listing route (without ?type= param)
    // But /open-mics/[slug] detail routes are OK
    const legacyListingPattern = /href:\s*["'`]\/open-mics["'`]/;
    expect(headerContent).not.toMatch(legacyListingPattern);
  });

  it('header should not contain legacy /events listing link', () => {
    const headerPath = path.join(navDir, 'header.tsx');
    const headerContent = fs.readFileSync(headerPath, 'utf-8');

    // Should not have /events as exact listing route
    // But /events/[id] detail routes are OK
    const legacyListingPattern = /href:\s*["'`]\/events["'`]/;
    expect(headerContent).not.toMatch(legacyListingPattern);
  });

  it('footer should not contain legacy /open-mics listing link', () => {
    const footerPath = path.join(navDir, 'footer.tsx');
    const footerContent = fs.readFileSync(footerPath, 'utf-8');

    const legacyListingPattern = /href=["'`]\/open-mics["'`]/;
    expect(footerContent).not.toMatch(legacyListingPattern);
  });

  it('footer should not contain legacy /events listing link', () => {
    const footerPath = path.join(navDir, 'footer.tsx');
    const footerContent = fs.readFileSync(footerPath, 'utf-8');

    const legacyListingPattern = /href=["'`]\/events["'`]/;
    expect(footerContent).not.toMatch(legacyListingPattern);
  });

  it('header should NOT have Open Mics link after Phase 4.2', () => {
    const headerPath = path.join(navDir, 'header.tsx');
    const headerContent = fs.readFileSync(headerPath, 'utf-8');

    // Phase 4.2: Open Mics link removed from header nav
    // Users now use the filter bar on /happenings
    expect(headerContent).not.toMatch(/label:\s*["'`]Open Mics["'`]/);
  });

  it('footer should use /happenings?type=open_mic for open mics', () => {
    const footerPath = path.join(navDir, 'footer.tsx');
    const footerContent = fs.readFileSync(footerPath, 'utf-8');

    // Should have /happenings?type=open_mic
    expect(footerContent).toMatch(/\/happenings\?type=open_mic/);
  });
});
