"use client";

/**
 * Kunlik davomat (T-015, DAV-02).
 *
 * TZ: «Sinf rahbari kunlik davomatni bitta ekranda, butun sinf boʻyicha
 * belgilay oladi.»
 *
 * Qatorlar — oʻquvchilar, ustunlar — paralar. Ilgari ustoz har bir
 * darsni alohida ochib chiqardi: 8 para = 8 ta sahifa, 8 marta kutish.
 *
 * Uchta qaror ish tezligini belgilaydi:
 *
 *   1. **Sukut boʻyicha hamma "Keldi"** emas — boʻsh. Avtomatik
 *      "keldi" qoʻyilsa, ustoz eʼtibor bermay saqlab yuborardi va
 *      jurnalda hech qachon boʻlmagan davomat paydo boʻlardi.
 *      Buning oʻrniga «Hammasi keldi» tugmasi bor — bu ONGLI amal.
 *   2. **Katak bosilganda holat aylanadi**: boʻsh → kelmadi → sababli
 *      → kechikdi → keldi → boʻsh. Kelmaganlar birinchi, chunki ustoz
 *      aynan ularni qidiradi.
 *   3. **Faqat oʻzgargan kataklar yuboriladi.** 25 × 8 = 200 ta katakni
 *      har safar uzatish tarmoqni va bazani behuda band qilardi.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ATTENDANCE_LABELS, type AttendanceStatus } from "@/lib/contracts";
import { apiXato } from "@/lib/school/api";
import { useMyTeaching } from "@/lib/teacher/me";
import {
  fetchClassDay,
  saveClassDay,
  type ClassDayOut,
  type DayEntry,
} from "@/lib/teacher/day-api";

/** Katak bosilganda shu tartibda aylanadi. Kelmaganlar birinchi. */
const CYCLE: (AttendanceStatus | null)[] = [null, "absent", "excused", "late", "present"];

const CELL_STYLE: Record<string, string> = {
  present: "bg-success-tint text-success",
  absent: "bg-danger-tint text-danger font-semibold",
  excused: "bg-warning-tint text-warning",
  late: "bg-warning-tint text-warning",
};

/** Katakdagi qisqa belgi. Rang yolgʻiz maʼno tashimaydi. */
const CELL_MARK: Record<string, string> = {
  present: "+",
  absent: "N",
  excused: "S",
  late: "K",
};

