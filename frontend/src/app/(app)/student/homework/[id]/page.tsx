"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/Skeleton";
import { HomeworkSubmitForm } from "@/components/features/student/HomeworkSubmitForm";
import { messageOf } from "@/components/shared/LiveSession";
import { formatDate } from "@/lib/format";
import { SUBMISSION_LABELS, SUBMISSION_TONE } from "@/lib/labels";
import {
  fetchHomeworkList,
  fetchStudentMe,
  submitHomework,
} from "@/lib/student/api";
import type { Homework } from "@/lib/types";

/**
 * Vazifa tafsiloti va topshirish — BAZADAN (UYV-02, UYV-04).
 *
 * `id` — submission id: topshirish ham shu id bilan ketadi. Muddatdan
 * keyin topshirilsa server `late` deb belgilaydi — frontend hisoblamaydi.
 */
export default function HomeworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [homework, setHomework] = useState<Homework | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) {
          setHomework(null);
          return;
        }
        const list = await fetchHomeworkList(me.studentId);
        setHomework(list.find((h) => h.id === id) ?? null);
      } catch (err) {
        setError(messageOf(err));
        setHomework(null);
      }
    })();
  }, [id]);

  async function submit(text: string) {
    setHomework(await submitHomework(id, text));
  }

  if (homework === undefined) {
    return (
      <>
        <Header title="Uy vazifasi" backHref="/student/homework" />
        <div className="p-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  if (homework === null) {
    return (
      <>
        <Header title="Uy vazifasi" backHref="/student/homework" />
        <div className="p-4">
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : (
            <EmptyState title="Vazifa topilmadi" />
          )}
        </div>
      </>
    );
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
              Muddat: {formatDate(homework.dueDate.slice(0, 10))}
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground">{homework.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">{homework.description}</p>
        </Card>

        {homework.status === "graded" ? (
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Baho</p>
              <span className="text-xl font-semibold text-brand-dark">{homework.grade}</span>
            </div>
            {homework.teacherComment ? (
              <p className="text-sm text-foreground-muted">{homework.teacherComment}</p>
            ) : null}
          </Card>
        ) : null}

        {homework.status === "assigned" || homework.status === "returned" ? (
          <HomeworkSubmitForm onSubmit={submit} />
        ) : null}

        {homework.status === "submitted" || homework.status === "late" ? (
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
