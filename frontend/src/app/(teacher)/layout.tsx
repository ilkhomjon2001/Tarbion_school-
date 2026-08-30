import { AuthGuard } from "@/components/auth/AuthGuard";

/**
 * Ustoz kabineti. Sahifa tarkibi har bir sahifaning oʻzida — bu qatlam
 * faqat kirish tekshiruvini qoʻshadi.
 */
export default function TeacherRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard role="teacher">{children}</AuthGuard>;
}
