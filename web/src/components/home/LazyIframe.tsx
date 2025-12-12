"use client";

import { useEffect, useRef, useState } from "react";

interface LazyIframeProps {
  src: string;
  title: string;
  width?: string;
  height?: string;
  className?: string;
  allow?: string;
  allowFullScreen?: boolean;
  referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>["referrerPolicy"];
}

/**
 * LazyIframe - Defers iframe loading until the element is near the viewport.
 * This prevents render-blocking resources from delaying LCP.
 */
export function LazyIframe({
  src,
  title,
  width = "100%",
  height = "100%",
  className,
  allow,
  allowFullScreen,
  referrerPolicy,
}: LazyIframeProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsLoaded(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "200px", // Start loading 200px before entering viewport
        threshold: 0,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ width, height }}>
      {isLoaded ? (
        <iframe
          src={src}
          title={title}
          width="100%"
          height="100%"
          frameBorder={0}
          allow={allow}
          allowFullScreen={allowFullScreen}
          referrerPolicy={referrerPolicy}
          className="rounded-xl"
        />
      ) : (
        <div className="w-full h-full bg-[var(--color-indigo-950)]/50 rounded-xl flex items-center justify-center">
          <div className="text-[var(--color-warm-gray)] text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
}
