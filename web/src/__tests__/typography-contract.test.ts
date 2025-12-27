/**
 * Typography Contract Regression Test
 *
 * Ensures heading font-family rules follow the canonical contract:
 * - Only ONE heading font-family rule should exist (h1-h6 using --font-display)
 * - No heading rule should use --font-family-serif (that's for body text fallback)
 *
 * This test prevents the regression where a conflicting rule like:
 *   h1, h2, h3 { font-family: var(--font-family-serif); }
 * would override the canonical rule and break the font preset system.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Typography Contract', () => {
  const globalsPath = path.join(__dirname, '../app/globals.css');
  const globalsContent = fs.readFileSync(globalsPath, 'utf-8');

  it('has exactly one heading font-family rule using --font-display', () => {
    // Match h1-h6 selectors followed by font-family in the same rule block
    // This regex finds CSS rules that target headings and set font-family
    const headingFontRules = globalsContent.match(
      /h[1-6][^{]*\{[^}]*font-family:[^}]+\}/g
    ) || [];

    // Filter to rules that actually set font-family for headings
    const rulesWithFontFamily = headingFontRules.filter(rule =>
      rule.includes('font-family:')
    );

    expect(rulesWithFontFamily.length).toBe(1);
    expect(rulesWithFontFamily[0]).toContain('var(--font-display)');
  });

  it('no heading rule uses --font-family-serif', () => {
    // Find all CSS rule blocks that target any heading element
    const headingRuleBlocks = globalsContent.match(
      /h[1-6][^{]*\{[^}]+\}/g
    ) || [];

    // Check that none of them use --font-family-serif for font-family
    for (const block of headingRuleBlocks) {
      if (block.includes('font-family:')) {
        expect(block).not.toContain('--font-family-serif');
      }
    }
  });

  it('canonical heading rule covers all heading levels (h1-h6)', () => {
    // The canonical rule should be: h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); }
    const canonicalRulePattern = /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*font-family:\s*var\(--font-display\)/;

    expect(globalsContent).toMatch(canonicalRulePattern);
  });

  it('.font-display class uses --font-family-display (not --font-family-serif)', () => {
    // The .font-display utility class should use the display font variable
    const fontDisplayClassPattern = /\.font-display\s*\{[^}]*font-family:\s*var\(--font-family-display\)/;

    expect(globalsContent).toMatch(fontDisplayClassPattern);
  });
});
