"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { TestListItem } from "@/components/features/student/TestListItem";
import { messageOf } from "@/components/shared/LiveSession";
import {
  fetchAvailableTests,
  fetchStudentMe,
  type StudentTestRow,
} from "@/lib/student/api";

/** Ochiq testlar roʻyxati — BAZADAN (TST-04). */
export default function TestsPage() {
  const [tests, setTests] = useState<StudentTestRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) {
          setTests([]);
          return;
        }
        setTests(await fetchAvailableTests(me.studentId));
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  return (
    <>
      <Header title="Testlar" />
      <div className="flex flex-col gap-2 p-4">
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : tests === null ? (
          <ListSkeleton count={3} />
        ) : tests.length === 0 ? (
          <EmptyState
            title="Hozircha test yoʻq"
            description="Ustoz test eʼlon qilganda shu yerda koʻrinadi."
          />
        ) : (
          tests.map((test) => <TestListItem key={test.id} test={test} />)
        )}
      </div>
    </>
  );
}
