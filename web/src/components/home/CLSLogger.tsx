"use client";

import { useEffect } from "react";

/**
 * Generate a CSS selector path for an element
 */
function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) selector += `.${classes}`;
    }

    // Add nth-child for specificity
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.slice(-4).join(' > '); // Last 4 levels for readability
}

/**
 * Get computed dimensions that might be causing the shift
 */
function getDimensionInfo(el: Element): string {
  const style = window.getComputedStyle(el);
  const info: string[] = [];

  if (style.height === 'auto' || style.height === '') info.push('height:auto');
  if (style.minHeight === '0px' || style.minHeight === '') info.push('no min-height');
  if (!style.aspectRatio || style.aspectRatio === 'auto') info.push('no aspect-ratio');
  if (style.position === 'static') info.push('position:static');

  return info.length ? `⚠️ ${info.join(', ')}` : '✓ has dimensions';
}

/**
 * CLSLogger - Development-only component that logs layout shifts
 * with actionable source information.
 *
 * Only active in development mode.
 *
 * USAGE: Check browser console for CLS shift logs.
 * Look for "SOURCE" entries - these are elements that CAUSED the shift.
 * Fix by adding min-height, aspect-ratio, or skeleton placeholders.
 */
export function CLSLogger() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    let clsValue = 0;
    const shiftLog: Array<{
      time: number;
      value: number;
      sources: string[];
    }> = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: Array<{
            node?: Node;
            previousRect: DOMRectReadOnly;
            currentRect: DOMRectReadOnly;
          }>;
        };

        if (!layoutShift.hadRecentInput && layoutShift.value > 0.001) {
          clsValue += layoutShift.value;

          const sources: string[] = [];

          console.group(
            `%c🔴 CLS +${layoutShift.value.toFixed(4)} (total: ${clsValue.toFixed(4)}) @ ${entry.startTime.toFixed(0)}ms`,
            'color: #ef4444; font-weight: bold;'
          );

          if (layoutShift.sources && layoutShift.sources.length > 0) {
            layoutShift.sources.forEach((source, i) => {
              const node = source.node;
              if (node && node instanceof Element) {
                const selector = getSelector(node);
                const dimInfo = getDimensionInfo(node);
                const yShift = source.currentRect.y - source.previousRect.y;
                const heightChange = source.currentRect.height - source.previousRect.height;

                sources.push(selector);

                console.log(
                  `%cSOURCE ${i + 1}: %c${selector}`,
                  'color: #f59e0b; font-weight: bold;',
                  'color: #3b82f6;'
                );
                console.log(`  Y shift: ${yShift > 0 ? '+' : ''}${yShift.toFixed(0)}px`);
                console.log(`  Height change: ${heightChange !== 0 ? (heightChange > 0 ? '+' : '') + heightChange.toFixed(0) + 'px' : 'none'}`);
                console.log(`  Dimensions: ${dimInfo}`);
                console.log(`  Element:`, node);

                // Try to find what pushed this element
                if (yShift > 0) {
                  const prev = node.previousElementSibling;
                  if (prev) {
                    console.log(
                      `  %cPossible culprit (previous sibling): %c${getSelector(prev)}`,
                      'color: #ef4444;',
                      'color: #3b82f6;'
                    );
                    console.log(`    Sibling dimensions: ${getDimensionInfo(prev)}`);
                  }
                }
              } else {
                console.log(`SOURCE ${i + 1}: [detached node]`);
                console.log(`  Previous: y=${source.previousRect.y.toFixed(0)}, h=${source.previousRect.height.toFixed(0)}`);
                console.log(`  Current: y=${source.currentRect.y.toFixed(0)}, h=${source.currentRect.height.toFixed(0)}`);
              }
            });
          } else {
            console.log('%cNo source nodes captured (shift may be from font/image load)', 'color: #9ca3af;');
          }

          console.groupEnd();

          shiftLog.push({
            time: entry.startTime,
            value: layoutShift.value,
            sources
          });
        }
      }
    });

    try {
      observer.observe({ type: "layout-shift", buffered: true });
      console.log(
        '%c📊 CLS Logger Active%c\nWatching for layout shifts...\nLook for SOURCE entries to find elements to fix.',
        'color: #10b981; font-weight: bold; font-size: 14px;',
        'color: #9ca3af;'
      );
    } catch (e) {
      console.warn("Layout shift observation not supported:", e);
    }

    // Summary on page hide
    const logSummary = () => {
      if (shiftLog.length === 0) return;

      console.group('%c📊 CLS Summary', 'color: #10b981; font-weight: bold;');
      console.log(`Total CLS: ${clsValue.toFixed(4)}`);
      console.log(`Shift count: ${shiftLog.length}`);
      console.log(`Status: ${clsValue <= 0.1 ? '✅ Good' : clsValue <= 0.25 ? '⚠️ Needs Improvement' : '❌ Poor'}`);

      // Find most frequent sources
      const sourceCounts = new Map<string, number>();
      shiftLog.forEach(s => {
        s.sources.forEach(src => {
          sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
        });
      });

      if (sourceCounts.size > 0) {
        console.log('\nMost shifted elements:');
        Array.from(sourceCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([selector, count]) => {
            console.log(`  ${count}x: ${selector}`);
          });
      }
      console.groupEnd();
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") logSummary();
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
