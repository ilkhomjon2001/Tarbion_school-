"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { HomeworkFilterList } from "@/components/features/student/HomeworkFilterList";
import { messageOf } from "@/components/shared/LiveSession";
import { fetchHomeworkList, fetchStudentMe } from "@/lib/student/api";
import type { Homework } from "@/lib/types";

/** Uy vazifalari — BAZADAN (UYV-02). */
export default function HomeworkPage() {
  const [items, setItems] = useState<Homework[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) {
          setItems([]);
          return;
        }
        setItems(await fetchHomeworkList(me.studentId));
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  return (
    <>
      <Header title="Uy vazifasi" />
      <div className="p-4">
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : items === null ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Hozircha vazifa yoʻq"
            description="Ustoz vazifa berganda shu yerda koʻrinadi."
          />
        ) : (
          <HomeworkFilterList items={items} />
        )}
      </div>
    </>
  );
}
