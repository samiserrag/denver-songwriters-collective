import { redirect } from "next/navigation";

export default function OpenMicsRedirectPage() {
  redirect("/happenings?type=open_mic");
}
