import { redirect } from "next/navigation";

export default function EventsRedirectPage() {
  redirect("/happenings?type=csc");
}
