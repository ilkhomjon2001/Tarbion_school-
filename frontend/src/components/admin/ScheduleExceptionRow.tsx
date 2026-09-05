"use client";

/**
 * Bitta paraning istisno amallari (ADM-10).
 *
 * Uch amal bir joyda, chunki ular bitta darsga tegishli va ustoz
 * ularni yonma-yon solishtiradi: bekor qilaymi, ustoz almashtiraymi,
 * yoki boshqa paraga koʻchiraymi.
 *
 * Har amalning oqibati tugma tagida yozilgan — bu amallar davomat va
 * jadvalga taʼsir qiladi va ularni bosgan odam nima boʻlishini
 * oldindan bilishi kerak.
 */

import { useState } from "react";

import { messageOf } from "@/components/shared/LiveSession";
import type { DayLessonOut } from "@/lib/api/types.gen";
import {
  cancelLesson,
  moveLesson,
  restoreLesson,
  substituteTeacher,
} from "@/lib/academic/api";

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export const inputClass =
  "focus-ring h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none";

export const btnClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

export const primaryClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";

type Amal = "cancel" | "substitute" | "move" | null;

export type StaffRow = { user_id: string; full_name: string };

export function ScheduleExceptionRow({
  dars,
  staff,
  onChanged,
}: {
  dars: DayLessonOut;
  staff: StaffRow[];
  onChanged: () => void;
}) {
  const [amal, setAmal] = useState<Amal>(null);
  const [sabab, setSabab] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [period, setPeriod] = useState(String(dars.period));
  const [xona, setXona] = useState(dars.room ?? "");
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function bajar(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setXato(null);
    try {
      await fn();
      setAmal(null);
      setSabab("");
      onChanged();
    } catch (err) {
      setXato(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`rounded-xl border p-3 ${
        dars.is_cancelled
          ? "border-danger/30 bg-danger-tint/40"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {dars.period}-para · {dars.subject_name}
          </p>
          <p className="mt-0.5 text-sm text-foreground-muted">
            {dars.teacher_name}
            {dars.room ? ` · ${dars.room}` : ""}
            {dars.is_substituted && (
              <span className="ml-2 rounded-full bg-warning-tint px-2 py-0.5 text-xs font-medium text-warning">
                almashtirilgan
              </span>
            )}
          </p>
          {dars.is_cancelled && (
            <p className="mt-1 text-sm text-danger">
              Bekor qilingan{dars.cancel_reason ? ` — ${dars.cancel_reason}` : ""}
            </p>
          )}
          {!dars.is_cancelled && dars.exception_note && (
            <p className="mt-1 text-xs text-foreground-muted">{dars.exception_note}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {dars.is_cancelled ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void bajar(() => restoreLesson(dars.lesson_id))}
              className={btnClass}
            >
              Bekor qilishni qaytarish
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAmal(amal === "substitute" ? null : "substitute")}
                aria-expanded={amal === "substitute"}
                className={btnClass}
              >
                Ustozni almashtirish
              </button>
              <button
                type="button"
                onClick={() => setAmal(amal === "move" ? null : "move")}
                aria-expanded={amal === "move"}
                className={btnClass}
              >
                Boshqa paraga
              </button>
              <button
                type="button"
                onClick={() => setAmal(amal === "cancel" ? null : "cancel")}
                aria-expanded={amal === "cancel"}
                className={btnClass}
              >
                Bekor qilish
              </button>
            </>
          )}
        </div>
      </div>

      {xato && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger"
        >
          {xato}
        </p>
      )}

      {amal === "cancel" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="min-w-[16rem] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Bekor qilish sababi
            </span>
            <input
              type="text"
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              placeholder="Masalan: ustoz kasal"
              className={`${inputClass} w-full`}
              autoFocus
            />
          </label>
          <button
            type="button"
            disabled={busy || sabab.trim().length < 3}
            onClick={() => void bajar(() => cancelLesson(dars.lesson_id, sabab.trim()))}
            className={primaryClass}
          >
            {busy ? "Saqlanmoqda…" : "Darsni bekor qilish"}
          </button>
          <p className="w-full text-xs text-foreground-muted">
            Dars oʻchirilmaydi — jadvalda «bekor qilingan» boʻlib qoladi va unga
            davomat ham, baho ham olinmaydi. Sabab oilaga koʻrinadi.
          </p>
        </div>
      )}

      {amal === "substitute" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="min-w-[14rem]">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Yangi ustoz
            </span>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">— tanlang —</option>
              {staff.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Izoh <span className="font-normal text-foreground-muted">(ixtiyoriy)</span>
            </span>
            <input
              type="text"
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              placeholder="Masalan: ustoz malaka oshirishda"
              className={`${inputClass} w-full`}
            />
          </label>
          <button
            type="button"
            disabled={busy || !teacherId}
            onClick={() =>
              void bajar(() =>
                substituteTeacher(dars.lesson_id, teacherId, sabab.trim() || undefined),
              )
            }
            className={primaryClass}
          >
            {busy ? "Saqlanmoqda…" : "Almashtirish"}
          </button>
          <p className="w-full text-xs text-foreground-muted">
            Faqat SHU darsga taʼsir qiladi — dars jadvali oʻzgarmaydi. Yangi ustoz
            shu darsning davomatini oʻzi belgilaydi.
          </p>
        </div>
      )}

      {amal === "move" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Para</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={inputClass}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}-para
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Xona</span>
            <input
              type="text"
              value={xona}
              onChange={(e) => setXona(e.target.value)}
              className={`${inputClass} w-28`}
            />
          </label>
          <button
            type="button"
            disabled={busy || Number(period) === dars.period}
            onClick={() =>
              void bajar(() =>
                moveLesson(dars.lesson_id, Number(period), xona.trim() || null),
              )
            }
            className={primaryClass}
          >
            {busy ? "Saqlanmoqda…" : "Koʻchirish"}
          </button>
          <p className="w-full text-xs text-foreground-muted">
            Dars vaqti qoʻngʻiroqlar jadvalidan qayta hisoblanadi — davomat oynasi
            (24 soat) yangi vaqtdan sanaladi.
          </p>
        </div>
      )}
    </li>
  );
}
