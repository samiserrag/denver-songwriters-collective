'use client';

import { ChevronDown } from 'lucide-react';

export function ScrollIndicator() {
  const handleClick = () => {
    window.scrollTo({
      top: window.innerHeight - 100,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[var(--color-warm-gray)] hover:text-[var(--color-text-accent)] transition-colors cursor-pointer group"
      aria-label="Scroll to content"
    >
      <span className="text-xs uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
        Explore
      </span>
      <div className="animate-scroll-bounce">
        <ChevronDown className="w-6 h-6" />
      </div>
    </button>
  );
}
