"use client";

/**
 * Oʻquv boʻlimi bosh sahifasi — BAZADAN.
 *
 * Toʻrt karta: yaqin imtihonlar, kutilayotgan rejalar, sinflar
 * davomati, umumiy koʻrsatkichlar. Hammasi jonli maʼlumotdan.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { fetchOverview, type DirectorOverviewOut } from "@/lib/director/api";
import { fetchExams, fetchPlans, type ExamOut, type PlanOut } from "@/lib/exams/api";

export function AcademicDashboard() {
  const [exams, setExams] = useState<ExamOut[] | null>(null);
  const [plans, setPlans] = useState<PlanOut[] | null>(null);
  const [overview, setOverview] = useState<DirectorOverviewOut | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchExams(), fetchPlans(), fetchOverview(30)])
      .then(([x, p, o]) => {
        if (!alive) return;
        setExams(x);
        setPlans(p);
        setOverview(o);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const rejada = (exams ?? []).filter((x) => x.status === "rejada");
  const kutilmoqda = (plans ?? []).filter((p) => p.status === "topshirildi");

  const cards = [
    {
      label: "Rejadagi imtihonlar",
      value: exams === null ? null : rejada.length,
      href: "/oquv-bolim/imtihonlar",
    },
    {
      label: "Koʻrib chiqilishi kerak rejalar",
      value: plans === null ? null : kutilmoqda.length,
      href: "/oquv-bolim/rejalar",
    },
    {
      label: "Davomat (30 kun)",
      value: overview === null ? null : `${overview.attendance_percent}%`,
      href: "/oquv-bolim/sifat",
    },
    {
      label: "Oʻrtacha baho (30 kun)",
      value: overview === null ? null : overview.average_grade,
      href: "/oquv-bolim/natijalar",
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Oʻquv boʻlimi</h1>
        <p className="text-sm text-foreground-muted">
          Imtihonlar, dars rejalari va sifat koʻrsatkichlari bir joyda
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Maʼlumotni olib boʻlmadi. Sahifani yangilab koʻring.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) =>
          c.value === null ? (
            <StatCardSkeleton key={c.label} />
          ) : (
            <Link
              key={c.label}
              href={c.href}
              className="focus-ring rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand/40"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {c.label}
              </p>
              <p className="num mt-1 text-2xl font-bold text-foreground">{c.value}</p>
            </Link>
          ),
        )}
      </div>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Yaqin imtihonlar</h2>
          {exams === null ? (
            <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
          ) : rejada.length === 0 ? (
            <p className="text-sm text-foreground-muted">Rejada imtihon yoʻq.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rejada.slice(0, 5).map((x) => (
                <li
                  key={x.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {x.title} · {x.class_name}
                  </span>
                  <span className="num shrink-0 text-xs text-foreground-muted">{x.exam_date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Koʻrib chiqilmagan rejalar
          </h2>
          {plans === null ? (
            <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
          ) : kutilmoqda.length === 0 ? (
            <p className="text-sm text-foreground-muted">Hammasi koʻrib chiqilgan.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {kutilmoqda.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {p.teacher_name} · {p.subject_name}
                  </span>
                  <span className="shrink-0 text-xs text-foreground-muted">
                    {p.class_name} · {p.period}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