function isoKun(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function kunYorlig(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("uz-UZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function surish(iso: string, kun: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + kun);
  return isoKun(t);
}

type Kalit = string; // `${student_id}:${lesson_id}`

export default function TeacherDayPage() {
  const { classes, loading: sinflarYuklanmoqda } = useMyTeaching();
  const [classId, setClassId] = useState<string>("");
  const [kun, setKun] = useState<string>(() => isoKun(new Date()));

  const [data, setData] = useState<ClassDayOut | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  //: Faqat OʻZGARGAN kataklar. Boshlangʻich holat `data.marks` da.
  const [ozgarish, setOzgarish] = useState<Map<Kalit, AttendanceStatus>>(new Map());
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [xabar, setXabar] = useState<string | null>(null);

  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const yukla = useCallback(async () => {
    if (!classId) return;
    setYuklanmoqda(true);
    setXato(null);
    setOzgarish(new Map());
    setXabar(null);
    try {
      setData(await fetchClassDay(classId, kun));
    } catch (err) {
      setXato(apiXato(err, "Kunlik davomatni yuklab boʻlmadi."));
      setData(null);
    } finally {
      setYuklanmoqda(false);
    }
  }, [classId, kun]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  /** Boshlangʻich + oʻzgargan holat. */
  const holat = useMemo(() => {
    const m = new Map<Kalit, AttendanceStatus>();
    for (const mark of data?.marks ?? []) {
      m.set(`${mark.student_id}:${mark.lesson_id}`, mark.status as AttendanceStatus);
    }
    for (const [k, v] of ozgarish) m.set(k, v);
    return m;
  }, [data, ozgarish]);

  function keyingiHolat(hozir: AttendanceStatus | undefined): AttendanceStatus | null {
    const i = CYCLE.indexOf(hozir ?? null);
    return CYCLE[(i + 1) % CYCLE.length];
  }

  function bos(studentId: string, lessonId: string, editable: boolean) {
    if (!editable) return;
    const k = `${studentId}:${lessonId}`;
    const keyingi = keyingiHolat(holat.get(k));
    setOzgarish((prev) => {
      const yangi = new Map(prev);
      if (keyingi === null) {
        // Boʻsh holatni yuborib boʻlmaydi — belgini olib tashlash
        // uchun alohida amal kerak, hozircha «keldi» ga qaytadi.
        yangi.set(k, "present");
      } else {
        yangi.set(k, keyingi);
      }
      return yangi;
    });
    setXabar(null);
  }

  function hammasiKeldi(lessonId: string) {
    setOzgarish((prev) => {
      const yangi = new Map(prev);
      for (const s of data?.students ?? []) {
        yangi.set(`${s.student_id}:${lessonId}`, "present");
      }
      return yangi;
    });
    setXabar(null);
  }

  async function saqla() {
    if (!data || ozgarish.size === 0) return;
    setSaqlanmoqda(true);
    setXato(null);
    try {
      // Faqat tegilgan darslar, va ularning faqat oʻzgargan qatorlari.
      const boyicha = new Map<string, DayEntry["rows"]>();
      for (const [k, status] of ozgarish) {
        const [studentId, lessonId] = k.split(":");
        const dars = data.lessons.find((l) => l.lesson_id === lessonId);
        if (!dars?.editable) continue;
        const ro = boyicha.get(lessonId) ?? [];
        ro.push({ student_id: studentId, status });
        boyicha.set(lessonId, ro);
      }
      const entries: DayEntry[] = [...boyicha].map(([lesson_id, rows]) => ({
        lesson_id,
        rows,
      }));
      if (entries.length === 0) {
        setXato("Tahrirlash mumkin boʻlgan oʻzgarish yoʻq.");
        return;
      }
      const n = await saveClassDay(classId, kun, entries);
      setXabar(`Saqlandi: ${n.created} yangi, ${n.updated} yangilandi.`);
      await yukla();
    } catch (err) {
      setXato(apiXato(err, "Saqlab boʻlmadi."));
    } finally {
      setSaqlanmoqda(false);
    }
  }

  const kelmaganlar = useMemo(() => {
    let n = 0;
    for (const v of holat.values()) if (v === "absent") n += 1;
    return n;
  }, [holat]);

  return (
    <TeacherShell
      title="Kunlik davomat"
      subtitle="Butun sinf, butun kun — bitta ekranda. Katakni bosing: kelmadi → sababli → kechikdi → keldi."
    >
      <div className="flex flex-col gap-4">
        {/* ── Sinf va sana ── */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground-muted">Sinf</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={sinflarYuklanmoqda || classes.length === 0}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-1">
            <button
              type="button"
              onClick={() => setKun((k) => surish(k, -1))}
              aria-label="Oldingi kun"
              className="focus-ring h-10 w-10 rounded-lg border border-border text-foreground hover:bg-surface-muted"
            >
              ‹
            </button>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground-muted">Sana</span>
              <input
                type="date"
                value={kun}
                onChange={(e) => setKun(e.target.value)}
                className="num h-10 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
              />
            </label>
            <button
              type="button"
              onClick={() => setKun((k) => surish(k, 1))}
              aria-label="Keyingi kun"
              className="focus-ring h-10 w-10 rounded-lg border border-border text-foreground hover:bg-surface-muted"
            >
              ›
            </button>
          </div>

          <button
            type="button"
            onClick={() => setKun(isoKun(new Date()))}
            className="focus-ring h-10 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-surface-muted"
          >
            Bugun
          </button>
        </div>

        <p className="text-sm text-foreground-muted">{kunYorlig(kun)}</p>

        {xato && (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {xato}
          </p>
        )}
        {xabar && (
          <p className="rounded-lg bg-success-tint px-3 py-2 text-sm text-success">{xabar}</p>
        )}

        {yuklanmoqda && <ListSkeleton count={4} />}

        {!yuklanmoqda && data && data.lessons.length === 0 && (
          <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-foreground-muted">
            Bu kunda dars yoʻq.
          </p>
        )}

        {!yuklanmoqda && data && data.lessons.length > 0 && (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="scroll-x">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/60">
                      <th className="sticky left-0 z-10 bg-surface-muted px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                        Oʻquvchi
                      </th>
                      {data.lessons.map((l) => (
                        <th key={l.lesson_id} className="px-1 py-2 text-center align-bottom">
                          <span className="num block text-xs font-semibold text-foreground">
                            {l.period}
                          </span>
                          <span className="block max-w-[72px] truncate text-[11px] text-foreground-muted">
                            {l.subject_name}
                          </span>
                          <span className="block max-w-[72px] truncate text-[11px] text-foreground-muted">
                            {l.teacher_name}
                          </span>
                          {l.editable ? (
                            <button
                              type="button"
                              onClick={() => hammasiKeldi(l.lesson_id)}
                              className="focus-ring mt-1 rounded px-1 py-0.5 text-[11px] text-brand-dark hover:bg-surface-muted"
                            >
                              hammasi +
                            </button>
                          ) : (
                            <span
                              title="Tahrirlash muddati tugagan (DAV-03)"
                              className="mt-1 block text-[11px] text-foreground-muted"
                            >
                              yopiq
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.student_id} className="border-b border-border last:border-0">
                        <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 font-medium text-foreground">
                          {s.full_name}
                        </td>
                        {data.lessons.map((l) => {
                          const v = holat.get(`${s.student_id}:${l.lesson_id}`);
                          return (
                            <td key={l.lesson_id} className="p-0.5 text-center">
                              <button
                                type="button"
                                disabled={!l.editable}
                                onClick={() => bos(s.student_id, l.lesson_id, l.editable)}
                                aria-label={`${s.full_name} · ${l.period}-dars · ${
                                  v ? ATTENDANCE_LABELS[v] : "belgilanmagan"
                                }`}
                                className={`focus-ring h-9 w-9 rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                  v ? CELL_STYLE[v] : "bg-surface-muted text-foreground-muted"
                                } ${l.editable ? "hover:ring-2 hover:ring-brand/30" : ""}`}
                              >
                                {v ? CELL_MARK[v] : "·"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Belgilar izohi — rang yolgʻiz maʼno tashimaydi. */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
              {(["absent", "excused", "late", "present"] as AttendanceStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded ${CELL_STYLE[s]}`}
                  >
                    {CELL_MARK[s]}
                  </span>
                  {ATTENDANCE_LABELS[s]}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saqlanmoqda || ozgarish.size === 0}
                onClick={() => void saqla()}
                className="focus-ring h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
              >
                {saqlanmoqda
                  ? "Saqlanmoqda…"
                  : `Saqlash${ozgarish.size ? ` (${ozgarish.size})` : ""}`}
              </button>
              {kelmaganlar > 0 && (
                <span className="text-sm text-danger">
                  Kelmaganlar: <span className="num font-semibold">{kelmaganlar}</span>
                </span>
              )}
              {ozgarish.size > 0 && (
                <span className="text-sm text-foreground-muted">
                  Saqlanmagan oʻzgarish bor
                </span>
              )}
            </div>
          </>
        )}

        {!yuklanmoqda && !data && !xato && classes.length === 0 && (
          <ErrorState
            title="Sinf topilmadi"
            description="Sizga hali sinf biriktirilmagan. Maktab administratoriga murojaat qiling."
          />
        )}
      </div>
    </TeacherShell>
  );
}
