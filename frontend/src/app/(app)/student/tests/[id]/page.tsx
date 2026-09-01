"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/Skeleton";
import { LiveTestRunner } from "@/components/features/student/LiveTestRunner";
import { messageOf } from "@/components/shared/LiveSession";
import {
  fetchAvailableTests,
  fetchStudentMe,
  type StudentTestRow,
} from "@/lib/student/api";

/** Test sahifasi — BAZADAN. Savollar urinish boshlanganda keladi. */
export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [studentId, setStudentId] = useState("");
  const [test, setTest] = useState<StudentTestRow | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) {
          setTest(null);
          return;
        }
        setStudentId(me.studentId);
        const all = await fetchAvailableTests(me.studentId);
        setTest(all.find((t) => t.id === id) ?? null);
      } catch (err) {
        setError(messageOf(err));
        setTest(null);
      }
    })();
  }, [id]);

  if (test === undefined) {
    return (
      <>
        <Header title="Test" backHref="/student/tests" />
        <div className="p-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (test === null) {
    return (
      <>
        <Header title="Test" backHref="/student/tests" />
        <div className="p-4">
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : (
            <EmptyState title="Test topilmadi yoki yopilgan" />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={test.title} backHref="/student/tests" />
      <div className="p-4">
        <LiveTestRunner test={test} studentId={studentId} />
      </div>
    </>
  );
}
