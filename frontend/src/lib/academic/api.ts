"use client";

/**
 * Oʻquv yili, chorak, taʼtil, qoʻngʻiroq — backend qatlami (T-007).
 *
 * Sanalar bu yerda `YYYY-MM-DD` matn boʻlib qoladi, `Date` ga
 * oʻgirilmaydi: chorak sanasi kalendar kuni, moment emas. `new Date()`
 * ga tashlansa brauzer uni UTC yarim tunga aylantirib, Toshkentda bir
 * kun oldin koʻrsatardi (CLAUDE.md 3-qoida).
 *
 * Vaqt (`08:30:00`) ham mahalliy — bu kun ichidagi jadval.
 *
 * Kirish nazorati bu yerda EMAS: yozish `schedule.manage` huquqini
 * talab qiladi va buni server tekshiradi (CLAUDE.md 7-qoida).
 */

import { useCallback, useEffect, useState } from "react";

import {
  academicAddHoliday,
  academicArchiveHoliday,
  academicBells,
  academicCurrentYear,
  academicHolidays,
  academicSetBells,
  academicSetTerms,
  academicTerms,
  academicYears,
} from "@/lib/api/sdk.gen";
import type {
  AcademicYearOut,
  BellOut,
  HolidayOut,
  TermOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { AcademicYearOut, BellOut, HolidayOut, TermOut };

// ─────────────────────────── Oʻquv yili ───────────────────────────

export async function fetchYears(): Promise<AcademicYearOut[]> {
  return withAuth<AcademicYearOut[]>(() => academicYears());
}

/** Joriy yil belgilanmagan boʻlsa `null` — bu sozlama xatosi, halokat emas. */
export async function fetchCurrentYear(): Promise<AcademicYearOut | null> {
  try {
    return await withAuth<AcademicYearOut>(() => academicCurrentYear());
  } catch {
    return null;
  }
}

// ─────────────────────────── Choraklar ───────────────────────────

export async function fetchTerms(yearId: string): Promise<TermOut[]> {
  return withAuth<TermOut[]>(() => academicTerms({ path: { year_id: yearId } }));
}

export type TermInput = {
  index: number;
  name: string;
  starts_on: string;
  ends_on: string;
};

/**
 * Choraklarni YAXLIT yozadi.
 *
 * Bittalab yuborilmaydi: qoplanishni faqat butun toʻplam ustidan
 * tekshirib boʻladi. Roʻyxatga tushmagan chorak serverda arxivlanadi,
 * oʻchirilmaydi.
 */
export async function saveTerms(
  yearId: string,
  terms: TermInput[],
): Promise<TermOut[]> {
  return withAuth<TermOut[]>(() =>
    academicSetTerms({ path: { year_id: yearId }, body: { terms } }),
  );
}

// ─────────────────────────── Taʼtillar ───────────────────────────

export async function fetchHolidays(yearId: string): Promise<HolidayOut[]> {
  return withAuth<HolidayOut[]>(() =>
    academicHolidays({ path: { year_id: yearId } }),
  );
}

export async function addHoliday(
  yearId: string,
  day: string,
  title: string,
): Promise<HolidayOut> {
  return withAuth<HolidayOut>(() =>
    academicAddHoliday({ path: { year_id: yearId }, body: { day, title } }),
  );
}

/** Roʻyxatdan chiqaradi — oʻchirmaydi (CLAUDE.md 1-qoida). */
export async function archiveHoliday(holidayId: string): Promise<HolidayOut> {
  return withAuth<HolidayOut>(() =>
    academicArchiveHoliday({ path: { holiday_id: holidayId } }),
  );
}

// ─────────────────────── Qoʻngʻiroqlar jadvali ───────────────────────

export async function fetchBells(yearId: string): Promise<BellOut[]> {
  return withAuth<BellOut[]>(() => academicBells({ path: { year_id: yearId } }));
}

export type BellInput = { period: number; starts_at: string; ends_at: string };

/** Qoʻngʻiroqlar jadvalini yaxlit yozadi — choraklardagi sabab bilan bir xil. */
export async function saveBells(
  yearId: string,
  bells: BellInput[],
): Promise<BellOut[]> {
  return withAuth<BellOut[]>(() =>
    academicSetBells({ path: { year_id: yearId }, body: { bells } }),
  );
}

// ─────────────────────────── Hook ───────────────────────────

/** `08:30:00` → `08:30`. Sekundlar jadvalda keraksiz. */
export function shortTime(value: string): string {
  return value.slice(0, 5);
}

export type AcademicCalendar = {
  year: AcademicYearOut | null;
  terms: TermOut[];
  holidays: HolidayOut[];
  bells: BellOut[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Joriy oʻquv yili va unga tegishli hamma narsa.
 *
 * Bitta hook, chunki ekranda ular birga koʻrsatiladi va hammasi bitta
 * `year_id` ga bogʻlangan — alohida hooklar yil almashganda bir-biriga
 * mos kelmay qolardi.
 */
export function useAcademicCalendar(): AcademicCalendar {
  const [year, setYear] = useState<AcademicYearOut | null>(null);
  const [terms, setTerms] = useState<TermOut[]>([]);
  const [holidays, setHolidays] = useState<HolidayOut[]>([]);
  const [bells, setBells] = useState<BellOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchCurrentYear()
      .then(async (joriy) => {
        if (!alive) return;
        setYear(joriy);
        if (joriy === null) {
          setTerms([]);
          setHolidays([]);
          setBells([]);
          return;
        }
        const [t, h, b] = await Promise.all([
          fetchTerms(joriy.id),
          fetchHolidays(joriy.id),
          fetchBells(joriy.id),
        ]);
        if (!alive) return;
        setTerms(t);
        setHolidays(h);
        setBells(b);
      })
      .catch(() => alive && setError("Oʻquv yili maʼlumotini olib boʻlmadi."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [tick]);

  return { year, terms, holidays, bells, loading, error, reload };
}
