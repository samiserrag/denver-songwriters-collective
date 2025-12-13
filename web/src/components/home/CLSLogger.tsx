"use client";

import { useEffect } from "react";

/**
 * CLSLogger - Development-only component that logs layout shifts
 * to help identify CLS culprits.
 *
 * Only active in development mode.
 */
export function CLSLogger() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    // Track cumulative CLS
    let clsValue = 0;
    const clsEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Cast to LayoutShift type
        const layoutShift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: Array<{
            node?: Node;
            previousRect: DOMRectReadOnly;
            currentRect: DOMRectReadOnly;
          }>;
        };

        // Only count shifts without recent input
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
          clsEntries.push(entry);

          // Log each shift with details
          console.group(
            `🔴 Layout Shift: ${layoutShift.value.toFixed(4)} (cumulative: ${clsValue.toFixed(4)})`
          );
          console.log("Time:", entry.startTime.toFixed(0), "ms");
          console.log("Had recent input:", layoutShift.hadRecentInput);

          if (layoutShift.sources && layoutShift.sources.length > 0) {
            console.log("Affected elements:");
            layoutShift.sources.forEach((source, i) => {
              const node = source.node;
              if (node && node instanceof Element) {
                console.log(
                  `  ${i + 1}. ${node.tagName}${node.id ? "#" + node.id : ""}${node.className ? "." + String(node.className).split(" ").join(".") : ""}`
                );
                console.log("     Previous rect:", source.previousRect);
                console.log("     Current rect:", source.currentRect);
                console.log("     Element:", node);
              } else {
                console.log(`  ${i + 1}. [Node not available]`);
                console.log("     Previous rect:", source.previousRect);
                console.log("     Current rect:", source.currentRect);
              }
            });
          }
          console.groupEnd();
        }
      }
    });

    try {
      observer.observe({ type: "layout-shift", buffered: true });
      console.log("📊 CLS Logger active - watching for layout shifts...");
    } catch (e) {
      console.warn("Layout shift observation not supported:", e);
    }

    // Log final CLS on page unload
    const logFinalCLS = () => {
      console.log(`📊 Final CLS: ${clsValue.toFixed(4)}`);
      console.log(`📊 Total shifts recorded: ${clsEntries.length}`);
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        logFinalCLS();
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
