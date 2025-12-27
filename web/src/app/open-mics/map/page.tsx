import { redirect } from "next/navigation";

export default function OpenMicsMapRedirectPage() {
  redirect("/happenings?type=open_mic");
}
