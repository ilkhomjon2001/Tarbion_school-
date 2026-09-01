"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/Skeleton";
import { messageOf } from "@/components/shared/LiveSession";
import { formatDate } from "@/lib/format";
import { GRADE_KIND_LABELS } from "@/lib/labels";
import { fetchStudentMe, fetchSubjectGrades } from "@/lib/student/api";
import type { GradeEntry } from "@/lib/types";

/** Bitta baho tafsiloti — BAZADAN (fanlar kesimidan topiladi). */
export default function GradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [grade, setGrade] = useState<GradeEntry | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) {
          setGrade(null);
          return;
        }
        const all = await fetchSubjectGrades(me.studentId);
        setGrade(all.flatMap((s) => s.entries).find((g) => g.id === id) ?? null);
      } catch (err) {
        setError(messageOf(err));
        setGrade(null);
      }
    })();
  }, [id]);

  if (grade === undefined) {
    return (
      <>
        <Header title="Baho" backHref="/student/grades" />
        <div className="p-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (grade === null) {
    return (
      <>
        <Header title="Baho" backHref="/student/grades" />
        <div className="p-4">
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : (
            <EmptyState title="Baho topilmadi" />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={grade.subject} backHref="/student/grades" />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-tint text-2xl font-bold text-brand-dark num">
            {grade.value}
          </span>
          <div className="min-w-0">
            <Badge tone="brand">{GRADE_KIND_LABELS[grade.kind]}</Badge>
            {grade.date ? (
              <p className="mt-1 text-sm text-foreground-muted">{formatDate(grade.date)}</p>
            ) : null}
          </div>
        </Card>

        {grade.comment ? (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Ustoz izohi
            </p>
            <p className="mt-1 text-sm text-foreground-muted">{grade.comment}</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
