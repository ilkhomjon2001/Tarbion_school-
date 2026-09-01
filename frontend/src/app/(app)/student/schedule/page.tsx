"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ScheduleTabs } from "@/components/features/student/ScheduleTabs";
import { messageOf } from "@/components/shared/LiveSession";
import { fetchScheduleForClass, fetchStudentMe } from "@/lib/student/api";
import type { ScheduleEntry } from "@/lib/types";

/** Dars jadvali — BAZADAN (sinf jadvali + qoʻngʻiroqlar vaqti). */
export default function SchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.classId) {
          setEntries([]);
          return;
        }
        setEntries(await fetchScheduleForClass(me.classId));
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  return (
    <>
      <Header title="Dars jadvali" />
      <div className="p-4">
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : entries === null ? (
          <ListSkeleton count={4} />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Jadval hali tuzilmagan"
            description="Sinf jadvali kiritilgach shu yerda koʻrinadi."
          />
        ) : (
          <ScheduleTabs entries={entries} />
        )}
      </div>
    </>
  );
}
