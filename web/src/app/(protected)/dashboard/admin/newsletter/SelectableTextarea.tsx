"use client";

export default function SelectableTextarea({ value }: { value: string }) {
  return (
    <textarea
      readOnly
      value={value}
      className="w-full h-32 p-3 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] text-[var(--color-text-primary)] text-sm font-mono resize-none"
      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
    />
  );
}
