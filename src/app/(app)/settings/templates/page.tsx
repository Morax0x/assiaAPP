import { redirect } from "next/navigation";

export const metadata = { title: "قوالب الخدمات" };

export default function TemplatesRedirect() {
  redirect("/services");
}
