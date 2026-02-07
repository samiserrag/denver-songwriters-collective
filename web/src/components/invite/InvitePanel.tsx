"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { appLogger } from "@/lib/appLogger";
import {
  INVITE_CTA_BODY,
  INVITE_CTA_FOOTER,
  INVITE_CTA_HEADLINE,
  INVITE_EMAIL_SUBJECT,
  buildInviteEmailBody,
} from "@/lib/referrals";

interface InvitePanelProps {
  source: string;
}

function buildInviteUrl(): string {
  const baseOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://denversongwriterscollective.org";
  const inviteUrl = new URL("/", baseOrigin);
  return inviteUrl.toString();
}

export default function InvitePanel({ source }: InvitePanelProps) {
  const inviteUrl = useMemo(() => buildInviteUrl(), []);
  const defaultInviteMessage = useMemo(() => buildInviteEmailBody(inviteUrl), [inviteUrl]);
  const [inviteMessage, setInviteMessage] = useState(defaultInviteMessage);

  useEffect(() => {
    setInviteMessage(defaultInviteMessage);
  }, [defaultInviteMessage]);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(INVITE_EMAIL_SUBJECT);
    const body = encodeURIComponent(inviteMessage);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [inviteMessage]);

  const logInviteAction = async (action: string) => {
    await appLogger.info(
      "member_invite_action",
      {
        action,
        source,
        referral_via: "member_invite",
      },
      { source: "invite-page" },
    );
  };

  useEffect(() => {
    void logInviteAction("view");
    // Log once for the current source context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      await logInviteAction("copy_link");
      toast.success("Invite link copied");
    } catch {
      toast.error("Unable to copy invite link");
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      try {
        await navigator.clipboard.writeText(inviteMessage);
        await logInviteAction("share_fallback_copy");
        toast.success("Share message copied. Paste it anywhere.");
      } catch {
        toast.error("Unable to share right now. Try Copy Link or Email Invite.");
      }
      return;
    }
    try {
      await navigator.share({
        title: "Denver Songwriters Collective",
        text: inviteMessage,
      });
      await logInviteAction("native_share");
    } catch {
      // User cancel is expected on some devices; no error toast needed.
    }
  };

  return (
    <main className="min-h-screen py-10 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="card-base p-6 rounded-xl border border-[var(--color-border-default)]">
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-3">
            Invite Friends
          </h1>
          <p className="text-[var(--color-text-secondary)] text-base">
            {INVITE_CTA_HEADLINE} {INVITE_CTA_BODY}
          </p>
          <p className="text-[var(--color-text-tertiary)] text-sm mt-2">
            {INVITE_CTA_FOOTER}
          </p>
        </section>

        <section className="card-base p-6 rounded-xl border border-[var(--color-border-default)] space-y-3">
          <label
            htmlFor="invite-link"
            className="block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Your share link
          </label>
          <input
            id="invite-link"
            type="text"
            value={inviteUrl}
            readOnly
            className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          />

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="invite-message"
                className="block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Message preview (you can edit)
              </label>
              <button
                type="button"
                onClick={() => setInviteMessage(defaultInviteMessage)}
                className="text-xs text-[var(--color-text-accent)] hover:underline"
              >
                Reset message
              </button>
            </div>
            <textarea
              id="invite-message"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={10}
              className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-y"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Email Invite and Share both use this message.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Copy Link
            </button>
            <a
              href={mailtoHref}
              onClick={() => {
                void logInviteAction("mailto");
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)] transition-colors"
            >
              Email Invite
            </a>
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)] transition-colors"
            >
              Share
            </button>
          </div>
        </section>

        <section className="card-base p-6 rounded-xl border border-[var(--color-border-default)] space-y-3">
          <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)]">
            Thank you for sharing the Collective!!
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            This community grows through people inviting people.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Each share helps local musicians, hosts, venues, and music lovers connect.
          </p>
          <blockquote className="border-l-2 border-[var(--color-border-subtle)] pl-3 text-sm text-[var(--color-text-tertiary)] italic">
            “We are the music makers, and we are the dreamers of dreams.”
            <br />
            — Willy Wonka
          </blockquote>
        </section>

        <section className="text-sm text-[var(--color-text-tertiary)]">
          Looking for what to share? Start with{" "}
          <Link href="/happenings" className="text-[var(--color-text-accent)] hover:underline">
            this week&apos;s happenings
          </Link>
          {" "}or{" "}
          <Link href="/happenings?type=open_mic" className="text-[var(--color-text-accent)] hover:underline">
            upcoming open mics
          </Link>
          .
        </section>
      </div>
    </main>
  );
}
