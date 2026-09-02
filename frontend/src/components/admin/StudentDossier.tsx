"use client";

/**
 * Oʻquvchining yigʻma kartochkasi — administrator va rahbariyat uchun.
 *
 * Rahbar qarzdorlar roʻyxatida bir ismni koʻrardi va «bu bola kim?»
 * degan savolga javob topa olmasdi. Kartochka shu savolga javob
 * beradi: nega kelmayapti, tarbiyaviy va psixologik holati, oila bilan
 * qanday suhbatlar boʻlgan, toʻlov ahvoli.
 *
 * Bloklar tartibi ataylab: avval ODAM (kim, kim bilan yashaydi), keyin
 * SABAB (nega kelmadi, qanday holatda), oxirida PUL. Rahbar qarzdorlar
 * roʻyxatidan kirsa ham, birinchi koʻradigani raqam emas — bola.
 *
 * Bu yerda maʼlumot TAHRIRLANMAYDI. Har blokning oʻz boʻlimi bor va
 * yozish oʻsha yerda: dublikat forma ikki xil qoidaga ega boʻlib
 * qolardi.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { XIcon } from "@/components/ui/icons";
import { ATTENDANCE_LABELS, CONTACT_KIND_LABELS } from "@/lib/contracts";
import type { AttendanceStatus, ContactKind } from "@/lib/contracts";
import { formatSom } from "@/lib/format";
import { apiXato, fetchStudentDossier, type StudentDossierOut } from "@/lib/school/api";
import { KIND_LABELS, TONE_LABELS } from "@/lib/wellbeing/api";

const RELATION_LABELS: Record<string, string> = {
  father: "Otasi",
  mother: "Onasi",
  guardian: "Vasiy",
};

const MONTH_NAMES = [
  "",
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

/** Qaysi holat eʼtiborni talab qiladi — nishonchaning rangi shundan. */
const TONE_BADGE: Record<string, "success" | "neutral" | "warning"> = {
  positive: "success",
  neutral: "neutral",
  attention: "warning",
};

