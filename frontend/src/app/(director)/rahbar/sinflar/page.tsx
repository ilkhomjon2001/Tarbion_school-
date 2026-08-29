import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { ClassesBoard } from "@/components/director/ClassesBoard";
import { getSchoolClasses } from "@/lib/director/fetchers";

export default function ClassesPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Sinflar</h1>
        <p className="text-sm text-foreground-muted">
          Sinflar roʻyxati, sinf rahbarlari va oʻquvchilar davomati
        </p>
      </div>
      <Suspense fallback={<Card className="h-72 animate-pulse" />}>
        <ClassesSection />
      </Suspense>
    </div>
  );
}

async function ClassesSection() {
  const classes = await getSchoolClasses();
  return <ClassesBoard classes={classes} />;
}
