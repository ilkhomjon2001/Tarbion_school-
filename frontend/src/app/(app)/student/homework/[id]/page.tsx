import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { HomeworkSubmitForm } from "@/components/features/student/HomeworkSubmitForm";
import { formatDate } from "@/lib/format";
import { SUBMISSION_LABELS, SUBMISSION_TONE } from "@/lib/labels";
import { getHomeworkById } from "@/lib/mock/fetchers";

export default async function HomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const homework = await getHomeworkById(id);

  if (!homework) {
    notFound();
  }

  return (
    <>
      <Header title={homework.subject} backHref="/student/homework" />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <Badge tone={SUBMISSION_TONE[homework.status]}>
              {SUBMISSION_LABELS[homework.status]}
            </Badge>
            <span className="text-xs text-foreground-muted">
              Muddat: {formatDate(homework.dueDate)}
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {homework.title}
          </h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {homework.description}
          </p>
          <p className="mt-3 text-xs text-foreground-muted">
            {homework.teacherName} · berilgan sana: {formatDate(homework.assignedDate)}
          </p>
        </Card>

        {homework.status === "graded" ? (
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Baho</p>
              <span className="text-xl font-semibold text-brand-dark">
                {homework.grade}
              </span>
            </div>
            {homework.teacherComment ? (
              <p className="text-sm text-foreground-muted">
                {homework.teacherComment}
              </p>
            ) : null}
          </Card>
        ) : null}

        {homework.status === "assigned" || homework.status === "late" ? (
          <HomeworkSubmitForm />
        ) : null}

        {homework.status === "submitted" ? (
          <Card className="bg-brand-tint text-brand-dark">
            <p className="text-sm font-medium">Vazifa topshirilgan</p>
            <p className="text-sm opacity-80">
              Ustoz tekshirgach, natija shu sahifada koʻrinadi.
            </p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
