"use client";

/**
 * Sinf jurnali (JUR-01, JUR-06).
 *
 * Sinf × fan × sana kesimi: qatorlar — oʻquvchilar, ustunlar — shu
 * oraliqda oʻtilgan darslar.
 *
 * Baho BU YERDAN qoʻyilmaydi. Sabab serverda: baho darsga bogʻlanadi
 * va faqat oʻsha darsning DAV-03 oynasi ochiq boʻlganda qoʻyiladi.
 * Ustoz bahoni davomat ekranidan qoʻyadi — «Davomat → Jurnalni ochish».
 * Bu ekran koʻrish va tahlil uchun.
 *
 * Oʻrtacha ustuni faqat huquqi borga koʻrinadi: serverdan kelgan
 * `shows_average` bayrogʻiga qarab chiziladi. Fan ustoziga — yoʻq
 * (loyiha egasining qoidasi).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BookOpenIcon } from "@/components/ui/icons";
import { useMyTeaching } from "@/lib/teacher/me";
import {
  apiXato,
  fetchClassJournal,
  localToday,
  type ClassJournalOut,
} from "@/lib/teacher/journal-api";

const inputClass =
  "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

/** Sana ustunidagi qisqa yozuv: «12.09». */
function shortDate(iso: string): string {
  const [, oy, kun] = iso.split("-");
  return `${kun}.${oy}`;
}

function daysAgo(n: number): string {
  const d = new Date(`${localToday()}T00:00:00`);
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function JournalPage() {
  const teaching = useMyTeaching();
  const [pick, setPick] = useState(0);
  const [dateFrom, setDateFrom] = useState(() => daysAgo(30));
  const [dateTo, setDateTo] = useState(() => localToday());

  const [data, setData] = useState<ClassJournalOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slot = teaching.slots[pick];

  const load = useCallback(async () => {
    if (slot === undefined) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchClassJournal({
          classId: slot.classId,
          subjectId: slot.subjectId,
          dateFrom,
          dateTo,
        }),
      );
    } catch (err) {
      setError(apiXato(err, "Jurnalni olib boʻlmadi."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slot, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const labels = useMemo(
    () => teaching.slots.map((s) => `${s.className} · ${s.subjectName}`),
    [teaching.slots],
  );

  if (teaching.loading) {
    return (
      <TeacherShell title="Jurnal">
        <ListSkeleton count={5} />
      </TeacherShell>
    );
  }

  if (teaching.slots.length === 0) {
    return (
      <TeacherShell title="Jurnal">
        <EmptyState
          icon={<BookOpenIcon className="h-5 w-5" />}
          title="Dars jadvalingiz boʻsh"
          description="Jurnal siz dars beradigan sinflar boʻyicha chiziladi. Administrator sizga sinf va fan biriktirgach shu yerda paydo boʻladi."
        />
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title="Jurnal"
      subtitle={
        slot ? `${slot.className} · ${slot.subjectName} — haftada ${slot.weeklyHours} soat` : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Sinf va fan
            </span>
            <select
              value={pick}
              onChange={(e) => setPick(Number(e.target.value))}
              className={`${inputClass} min-w-[12rem]`}
            >
              {labels.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Dan</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputClass}
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Gacha</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {error ? (
          <ErrorState description={error} />
        ) : loading || data === null ? (
          <ListSkeleton count={5} />
        ) : data.dates.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon className="h-5 w-5" />}
            title="Bu oraliqda baho yoʻq"
            description="Baho davomat ekranidan qoʻyiladi: darsni oching → davomatni saqlang → «Jurnalni ochish»."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="scroll-x">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="sticky left-0 z-10 bg-surface-muted px-3 py-3">
                      Oʻquvchi
                    </th>
                    {data.dates.map((d) => (
                      <th key={d} className="num px-2 py-3 text-center">
                        {shortDate(d)}
                      </th>
                    ))}
                    {data.shows_average && (
                      <th className="px-3 py-3 text-center">Oʻrtacha</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={row.student_id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-foreground">
                        {row.full_name}
                      </td>
                      {data.dates.map((d) => {
                        const baho = row.grades[d];
                        return (
                          <td key={d} className="px-2 py-2 text-center">
                            {baho === undefined ? (
                              <span className="text-foreground-muted/40">·</span>
                            ) : (
                              <span className="num inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted font-semibold text-foreground">
                                {baho}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {data.shows_average && (
                        <td className="num px-3 py-2 text-center font-semibold text-foreground">
                          {row.average ?? "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
              {data.shows_average
                ? "Oʻrtacha — vaznli hisob: nazorat ishi joriy bahodan ogʻirroq."
                : "Oʻrtacha va chorak bahosi bu yerda koʻrsatilmaydi — ular sinf rahbari va oʻquv boʻlimiga tegishli."}{" "}
              Baho darsdan qoʻyiladi: «Bugungi darslar» → davomatni saqlang → «Jurnalni ochish».
            </p>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
