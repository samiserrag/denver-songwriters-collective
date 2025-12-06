import React from "react";

export default function WorkInProgressBanner() {
  return (
    <div className="mb-6 rounded-xl border border-[#00FFCC]/40 bg-[rgba(0,10,30,0.9)] px-4 py-3 text-sm text-[var(--color-warm-gray-light)] shadow-[0_0_16px_rgba(0,255,204,0.12)]">
      <p className="font-semibold text-[#00FFCC]">Work in Progress</p>
      <p className="mt-1">
        This section is under active development. Features are being added quickly.
        Your feedback can help guide the experience — tell us what works, what
        doesn't, and what you'd like added.
      </p>
    </div>
  );
}
