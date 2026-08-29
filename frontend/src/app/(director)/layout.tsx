import { DirectorMobileTopBar } from "@/components/director/DirectorMobileTopBar";
import { DirectorSidebar } from "@/components/director/DirectorSidebar";
import { DirectorTopbar } from "@/components/director/DirectorTopbar";
import { buildDirectorSearchIndex } from "@/lib/director/search";
import { getSchoolClasses, getTeachers } from "@/lib/director/fetchers";

export default async function DirectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [teachers, classes] = await Promise.all([getTeachers(), getSchoolClasses()]);
  const searchIndex = buildDirectorSearchIndex({ teachers, classes });

  return (
    <div className="min-h-full bg-background">
      <DirectorSidebar />
      <div className="flex min-h-full flex-col md:pl-64">
        <DirectorMobileTopBar searchIndex={searchIndex} />
        <DirectorTopbar searchIndex={searchIndex} />
        <div className="mx-auto w-full max-w-6xl flex-1 pb-8">{children}</div>
      </div>
    </div>
  );
}
