import { redirect } from "next/navigation";

/**
 * Ildiz — /login ga (SEO): kabinetlar robots.ts da yopiq, shuning
 * uchun bot ochiq sahifaga yetib borishi kerak. Kirgan foydalanuvchini
 * /login sahifasining oʻzi kabinetiga oʻtkazadi (sessiya tiklansa).
 */
export default function RootPage() {
  redirect("/login");
}
