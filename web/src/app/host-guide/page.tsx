import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout";

export const metadata: Metadata = {
  title: "Host Guide | The Colorado Songwriters Collective",
  description: "Everything you need to know about hosting and managing happenings on The Colorado Songwriters Collective.",
};

export default function HostGuidePage() {
  const sectionClass = "space-y-3";
  const headingClass = "text-lg font-semibold text-[var(--color-text-primary)]";
  const bodyClass = "text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]";
  const listClass = "list-disc pl-5 space-y-1.5 text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]";

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto py-12 px-6 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Host Guide
          </h1>
          <p className={bodyClass}>
            Welcome! Here&apos;s everything you need to manage your happening on The Colorado Songwriters Collective.
          </p>
        </div>

        <section className={sectionClass}>
          <h2 className={headingClass}>Finding your event controls</h2>
          <p className={bodyClass}>
            Go to your{" "}
            <Link href="/dashboard/my-events" className="text-[var(--color-accent)] hover:underline">
              Dashboard &rarr; My Happenings
            </Link>{" "}
            and click on your event. This opens the management view with all your controls.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Management tabs</h2>
          <ul className={listClass}>
            <li><strong>Details</strong> &mdash; Edit your event title, description, schedule, location, cost, and more.</li>
            <li><strong>Photos</strong> &mdash; Upload cover images and event photos.</li>
            <li><strong>Attendees</strong> &mdash; View RSVPs and manage the performer lineup.</li>
            <li><strong>Private &amp; Invites</strong> &mdash; Create invite links and manage event visibility.</li>
            <li><strong>Host &amp; Co-Host Settings</strong> &mdash; Invite co-hosts, manage roles, or transfer hosting.</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Editing with AI</h2>
          <p className={bodyClass}>
            From your{" "}
            <Link href="/dashboard/my-events" className="text-[var(--color-accent)] hover:underline">
              My Happenings
            </Link>{" "}
            page, you can use the AI assistant to update event details by describing the changes
            you want to make in plain English. It works for most fields &mdash; title, description,
            schedule, location, cost, and more.
          </p>
          <p className={bodyClass}>
            <strong>Note:</strong> Image uploads need to be done manually through the Photos or Details tab.
            The AI assistant can&apos;t upload images yet.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>What you can do as host</h2>
          <ul className={listClass}>
            <li>Edit all event details (schedule, location, description, cost)</li>
            <li>Upload and manage event photos</li>
            <li>View and manage RSVPs and attendees</li>
            <li>Manage the performer lineup and time slots</li>
            <li>Invite co-hosts to help manage your event</li>
            <li>Create shareable invite links</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Need help?</h2>
          <p className={bodyClass}>
            If you have questions or run into issues, reach out through our{" "}
            <Link href="/contact" className="text-[var(--color-accent)] hover:underline">
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
