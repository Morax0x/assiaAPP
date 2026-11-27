import { redirect } from "next/navigation";

export const metadata = { title: "الصلاحيات" };

export default function RolesRedirect() {
  redirect("/settings/users");
}
