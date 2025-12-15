import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

export default function StyleGuidePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <SectionHeader
        title="Style Guide"
        subtitle="Use the theme switcher in the header to preview presets."
      />

      <div className="mt-10 space-y-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Typography</h2>
          <p className="text-[var(--color-text-secondary)]">
            Secondary text sample. Accent: <span className="text-[var(--color-text-accent)]">accent text</span>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="subtle">Subtle</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-spotlight p-5">
              <div className="text-sm text-[var(--color-text-secondary)]">Card label</div>
              <div className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">Spotlight Card</div>
              <div className="mt-2 text-[var(--color-text-secondary)]">
                This card uses semantic tokens and should react to theme changes.
              </div>
            </div>
            <div className="card-base p-5">
              <div className="text-sm text-[var(--color-text-secondary)]">Card label</div>
              <div className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">Base Card</div>
              <div className="mt-2 text-[var(--color-text-secondary)]">
                Also driven by tokens.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
