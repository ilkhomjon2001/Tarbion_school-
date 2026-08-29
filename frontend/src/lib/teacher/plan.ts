/**
 * Dars rejasini kalendarga bogʻlash (MET-01, MET-02).
 *
 * Savol: "ustoz bugun 7-A da nima oʻtishi kerak?"
 *
 * Javob ketma-ketlik boʻyicha hisoblanadi:
 *   1. Bugungi sana qaysi chorakka tushadi
 *   2. Chorak boshidan bugungi darsgacha shu sinf+fan boʻyicha nechta
 *      dars oʻtilgan — shu son reja indeksi
 *   3. Reja daraxtidan oʻsha indeksdagi dars olinadi
 *
 * Sanaga emas, ketma-ketlikka bogʻlangani uchun dars bekor boʻlsa reja
 * siljib ketmaydi — keyingi dars toʻxtagan joyidan davom etadi.
 */

import { PLAN_CARDS, PLAN_TITLES, type PlanCard, type PlanLessonTitle } from "@/lib/teacher/plan-data";
import { buildLessons, type ScheduleLesson } from "@/lib/teacher/schedule";
import { CLASS_PROGRAM_YEAR, LESSONS_PER_TERM, termForDate } from "@/lib/teacher/terms";

export interface PlanPosition {
  /** Chorak ichidagi tartib raqami (0 dan). */
  index: number;
  /** Nechanchi dars / jami (1 dan — koʻrsatish uchun). */
  human: string;
  title: PlanLessonTitle | null;
  card: PlanCard | null;
  termName: string;
  /** Reja tugab qolgan boʻlsa (chorakdagidan koʻp dars oʻtilgan). */
  overrun: boolean;
}

/** Shu sinf uchun reja bazasi bormi. */
export function hasPlan(className: string): boolean {
  return className in PLAN_TITLES;
}

/** Sinfning dastur yili (7-sinf 1-yilda ham, 2-yilda ham boʻlishi mumkin). */
export function programYear(className: string): number | null {
  return CLASS_PROGRAM_YEAR[className] ?? null;
}

/**
 * Chorak boshidan berilgan sanagacha (shu sana ham kiradi) shu sinf+fan
 * boʻyicha nechanchi dars ekanini hisoblaydi.
 */
export function planIndexFor(lesson: ScheduleLesson): number | null {
  const term = termForDate(lesson.date);
  if (!term) return null;

  const from = new Date(`${term.startsOn}T00:00:00`);
  const to = new Date(`${lesson.date}T00:00:00`);

  const sameCourse = buildLessons(from, to).filter(
    (l) => l.className === lesson.className && l.subject === lesson.subject,
  );

  // Shu darsning oʻzi roʻyxatning nechanchisi — 0 dan sanaladi.
  const at = sameCourse.findIndex((l) => l.id === lesson.id);
  return at === -1 ? sameCourse.length : at;
}

export function planFor(lesson: ScheduleLesson): PlanPosition | null {
  const term = termForDate(lesson.date);
  if (!term) return null;
  if (!hasPlan(lesson.className)) return null;

  const index = planIndexFor(lesson);
  if (index === null) return null;

  const titles = PLAN_TITLES[lesson.className];
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

/** Chorakning butun reja roʻyxati — reja sahifasi uchun. */
export function termPlan(className: string): PlanLessonTitle[] {
  return PLAN_TITLES[className] ?? [];
}

/**
 * Bugungi sanada shu sinf+fan boʻyicha allaqachon nechta dars oʻtilgani —
 * reja sahifasida "shu yergacha oʻtilgan" chizigʻini chizish uchun.
 */
export function completedCount(className: string, subject: string, today: string): number {
  const term = termForDate(today);
  if (!term) return 0;
  const from = new Date(`${term.startsOn}T00:00:00`);
  const to = new Date(`${today}T00:00:00`);
  return buildLessons(from, to).filter(
    (l) => l.className === className && l.subject === subject && l.date < today,
  ).length;
}
