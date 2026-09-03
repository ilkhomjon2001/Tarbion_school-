"use client";

import { useEffect, useState } from "react";

import { StudentDossier } from "@/components/admin/StudentDossier";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { formatSom } from "@/lib/format";
import {
  fetchFinanceStudents,
  fetchFinanceSummary,
  type FinanceSummaryOut,
  type StudentFinanceOut,
} from "@/lib/payments/api";

/**
 * Toʻlovlar (DIR-05) — BAZADAN, faqat oʻqish.
 *
 * Direktor maʼlumot kiritmaydi: jamlanma va qarzdorlar roʻyxatini
 * koʻradi. Kiritish administrator kabinetida (`payments.manage`).
 *
 * Qarzdor qatori BOSILADI va oʻquvchining yigʻma kartochkasini ochadi.
 * Ilgari bu yerda faqat ism va raqam turardi: rahbar «nega qarzdor,
 * bu bola kim?» degan savolga javob topa olmasdi.
 */
export default function DirectorPaymentsPage() {
  const [summary, setSummary] = useState<FinanceSummaryOut | null>(null);
  const [debtors, setDebtors] = useState<StudentFinanceOut[] | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchFinanceSummary(), fetchFinanceStudents(true)])
      .then(([s, d]) => {
        if (!alive) return;
        setSummary(s);
        setDebtors(d);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Toʻlovlar</h1>
        <p className="text-sm text-foreground-muted">
          Jamlanma va qarzdorlar — kiritish administrator kabinetida
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Maʼlumotni olib boʻlmadi.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary === null ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          [
            ["Hisoblangan", formatSom(summary.charged)],
            ["Tushum", formatSom(summary.paid)],
            ["Qarz", formatSom(summary.debt)],
            ["Qarzdorlar", String(summary.debtors)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {label}
              </p>
              <p className="num mt-1 text-xl font-bold text-foreground">{value}</p>
            </div>
          ))
        )}
      </div>

      {/* QAMROV ogohlantirishi.
          Shartnomasi yoʻq oʻquvchiga qarz hisoblanmaydi. Yaʼni hisob
          umuman yuritilmayotgan boʻlsa ham yuqoridagi kartalar
          «Qarz: 0, Qarzdorlar: 0» deb turadi va rahbar buni «hamma
          toʻlagan» deb oʻqiydi. Eng xavfli xato — jimgina notoʻgʻri
          xulosa, shuning uchun buni ochiq aytamiz. */}
      {summary && summary.students_with_contract < summary.students_total && (
        <p className="rounded-lg border border-warning/40 bg-warning-tint px-3 py-2 text-sm text-foreground">
          <strong className="font-semibold">Diqqat:</strong>{" "}
          {summary.students_total} oʻquvchidan{" "}
          <span className="num">{summary.students_with_contract}</span> tasida
          shartnoma bor. Qolganiga qarz <strong>hisoblanmaydi</strong> — yuqoridagi
          «Qarz» va «Qarzdorlar» raqamlari toʻliq manzarani koʻrsatmaydi.
          Shartnomalar administrator kabinetida kiritiladi.
        </p>
      )}

      {/* Tushum QAYSI KANALDAN kelgani (loyiha egasining soʻrovi,
          2026-09-03). Umumiy summa oʻzi kassani bank koʻchirmasi
          bilan solishtirishga yaramaydi: naqd qancha, karta qancha —
          alohida kerak. */}
      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Tushum kanallari</h2>
          {summary && (
            <span className="num text-xs text-foreground-muted">
              Jami: {formatSom(summary.paid)}
            </span>
          )}
        </div>

        {summary === null ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {summary.by_method.map((m) => (
                <div
                  key={m.method}
                  className={`rounded-xl border p-4 ${
                    m.total > 0
                      ? "border-border bg-surface shadow-sm"
                      : "border-dashed border-border bg-surface-muted/40"
                  }`}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    {m.label}
                  </p>
                  <p
                    className={`num mt-1 text-lg font-bold ${
                      m.total > 0 ? "text-foreground" : "text-foreground-muted"
                    }`}
                  >
                    {formatSom(m.total)}
                  </p>
                  {/* Nol ham javob: «bu kanaldan hech narsa kelmadi».
                      Qatorni yashirish esa savol tugʻdirardi. */}
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {m.count > 0
                      ? `${m.count} ta toʻlov`
                      : "Bu kanal orqali toʻlov boʻlmagan"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
              Storno qilingan toʻlov oʻz kanalidan chiqariladi — yigʻindi
              kassadagi haqiqiy summani koʻrsatadi.
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Qarzdorlar</h2>
        {debtors === null ? (
          <TableSkeleton rows={5} />
        ) : debtors.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            Qarzdor yoʻq — barcha hisoblar yopilgan.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="scroll-x">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-3">Oʻquvchi</th>
                    <th className="px-3 py-3">Sinf</th>
                    <th className="px-3 py-3 text-right">Hisoblangan</th>
                    <th className="px-3 py-3 text-right">Toʻlangan</th>
                    <th className="px-3 py-3 text-right">Qarz</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map((r) => (
                    <tr
                      key={r.student_id}
                      onClick={() => setOpenId(r.student_id)}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-brand-dark">
                        {r.student_name}
                        {r.is_archived && (
                          <span className="ml-1.5 text-xs text-foreground-muted">(ketgan)</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">{r.class_name ?? "—"}</td>
                      <td className="num px-3 py-2.5 text-right text-foreground-muted">
                        {formatSom(r.charged)}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-foreground-muted">
                        {formatSom(r.paid)}
                      </td>
                      <td className="num px-3 py-2.5 text-right font-semibold text-danger">
                        {formatSom(-r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {openId && <StudentDossier studentId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
