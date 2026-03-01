import { redirect } from "next/navigation";
import ConversationalCreateUI from "../../_components/ConversationalCreateUI";

export const metadata = {
  title: "Create Happening | CSC",
};

export default function ConversationalCreatePage() {
  // -------------------------------------------------------------------------
  // Phase 8E: Feature flag — evaluated per-request to read runtime env vars.
  // -------------------------------------------------------------------------
  const CONVERSATIONAL_CREATE_ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY === "true" ||
    process.env.ENABLE_CONVERSATIONAL_CREATE_ENTRY === "true";

  if (!CONVERSATIONAL_CREATE_ENABLED) {
    redirect("/dashboard/my-events/new?classic=true");
  }

  return <ConversationalCreateUI variant="host" />;
}
