/**
 * Dars rejasini kalendarga bogʻlash (MET-01, MET-02).
 *
 * Savol: "ustoz bugun 7-A da nima oʻtishi kerak?"
 *
 * ── Reja qanday siljiydi ──────────────────────────────────────────────
 *
 *     reja_indeksi = chorak boshidan shu sinf+fan boʻyicha HAQIQATDA
 *                    oʻtilgan darslar soni
 *
 * "Haqiqatda oʻtilgan" = davomat saqlangan. Jadvalda dars turgani yetarli
 * emas.
 *
 * Nega shunday: ustoz kasal boʻldi yoki dars bekor qilindi deylik.
 * Jadval boʻyicha sanasak, reja oldinga siljib ketadi va ustoz oʻtmagan
 * mavzuni "oʻtilgan" deb koʻradi — sinf rejadan orqada qoladi, buni hech
 * kim sezmaydi. Oʻtilgan darslar boʻyicha sanaganda esa reja oʻsha
 * joyida turadi va keyingi darsda oʻsha mavzu qayta chiqadi.
 *
 * Shu sababli `planFor` ga oʻtilgan darslar soni TASHQARIDAN beriladi —
 * bu modul localStorage yoki API bilan bogʻlanmaydi, sof hisob qiladi.
 */

import {
  PLAN_CARDS,
  PLAN_TITLES,
  type PlanCard,
  type PlanLessonTitle,
} from "@/lib/teacher/plan-data";
import { CLASS_PROGRAM_YEAR, LESSONS_PER_TERM, termForDate } from "@/lib/teacher/terms";

/** Reja uchun darsdan faqat shu ikkisi kerak — jadval yozuvi ham, kundalik
 *  dars yozuvi ham mos keladi. */
export interface PlannableLesson {
  date: string;
  className: string;
}

export interface PlanPosition {
  /** Chorak ichidagi tartib raqami (0 dan). */
  index: number;
  /** Koʻrsatish uchun "3/21". */
  human: string;
  title: PlanLessonTitle | null;
  card: PlanCard | null;
  termName: string;
  /** Reja tugab qolgan (chorakdagidan koʻp dars oʻtilgan). */
  overrun: boolean;
}

export function hasPlan(className: string): boolean {
  return className in PLAN_TITLES;
}

export function programYear(className: string): number | null {
  return CLASS_PROGRAM_YEAR[className] ?? null;
}

/**
 * Reja holatini qaytaradi.
 *
 * @param conducted Chorak boshidan shu darsgacha oʻtilgan darslar soni.
 *   `store.conductedCount()` beradi. Berilmasa 0 — ya'ni chorakning
 *   birinchi darsi.
 */
export function planFor(lesson: PlannableLesson, conducted = 0): PlanPosition | null {
  const term = termForDate(lesson.date);
  if (!term) return null;
  if (!hasPlan(lesson.className)) return null;

  const titles = PLAN_TITLES[lesson.className];
  const index = conducted;
  const overrun = index >= titles.length;

  return {
    index,
    human: `${Math.min(index + 1, LESSONS_PER_TERM)}/${titles.length}`,
    title: overrun ? null : titles[index],
    card: PLAN_CARDS[`${lesson.className}|${index}`] ?? null,
    termName: term.name,
    overrun,
  };
}

/** Rejadagi konkret darsni indeks boʻyicha olish. */
export function planAt(className: string, index: number): PlanLessonTitle | null {
  return PLAN_TITLES[className]?.[index] ?? null;
}

/** Chorakning butun reja roʻyxati. */
export function termPlan(className: string): PlanLessonTitle[] {
  return PLAN_TITLES[className] ?? [];
}
