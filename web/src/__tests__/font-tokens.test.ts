/**
 * Font Token Chain Tests
 *
 * Verifies the expected font token resolution for the DSC theme.
 *
 * The token chain for display fonts:
 *   h1-h6 → font-family: var(--font-display)
 *         → --font-display: var(--font-family-display)  [body selector]
 *         → --font-family-display: var(--font-fraunces), "Fraunces", Georgia, serif  [body selector]
 *         → --font-fraunces  [set by Next.js font loader on body class]
 *
 * Key insight: Font variables MUST be defined in `body {}` (not `@theme`/`:root`)
 * because Next.js font loader sets `--font-fraunces` via a class on `<body>`,
 * which is not accessible from `:root` level CSS variables.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Font Token Chain', () => {
  const globalsCssPath = path.join(__dirname, '../app/globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');

  it('defines --font-family-display with Fraunces in body selector', () => {
    // Match the body selector block
    const bodyBlockMatch = globalsCss.match(/body\s*\{[^}]+\}/s);
    expect(bodyBlockMatch).not.toBeNull();

    const bodyBlock = bodyBlockMatch![0];
    // Verify --font-family-display uses --font-fraunces
    expect(bodyBlock).toMatch(/--font-family-display:\s*var\(--font-fraunces\)/);
    // Verify Fraunces is in the fallback chain
    expect(bodyBlock).toMatch(/--font-family-display:[^;]*"Fraunces"/);
  });

  it('defines --font-display as alias to --font-family-display in body', () => {
    const bodyBlockMatch = globalsCss.match(/body\s*\{[^}]+\}/s);
    expect(bodyBlockMatch).not.toBeNull();

    const bodyBlock = bodyBlockMatch![0];
    expect(bodyBlock).toMatch(/--font-display:\s*var\(--font-family-display\)/);
  });

  it('h1-h6 selector uses var(--font-display)', () => {
    // Match the h1-h6 selector
    const headingsMatch = globalsCss.match(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]+\}/s);
    expect(headingsMatch).not.toBeNull();

    const headingsBlock = headingsMatch![0];
    expect(headingsBlock).toMatch(/font-family:\s*var\(--font-display\)/);
  });

  it('does NOT define --font-family-display as Playfair in body', () => {
    const bodyBlockMatch = globalsCss.match(/body\s*\{[^}]+\}/s);
    expect(bodyBlockMatch).not.toBeNull();

    const bodyBlock = bodyBlockMatch![0];
    // --font-family-display should NOT resolve to Playfair
    expect(bodyBlock).not.toMatch(/--font-family-display:\s*var\(--font-playfair\)/);
  });
});

describe('FontSwitcher Labels', () => {
  it('default font label matches actual default (Fraunces)', () => {
    const fontSwitcherPath = path.join(__dirname, '../components/ui/FontSwitcher.tsx');
    const fontSwitcher = fs.readFileSync(fontSwitcherPath, 'utf-8');

    // Default option (id: "") should mention Fraunces, not Playfair
    expect(fontSwitcher).toMatch(/id:\s*"",\s*label:\s*"[^"]*Fraunces/);
    expect(fontSwitcher).not.toMatch(/id:\s*"",\s*label:\s*"Default \(Playfair/);
  });
});
