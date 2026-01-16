"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import { toast } from "sonner";

function ConfirmSentContent() {
  const params = useSearchParams();
  const email = params.get("email");
  const { resendConfirmationEmail } = useAuth();

  const handleResend = async () => {
    if (!email) return;
    const res = await resendConfirmationEmail(email);
    if (res.success) {
      toast.success("Confirmation email re-sent!");
    } else {
      toast.error(res.error || "Failed to resend email");
    }
  };

  return (
    <div className="w-full max-w-md card-base px-8 py-10 text-center">
      <h1 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-4">
        Check your email
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-4">
        We sent a confirmation link to{" "}
        <span className="font-bold text-[var(--color-text-primary)]">{email}</span>.
        Click the link to activate your account.
      </p>

      {/* Prominent junk mail warning */}
      <div className="mb-6 p-4 rounded-lg bg-amber-100 border border-amber-300">
        <p className="text-sm text-amber-800 font-medium mb-1">
          Can&apos;t find it?
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Check your <span className="font-semibold text-[var(--color-text-primary)]">spam or junk folder</span>.
          If you find it there, please mark us as a trusted sender so you don&apos;t miss future notifications!
        </p>
      </div>

      <Button
        onClick={handleResend}
        variant="secondary"
        size="default"
        className="w-full"
      >
        Resend confirmation email
      </Button>
    </div>
  );
}

export default function ConfirmSentPage() {
  return (
    <PageContainer as="main" className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<div className="text-[var(--color-text-tertiary)]">Loading...</div>}>
        <ConfirmSentContent />
      </Suspense>
    </PageContainer>
  );
}
