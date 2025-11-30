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
      <h1 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-4">
        Check your email
      </h1>
      <p className="text-[var(--color-warm-gray-light)] mb-6">
        We sent a confirmation link to{" "}
        <span className="font-bold text-[var(--color-warm-white)]">{email}</span>.
        Click the link to activate your account.
      </p>
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
      <Suspense fallback={<div className="text-neutral-400">Loading...</div>}>
        <ConfirmSentContent />
      </Suspense>
    </PageContainer>
  );
}
