import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { TeacherTable } from "@/components/director/TeacherTable";
import { getSubjectList, getTeachers } from "@/lib/director/fetchers";

export default function TeachersPage() {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<Card className="h-96 animate-pulse" />}>
        <TeacherTableSection />
      </Suspense>
    </div>
  );
}

async function TeacherTableSection() {
  const [teachers, subjects] = await Promise.all([getTeachers(), getSubjectList()]);
  return <TeacherTable initialTeachers={teachers} subjects={subjects} />;
}
