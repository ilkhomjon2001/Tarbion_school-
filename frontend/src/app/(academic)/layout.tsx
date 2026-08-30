import { AcademicMobileTopBar, AcademicSidebar } from "@/components/academic/AcademicShell";
import { AuthGuard } from "@/components/auth/AuthGuard";

/**
 * Oʻquv boʻlimi kabineti.
 *
 * Imtihon tashkil qiladi, natijani kiritadi, dars rejasini nazorat qiladi
 * va ustozlar faoliyatini kuzatadi. Maʼlumot kiritadigan rol — shu sabab
 * baho va davomatga tegmaydi (u ustoz ishi), lekin imtihon bali shu
 * yerdan chiqadi.
 */
export default function AcademicLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="academic">
      <div className="min-h-full bg-background">
        <AcademicSidebar />
        <div className="flex min-h-full flex-col md:pl-64">
          <AcademicMobileTopBar />
          <div className="mx-auto w-full max-w-6xl flex-1 pb-10">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
