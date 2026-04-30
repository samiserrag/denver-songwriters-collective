export function canSendExplicitConfirmation(args: {
  automatic: boolean;
  pendingPublishedRiskConfirmation: boolean;
  pendingPublishedRiskPatchFingerprint: string | null;
  currentPatchFingerprint: string;
}): boolean {
  const {
    automatic,
    pendingPublishedRiskConfirmation,
    pendingPublishedRiskPatchFingerprint,
    currentPatchFingerprint,
  } = args;

  if (automatic) return false;
  if (!pendingPublishedRiskConfirmation) return false;
  if (!pendingPublishedRiskPatchFingerprint) return false;
  return pendingPublishedRiskPatchFingerprint === currentPatchFingerprint;
}
