import { redirect } from "next/navigation";
import ConversationalCreateUI from "../../_components/ConversationalCreateUI";

// ---------------------------------------------------------------------------
// Phase 8E: Feature flag for host-facing conversational create entrypoint.
// Set NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=true in env to enable.
// When OFF, this route redirects to the classic form.
// ---------------------------------------------------------------------------

const CONVERSATIONAL_CREATE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY === "true";

export const metadata = {
  title: "Create Happening | CSC",
};

export default function ConversationalCreatePage() {
  if (!CONVERSATIONAL_CREATE_ENABLED) {
    redirect("/dashboard/my-events/new?classic=true");
  }

  return <ConversationalCreateUI variant="host" />;
}
