import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Denver Songwriters Collective",
  description: "How we handle your data at the Denver Songwriters Collective.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)] py-16 px-6">
      <article className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl text-[var(--color-text-primary)] mb-2">Privacy Policy</h1>
        <p className="text-[var(--color-text-tertiary)] mb-8">Last updated: December 2024</p>

        <div className="prose prose-lg space-y-8">
          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">Overview</h2>
            <p className="text-[var(--color-text-secondary)]">
              The Denver Songwriters Collective (&ldquo;DSC&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy.
              This policy explains what data we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">What We Collect</h2>
            <ul className="text-[var(--color-text-secondary)] space-y-2">
              <li><strong>Account info:</strong> Email address (required for login)</li>
              <li><strong>Profile info:</strong> Display name, bio, links (optional, only if you add them)</li>
              <li><strong>Activity:</strong> Events you RSVP to, suggestions you submit</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">What We Never Do</h2>
            <ul className="text-[var(--color-text-secondary)] space-y-2">
              <li>We never sell your data</li>
              <li>We never share your email publicly on the site</li>
              <li>We never send spam or share with third-party marketers</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">How We Use Your Data</h2>
            <ul className="text-[var(--color-text-secondary)] space-y-2">
              <li>To let you log in and manage your profile</li>
              <li>To show your public profile to other community members (if you create one)</li>
              <li>To process event RSVPs and suggestions you submit</li>
              <li>To send you updates you opt into (you can unsubscribe anytime)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">Your Rights</h2>
            <p className="text-[var(--color-text-secondary)] mb-4">You can:</p>
            <ul className="text-[var(--color-text-secondary)] space-y-2">
              <li><strong>Access</strong> your data anytime in your dashboard</li>
              <li><strong>Update</strong> your profile information</li>
              <li><strong>Delete</strong> your entire account and all associated data</li>
            </ul>
            <p className="text-[var(--color-text-secondary)] mt-4">
              To delete your account, go to{" "}
              <Link href="/dashboard/settings" className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline">
                Dashboard → Settings
              </Link>{" "}
              and click &quot;Delete My Account.&quot;
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">Data Storage</h2>
            <p className="text-[var(--color-text-secondary)]">
              Your data is stored securely on Supabase (our database provider) with
              encryption at rest. We use industry-standard security practices.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">Contact</h2>
            <p className="text-[var(--color-text-secondary)]">
              Questions? Email us at{" "}
              <a href="mailto:admin@denversongwriterscollective.org" className="text-[var(--color-link)] hover:text-[var(--color-link-hover)]">
                admin@denversongwriterscollective.org
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--color-border-subtle)]">
          <Link href="/" className="text-[var(--color-link)] hover:text-[var(--color-link-hover)]">
            ← Back to Home
          </Link>
        </div>
      </article>
    </main>
  );
}
