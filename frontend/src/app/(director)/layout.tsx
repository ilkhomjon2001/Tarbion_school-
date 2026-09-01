import { AuthGuard } from "@/components/auth/AuthGuard";
import { DirectorMobileTopBar } from "@/components/director/DirectorMobileTopBar";
import { DirectorSidebar } from "@/components/director/DirectorSidebar";
import { DirectorTopbar } from "@/components/director/DirectorTopbar";
import { buildDirectorSearchIndex } from "@/lib/director/search";

export default function DirectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Qidiruvda faqat sahifalar: ustoz va sinf roʻyxati endi BAZADAN keladi
  // (mock emas), ularni har sahifa ochilishida oldindan yuklash qimmat.
  const searchIndex = buildDirectorSearchIndex({ teachers: [], classes: [] });

  return (
    <AuthGuard role="director">
      <div className="min-h-full bg-background">
        <DirectorSidebar />
        <div className="flex min-h-full flex-col md:pl-64">
          <DirectorMobileTopBar searchIndex={searchIndex} />
          <DirectorTopbar searchIndex={searchIndex} />
          <div className="mx-auto w-full max-w-6xl flex-1 pb-8">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
