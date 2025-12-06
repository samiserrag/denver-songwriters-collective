import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Denver Songwriters Collective",
  description: "How we handle your data at the Denver Songwriters Collective.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black py-16 px-6">
      <article className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl text-white mb-2">Privacy Policy</h1>
        <p className="text-neutral-400 mb-8">Last updated: December 2024</p>

        <div className="prose prose-invert prose-lg space-y-8">
          <section>
            <h2 className="font-display text-2xl text-white mb-4">Overview</h2>
            <p className="text-neutral-300">
              The Denver Songwriters Collective ("DSC", "we", "us") respects your privacy.
              This policy explains what data we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-white mb-4">What We Collect</h2>
            <ul className="text-neutral-300 space-y-2">
              <li><strong>Account info:</strong> Email address (required for login)</li>
              <li><strong>Profile info:</strong> Display name, bio, links (optional, only if you add them)</li>
              <li><strong>Activity:</strong> Events you RSVP to, suggestions you submit</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-white mb-4">What We Never Do</h2>
            <ul className="text-neutral-300 space-y-2">
              <li>We never sell your data</li>
              <li>We never share your email publicly on the site</li>
              <li>We never send spam or share with third-party marketers</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-white mb-4">How We Use Your Data</h2>
            <ul className="text-neutral-300 space-y-2">
              <li>To let you log in and manage your profile</li>
              <li>To show your public profile to other community members (if you create one)</li>
              <li>To process event RSVPs and suggestions you submit</li>
              <li>To send you updates you opt into (you can unsubscribe anytime)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-white mb-4">Your Rights</h2>
            <p className="text-neutral-300 mb-4">You can:</p>
            <ul className="text-neutral-300 space-y-2">
              <li><strong>Access</strong> your data anytime in your dashboard</li>
              <li><strong>Update</strong> your profile information</li>
              <li><strong>Delete</strong> your entire account and all associated data</li>
            </ul>
            <p className="text-neutral-300 mt-4">
              To delete your account, go to{" "}
              <Link href="/dashboard/settings" className="text-gold-400 hover:text-gold-300 underline">
                Dashboard → Settings
              </Link>{" "}
              and click &quot;Delete My Account.&quot;
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-white mb-4">Data Storage</h2>
            <p className="text-neutral-300">
              Your data is stored securely on Supabase (our database provider) with
              encryption at rest. We use industry-standard security practices.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-white mb-4">Contact</h2>
            <p className="text-neutral-300">
              Questions? Email us at{" "}
              <a href="mailto:privacy@denversongwriters.co" className="text-gold-400 hover:text-gold-300">
                privacy@denversongwriters.co
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800">
          <Link href="/" className="text-gold-400 hover:text-gold-300">
            ← Back to Home
          </Link>
        </div>
      </article>
    </main>
  );
}
