"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { setPendingRedirect } from "@/lib/auth/pendingRedirect";
import { PageContainer, HeroSection } from "@/components/layout";

type MembershipResponse = {
  organization: {
    id: string;
    name: string | null;
    slug: string | null;
  };
  isTagged: boolean;
};

function OrganizationMembershipContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId");

  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [membership, setMembership] = useState<MembershipResponse | null>(null);

  const returnUrl = useMemo(() => {
    if (!organizationId) return "/organization-membership";
    return `/organization-membership?organizationId=${encodeURIComponent(organizationId)}`;
  }, [organizationId]);

  const loadMembership = useCallback(async () => {
    if (!organizationId) {
      setError("This link is missing an organization id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAuthRequired(false);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/organization-membership?organizationId=${encodeURIComponent(organizationId)}`
      );
      const data = await res.json();

      if (res.status === 401) {
        setAuthRequired(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Unable to load your organization membership.");
        setLoading(false);
        return;
      }

      setMembership(data as MembershipResponse);
    } catch (requestError) {
      console.error("Organization membership load error:", requestError);
      setError("Unable to load your organization membership.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  const handleRemove = async () => {
    if (!organizationId || !membership?.isTagged) return;
    setRemoving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/organization-membership?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (res.status === 401) {
        setAuthRequired(true);
        setRemoving(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to remove your member tag.");
        setRemoving(false);
        return;
      }

      setMembership((prev) => (prev ? { ...prev, isTagged: false } : prev));
      setSuccessMessage(data.message || "You have been removed from this organization profile.");
    } catch (requestError) {
      console.error("Organization membership remove error:", requestError);
      setError("Failed to remove your member tag.");
    } finally {
      setRemoving(false);
    }
  };

  const handleLoginRedirect = () => {
    setPendingRedirect(returnUrl);
    router.push(`/login?redirectTo=${encodeURIComponent(returnUrl)}`);
  };

  const handleSignupRedirect = () => {
    setPendingRedirect(returnUrl);
    router.push(`/signup?redirectTo=${encodeURIComponent(returnUrl)}`);
  };

  if (authRequired) {
    return (
      <PageContainer className="py-12 px-6">
        <div className="max-w-xl mx-auto rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Log In Required</h1>
          <p className="text-[var(--color-text-secondary)]">
            Log in or sign up to manage your organization tag.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleLoginRedirect}
              className="px-4 py-2 rounded bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)]"
            >
              Log In
            </button>
            <button
              onClick={handleSignupRedirect}
              className="px-4 py-2 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
            >
              Sign Up
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer className="py-12 px-6">
        <div className="max-w-xl mx-auto text-center text-[var(--color-text-tertiary)]">Loading...</div>
      </PageContainer>
    );
  }

  return (
    <>
      <HeroSection minHeight="xs" showVignette showBottomFade>
        <div className="text-center px-6 py-6">
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl text-white tracking-tight mb-2 drop-shadow-lg">
            Organization Membership
          </h1>
          <p className="text-lg text-white/90 drop-shadow">Manage your tag on a Friends profile</p>
        </div>
      </HeroSection>

      <PageContainer className="py-12 px-6">
        <div className="max-w-xl mx-auto rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {successMessage && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
          )}

          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {membership?.organization?.name || "Organization"}
          </h2>

          {membership?.isTagged ? (
            <>
              <p className="text-[var(--color-text-secondary)]">
                You are currently tagged as a connected member on this organization profile.
              </p>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove me from this organization"}
              </button>
            </>
          ) : (
            <p className="text-[var(--color-text-secondary)]">
              You are not currently tagged on this organization profile.
            </p>
          )}

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/friends-of-the-collective"
              className="text-sm text-[var(--color-text-accent)] hover:underline"
            >
              Back to Friends Directory
            </Link>
            <Link href="/dashboard/my-organizations" className="text-sm text-[var(--color-text-accent)] hover:underline">
              Go to My Organizations
            </Link>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

export default function OrganizationMembershipPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-12 px-6">
          <div className="max-w-xl mx-auto text-center text-[var(--color-text-tertiary)]">Loading...</div>
        </PageContainer>
      }
    >
      <OrganizationMembershipContent />
    </Suspense>
  );
}
