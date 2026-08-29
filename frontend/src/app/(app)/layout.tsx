import { AuthGuard } from "@/components/auth/AuthGuard";
import { BottomNav } from "@/components/ui/BottomNav";
import { MobileTopBar } from "@/components/ui/MobileTopBar";
import { Sidebar } from "@/components/ui/Sidebar";
import { Topbar } from "@/components/ui/Topbar";
import { buildSearchIndex } from "@/lib/search";
import {
  getAnnouncements,
  getCurrentStudent,
  getHomeworkList,
  getTestList,
} from "@/lib/mock/fetchers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [student, homework, tests, announcements] = await Promise.all([
    getCurrentStudent(),
    getHomeworkList(),
    getTestList(),
    getAnnouncements(),
  ]);
  const searchIndex = buildSearchIndex({ homework, tests, announcements });

  return (
    <AuthGuard>
      <div className="min-h-full bg-background">
        <Sidebar student={student} />
        <div className="flex min-h-full flex-col md:pl-64">
          <MobileTopBar student={student} searchIndex={searchIndex} />
          <Topbar student={student} searchIndex={searchIndex} />
          <div className="mx-auto w-full max-w-5xl flex-1 pb-20 md:pb-8">
            {children}
          </div>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
