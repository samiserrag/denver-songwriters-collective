import { PageContainer, HeroSection } from "@/components/layout";

// Prevent static prerendering - this page requires runtime env vars
export const dynamic = "force-dynamic";

export default function AdminHome() {
  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-6">
            Admin Panel
          </h1>
          <p className="text-neutral-300 text-lg">
            Manage platform users, performers, events, and studios.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">

          <a href="/dashboard/admin/users"
             className="block p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
            <h2 className="text-xl font-semibold text-gold-400 mb-2">Users</h2>
            <p className="text-neutral-300">View, promote to admin, delete, or reset roles.</p>
          </a>

          <a href="/dashboard/admin/performers"
             className="block p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
            <h2 className="text-xl font-semibold text-gold-400 mb-2">Performers</h2>
            <p className="text-neutral-300">View & edit performer profiles.</p>
          </a>

          <a href="/dashboard/admin/events"
             className="block p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
            <h2 className="text-xl font-semibold text-gold-400 mb-2">Events</h2>
            <p className="text-neutral-300">Create, update, delete events.</p>
          </a>

          <a href="/dashboard/admin/studios"
             className="block p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
            <h2 className="text-xl font-semibold text-gold-400 mb-2">Studios</h2>
            <p className="text-neutral-300">Manage studio partners and services.</p>
          </a>

        </div>
      </PageContainer>
    </>
  );
}