function sana(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Section({ title, hint, children }: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground-muted">{children}</p>;
}

export function StudentDossier({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [d, setD] = useState<StudentDossierOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setD(await fetchStudentDossier(studentId));
    } catch (err) {
      // Ruxsat yoʻq boʻlsa `403` keladi, `404` emas (X-3) — «topilmadi»
      // deb koʻrsatish yolgʻon boʻlardi.
      setError(apiXato(err, "Kartochkani ochib boʻlmadi."));
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  // Escape bilan yopilsin — panel klaviatura bilan ham boshqarilsin.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const counts = d?.attendance_counts ?? {};
  const qarz = d ? -d.finance.balance : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Oʻquvchi kartochkasi"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-surface-muted shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border bg-surface p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {d?.full_name ?? "Yuklanmoqda…"}
            </h2>
            {d && (
              <p className="mt-0.5 text-sm text-foreground-muted">
                {d.class_name ?? "sinfsiz"}
                {d.birth_date && ` · ${sana(d.birth_date)}`}
                {d.is_archived && (
                  <span className="ml-2">
                    <Badge tone="neutral">Arxivlangan</Badge>
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-foreground-muted hover:bg-surface-muted"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-3">
          {loading && <ListSkeleton count={5} />}
          {error && !loading && (
            <div className="flex flex-col gap-2">
              <ErrorState title="Kartochka ochilmadi" description={error} />
              <button
                type="button"
                onClick={() => void yukla()}
                className="focus-ring self-center rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
              >
                Qayta urinish
              </button>
            </div>
          )}

          {d && !loading && !error && (
            <>
              <Section title="Oila" hint="Telefon faqat shu kartochkada (X-6)">
                {d.guardians.length === 0 ? (
                  <Empty>Vasiy biriktirilmagan.</Empty>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {d.guardians.map((g) => (
                      <li key={g.user_id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-foreground">{g.full_name}</span>
                        <span className="text-xs text-foreground-muted">
                          {RELATION_LABELS[g.relation] ?? g.relation}
                        </span>
                        {g.phone && (
                          <a
                            href={`tel:${g.phone}`}
                            className="focus-ring num ml-auto rounded text-sm text-brand-dark hover:underline"
                          >
                            {g.phone}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Davomat"
                hint={d.year_name ? `${d.year_name} oʻquv yili` : "Oʻquv yili belgilanmagan"}
              >
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {(["present", "absent", "excused", "late"] as AttendanceStatus[]).map((s) => (
                    <span key={s} className="text-foreground-muted">
                      {ATTENDANCE_LABELS[s]}:{" "}
                      <span className="num font-semibold text-foreground">{counts[s] ?? 0}</span>
                    </span>
                  ))}
                </div>
                {d.absences.length === 0 ? (
                  <Empty>Qoldirilgan dars yoʻq.</Empty>
                ) : (
                  <ul className="flex flex-col gap-1.5 border-t border-border pt-2">
                    {d.absences.map((a, i) => (
                      <li key={`${a.lesson_date}-${a.period}-${i}`} className="text-sm">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="num text-xs text-foreground-muted">
                            {sana(a.lesson_date)} · {a.period}-dars
                          </span>
                          <span className="text-foreground">{a.subject_name}</span>
                          <Badge tone={a.status === "excused" ? "neutral" : "warning"}>
                            {ATTENDANCE_LABELS[a.status as AttendanceStatus] ?? a.status}
                          </Badge>
                        </div>
                        {/* Sabab — rahbar aynan shuni qidiradi. */}
                        {a.note && <p className="mt-0.5 text-foreground-muted">{a.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Tarbiya va psixologik holat"
                hint="Oʻquvchining oʻzi bu yozuvlarni koʻrmaydi"
              >
                {d.wellbeing.length === 0 ? (
                  <Empty>Yozuv yoʻq.</Empty>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.wellbeing.map((n) => (
                      <li key={n.id} className="text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={TONE_BADGE[n.tone] ?? "neutral"}>
                            {TONE_LABELS[n.tone] ?? n.tone}
                          </Badge>
                          <span className="text-xs text-foreground-muted">
                            {KIND_LABELS[n.kind] ?? n.kind} · {n.author_name}
                            {n.subject_name && ` · ${n.subject_name}`} · {sana(n.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-foreground">{n.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Oila bilan suhbatlar" hint="Ichki qaydlar — vasiy koʻrmaydi">
                {d.conversations.length === 0 ? (
                  <Empty>Qayd yoʻq.</Empty>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.conversations.map((c) => (
                      <li key={c.id} className="text-sm">
                        <span className="text-xs text-foreground-muted">
                          {CONTACT_KIND_LABELS[c.kind as ContactKind] ?? c.kind} ·{" "}
                          {c.author_name} · {sana(c.created_at)}
                        </span>
                        <p className="mt-0.5 text-foreground">{c.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Toʻlov" hint="Obyektiv yozuv — baholovchi izoh yoʻq">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-foreground-muted">Oylik</dt>
                  <dd className="num text-right text-foreground">
                    {d.finance.monthly_fee === null
                      ? "shartnoma yoʻq"
                      : formatSom(d.finance.monthly_fee)}
                  </dd>
                  <dt className="text-foreground-muted">Hisoblangan</dt>
                  <dd className="num text-right text-foreground">
                    {formatSom(d.finance.charged)}
                  </dd>
                  <dt className="text-foreground-muted">Toʻlangan</dt>
                  <dd className="num text-right text-foreground">{formatSom(d.finance.paid)}</dd>
                  <dt className="font-medium text-foreground">
                    {qarz > 0 ? "Qarz" : "Balans"}
                  </dt>
                  <dd
                    className={`num text-right font-semibold ${
                      qarz > 0 ? "text-danger" : "text-foreground"
                    }`}
                  >
                    {formatSom(qarz > 0 ? qarz : d.finance.balance)}
                  </dd>
                </dl>
                {d.finance.months.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                    {d.finance.months.map((m) => (
                      <li
                        key={`${m.year}-${m.month}`}
                        title={`${MONTH_NAMES[m.month]} ${m.year} — ${formatSom(m.covered)} / ${formatSom(m.amount)}`}
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          m.status === "tolangan"
                            ? "bg-success-tint text-success"
                            : m.overdue
                              ? "bg-danger-tint text-danger"
                              : "bg-surface-muted text-foreground-muted"
                        }`}
                      >
                        {MONTH_NAMES[m.month].slice(0, 3)}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
