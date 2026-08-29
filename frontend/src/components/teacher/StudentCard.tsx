"use client";

import { useEffect } from "react";

import {
  RELATION_LABELS,
  studentProfile,
  type StudentProfile,
} from "@/lib/teacher/school-data";
import type { StudentStats } from "@/lib/teacher/store";

/**
 * Oʻquvchi kartochkasi — vasiy maʼlumotlari bilan (ADM-06, ADM-11).
 *
 * FAQAT sinf rahbariga koʻrinadi. Vasiyning telefoni va Telegram holati
 * shaxsiy maʼlumot: oddiy fan ustoziga koʻrsatilmaydi.
 *
 * Sinf rahbari uchun eng koʻp keraladigan amal — bolaning davomati
 * yomonlashganda ota-onasiga qoʻngʻiroq qilish. Shuning uchun telefon
 * raqami bosiladigan (`tel:`) va Telegram ulanmagan vasiy ochiq
 * belgilanadi.
 */
export function StudentCard({
  stats,
  className,
  onClose,
}: {
  stats: StudentStats;
  className: string;
  onClose: () => void;
}) {
  const profile: StudentProfile = studentProfile(
    stats.studentId,
    stats.fullName,
    className,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const atRisk = stats.total > 0 && stats.percent < 80;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="flex-1 bg-foreground/20"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.fullName} — oʻquvchi kartochkasi`}
        className="flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-surface p-4">
          <div className="min-w-0">
            <p className="font-semibold">{profile.fullName}</p>
            <p className="mt-0.5 text-sm text-foreground-muted">
              {profile.className} · {profile.birthDate} · {stats.studentId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="space-y-5 p-4">
          {/* Davomat */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Davomat
            </h3>
            {stats.total === 0 ? (
              <p className="text-sm text-foreground-muted">
                Hali dars oʻtilmagan — statistika yoʻq.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className={`block h-full rounded-full ${atRisk ? "bg-danger" : "bg-success"}`}
                      style={{ width: `${stats.percent}%` }}
                    />
                  </span>
                  <span className={`text-lg font-semibold ${atRisk ? "text-danger" : ""}`}>
                    {stats.percent}%
                  </span>
                </div>
                {atRisk && (
                  <p className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    Davomat 80% dan past. Vasiy bilan bogʻlanish tavsiya etiladi.
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Row label="Keldi" value={stats.present} tone="text-success" />
                  <Row label="Kelmadi" value={stats.absent} tone="text-danger" />
                  <Row label="Sababli" value={stats.excused} tone="text-info" />
                  <Row label="Kechikdi" value={stats.late} tone="text-warning" />
                </dl>
              </>
            )}
          </section>

          {/* Vasiylar — ADM-06 */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Ota-ona / vasiy
            </h3>
            <ul className="space-y-2">
              {profile.guardians.map((g, i) => (
                <li key={i} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{g.fullName}</p>
                      <p className="mt-0.5 text-sm text-foreground-muted">
                        {RELATION_LABELS[g.relation]}
                        {g.workplace ? ` · ${g.workplace}` : ""}
                      </p>
                    </div>
                    {g.isPrimary && (
                      <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                        Asosiy
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${g.phone.replace(/\s/g, "")}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z" />
                      </svg>
                      {g.phone}
                    </a>

                    {g.telegramLinked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2.5 py-1 text-xs font-medium text-success">
                        Telegram ulangan
                      </span>
                    ) : (
                      <span
                        title="Bu vasiyga avtomatik xabar yetib bormaydi"
                        className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2.5 py-1 text-xs font-medium text-warning"
                      >
                        Telegram ulanmagan
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Manzil */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Manzil
            </h3>
            <p className="text-sm">{profile.address}</p>
          </section>

          <p className="rounded-lg bg-surface-muted/60 px-3 py-2 text-xs text-foreground-muted">
            Bu maʼlumot faqat sinf rahbariga koʻrinadi. Fan ustozi oʻquvchining
            shaxsiy va vasiy maʼlumotlarini koʻra olmaydi.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-muted/50 px-3 py-2">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
