import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { formatDate } from "@/lib/format";
import { GRADE_TYPE_LABELS } from "@/lib/labels";
import { getGradeById, getHomeworkById } from "@/lib/mock/fetchers";

export default async function GradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const grade = await getGradeById(id);

  if (!grade) {
    notFound();
  }

  const homework = grade.homeworkId ? await getHomeworkById(grade.homeworkId) : null;

  return (
    <>
      <Header title={grade.subject} backHref="/student/grades" />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-tint text-2xl font-bold text-brand-dark">
            {grade.value}
          </span>
          <div className="min-w-0">
            <Badge tone="brand">{GRADE_TYPE_LABELS[grade.type]}</Badge>
            <p className="mt-1 text-sm text-foreground-muted">
              {formatDate(grade.date)}
            </p>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Bahoni qoʻygan ustoz
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {grade.teacherName}
          </p>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Ustoz izohi
          </p>
          <p className="mt-1 text-sm text-foreground-muted">{grade.comment}</p>
        </Card>

        {homework ? (
          <>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Qaysi vazifa uchun
              </p>
              <h2 className="mt-1 text-sm font-semibold text-foreground">
                {homework.title}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {homework.description}
              </p>
            </Card>

            {homework.submissionText ? (
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Siz nima joʻnatgan edingiz
                </p>
                <p className="mt-1 text-sm text-foreground-muted">
                  {homework.submissionText}
                </p>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
