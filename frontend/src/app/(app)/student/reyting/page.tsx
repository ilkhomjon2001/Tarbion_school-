"use client";

/**
 * Sinf reytingi (REY-01) — BAZADAN.
 *
 * X-6: server faqat OʻZ oʻrni va koʻrsatkichlarini beradi — sinfdoshlar
 * roʻyxati yoki ularning baholari bu sahifaga hech qachon kelmaydi.
 * Formula: vaznli, 5 ballik shkalaga keltirilgan oʻrtacha baho
 * (jurnal bilan bir xil), keyin davomat foizi.
 */

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Header } from "@/components/ui/Header";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import {
  fetchRating,
  fetchStudentMe,
  type StudentRating,
} from "@/lib/student/api";

export default function RankingPage() {
  const [rating, setRating] = useState<StudentRating | null>(null);
  const [holat, setHolat] = useState<"yuklanmoqda" | "tayyor" | "xato">("yuklanmoqda");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) throw new Error("student yoʻq");
        const r = await fetchRating(me.studentId);
        if (!alive) return;
        setRating(r);
        setHolat("tayyor");
      } catch {
        if (alive) setHolat("xato");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Header title="Sinf reytingi" />
      <div className="flex flex-col gap-4 p-4">
        {holat === "yuklanmoqda" && (
          <div className="grid grid-cols-2 gap-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        )}

        {holat === "xato" && (
          <ErrorState description="Reytingni olib boʻlmadi. Sahifani yangilab koʻring." />
        )}

        {holat === "tayyor" && rating && rating.rank === null && (
          <EmptyState
            title="Hali baho yoʻq"
            description="Reyting birinchi baholar qoʻyilgach hisoblanadi."
          />
        )}

        {holat === "tayyor" && rating && rating.rank !== null && (
          <>
            <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Sinfdagi oʻrningiz
              </p>
              <p className="num mt-2 text-5xl font-bold text-brand-dark">
                {rating.rank}
                <span className="text-2xl text-foreground-muted">
                  {" "}
                  / {rating.totalStudents}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Oʻrtacha baho
                </p>
                <p className="num mt-1 text-2xl font-bold text-foreground">
                  {rating.average?.toFixed(2) ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Davomat
                </p>
                <p className="num mt-1 text-2xl font-bold text-foreground">
                  {rating.attendancePercent}%
                </p>
              </div>
            </div>

            <p className="text-xs text-foreground-muted">
              Reyting vaznli oʻrtacha baho asosida hisoblanadi; sinfdoshlar
              natijalari koʻrsatilmaydi.
            </p>
          </>
        )}
      </div>
    </>
  );
}
