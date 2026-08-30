"use client";

/**
 * Demo uchun brauzer xotirasidagi saqlash.
 *
 * Backend ulanmagunicha davomat, mavzu va baholar `localStorage` da
 * saqlanadi. Funksiya imzolari kelajakdagi API bilan bir xil, shuning
 * uchun almashtirish oson boʻladi.
 */

import {
  buildInitialRows,
  buildSubmissions,
  CLOSED_LESSON_ROWS,
  DEMO_HOMEWORK,
  DEMO_LESSONS,
  findHomework,
  findLesson,
} from "@/lib/teacher/data";
import type {
  AttendanceRow,
  AttendanceStatus,
  HomeworkItem,
  SubmissionRow,
  TeacherLesson,
} from "@/lib/teacher/types";

const KEY_ATTENDANCE = "tarbion.demo.attendance";
const KEY_SUBMISSIONS = "tarbion.demo.submissions";
const KEY_CONDUCTED = "tarbion.demo.conducted";
const KEY_GRADES = "tarbion.demo.grades";
const KEY_TESTS = "tarbion.demo.tests";
const KEY_ANNOUNCEMENTS = "tarbion.demo.announcements";

/**
 * Oʻtkazilgan dars yozuvi.
 *
 * Bu jurnalning asosi: dars faqat davomat saqlangandan keyin "oʻtilgan"
 * hisoblanadi. Reja ham shu yozuvlar boʻyicha siljiydi — jadval boʻyicha
 * emas.
 */
export interface ConductedLesson {
  lessonId: string;
  date: string;
  period: number;
  className: string;
  subject: string;
  /** Oʻtilgan mavzu — davomat bilan birga saqlanadi. */
  topic: string;
  /** Rejadagi nechanchi dars (0 dan). */
  planIndex: number | null;
  savedAt: string;
  present: number;
  absent: number;
  excused: number;
  late: number;
  total: number;
}

function read<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}

function write<T>(key: string, value: Record<string, T>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* xotira toʻlgan yoki bloklangan — demo toʻxtamasin */
  }
}

function delay<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ---------- Oʻtkazilgan darslar ----------

export function getConducted(): Record<string, ConductedLesson> {
  return read<ConductedLesson>(KEY_CONDUCTED);
}

/**
 * Shu sinf+fan boʻyicha berilgan sanagacha HAQIQATDA oʻtilgan darslar soni.
 *
 * Reja indeksining manbai shu. Dars bekor boʻlsa (davomat belgilanmagan)
 * hisobga olinmaydi va reja siljimaydi — keyingi darsda oʻsha mavzu
 * qayta chiqadi.
 */
export function conductedCount(
  className: string,
  subject: string,
  beforeDate: string,
): number {
  return Object.values(getConducted()).filter(
    (c) => c.className === className && c.subject === subject && c.date < beforeDate,
  ).length;
}

/** Jurnal uchun: sinf+fan boʻyicha barcha oʻtilgan darslar, sana boʻyicha. */
export function journalFor(className: string, subject: string): ConductedLesson[] {
  return Object.values(getConducted())
    .filter((c) => c.className === className && c.subject === subject)
    .sort((a, b) => (a.date === b.date ? a.period - b.period : a.date < b.date ? -1 : 1));
}

/** Sinfning barcha oʻtilgan darslari (fandan qatʼi nazar). */
export function conductedForClass(className: string): ConductedLesson[] {
  return Object.values(getConducted())
    .filter((c) => c.className === className)
    .sort((a, b) => (a.date === b.date ? a.period - b.period : a.date < b.date ? -1 : 1));
}

/**
 * Bitta kunning davomat holati: oʻquvchi id → holat.
 *
 * Baho qoʻyishda kerak — darsda boʻlmagan oʻquvchiga baho qoʻyilmaydi.
 * Davomat lessonId boʻyicha saqlangani uchun avval oʻsha kunning
 * shu sinf+fan darsi topiladi, keyin uning qatorlari olinadi.
 *
 * Boʻsh natija "davomat hali belgilanmagan" degani — bunda baho
 * qoʻyish toʻsilmaydi.
 */
export function attendanceOn(
  className: string,
  subject: string,
  date: string,
): Record<string, AttendanceStatus> {
  const rows = read<AttendanceRow[]>(KEY_ATTENDANCE);
  const out: Record<string, AttendanceStatus> = {};
  for (const c of Object.values(getConducted())) {
    if (c.className !== className || c.subject !== subject || c.date !== date) continue;
    for (const r of rows[c.lessonId] ?? []) out[r.studentId] = r.status;
  }
  return out;
}

export interface StudentStats {
  studentId: string;
  fullName: string;
  present: number;
  absent: number;
  excused: number;
  late: number;
  total: number;
  /** Qatnashish foizi (keldi + kechikdi hisobga olinadi). */
  percent: number;
}

/**
 * Har bir oʻquvchining davomat statistikasi (DAV-06).
 *
 * "Kechikdi" ham qatnashgan hisoblanadi — oʻquvchi darsda boʻlgan.
 * Sababli qoldirish qatnashmagan, lekin sababi bor: foizga kirmaydi,
 * alohida ustunda koʻrsatiladi.
 */
export function studentStats(className: string): StudentStats[] {
  const lessons = conductedForClass(className);
  const rows = read<AttendanceRow[]>(KEY_ATTENDANCE);
  const byStudent = new Map<string, StudentStats>();

  for (const lesson of lessons) {
    for (const row of rows[lesson.lessonId] ?? []) {
      let s = byStudent.get(row.studentId);
      if (!s) {
        s = {
          studentId: row.studentId,
          fullName: row.fullName,
          present: 0,
          absent: 0,
          excused: 0,
          late: 0,
          total: 0,
          percent: 100,
        };
        byStudent.set(row.studentId, s);
      }
      s[row.status] += 1;
      s.total += 1;
    }
  }

  const out = [...byStudent.values()];
  for (const s of out) {
    s.percent = s.total ? Math.round(((s.present + s.late) / s.total) * 100) : 100;
  }
  return out.sort((a, b) => a.fullName.localeCompare(b.fullName, "uz"));
}

// ---------- Darslar ----------

export async function getTodayLessons(): Promise<TeacherLesson[]> {
  const saved = read<AttendanceRow[]>(KEY_ATTENDANCE);
  return delay(
    DEMO_LESSONS.map((lesson) => {
      const rows = saved[lesson.id];
      if (!rows) return lesson;
      return {
        ...lesson,
        presentCount: rows.filter((r) => r.status === "present").length,
      };
    }),
  );
}

// ---------- Davomat ----------

export async function getAttendance(
  lessonId: string,
): Promise<{ lesson: TeacherLesson; rows: AttendanceRow[]; topic: string } | null> {
  const lesson = findLesson(lessonId);
  if (!lesson) return delay(null);

  const saved = read<AttendanceRow[]>(KEY_ATTENDANCE)[lessonId];
  const conducted = getConducted()[lessonId];

  if (saved) {
    return delay({ lesson, rows: saved, topic: conducted?.topic ?? "" });
  }

  const rows = lesson.editable ? buildInitialRows(lesson.className) : CLOSED_LESSON_ROWS;
  return delay({ lesson, rows, topic: conducted?.topic ?? "" });
}

export async function saveAttendance(
  lessonId: string,
  rows: AttendanceRow[],
  meta: { topic: string; planIndex: number | null },
): Promise<void> {
  const all = read<AttendanceRow[]>(KEY_ATTENDANCE);
  all[lessonId] = rows;
  write(KEY_ATTENDANCE, all);

  const lesson = findLesson(lessonId);
  if (lesson) {
    const log = getConducted();
    log[lessonId] = {
      lessonId,
      date: lesson.date,
      period: lesson.period,
      className: lesson.className,
      subject: lesson.subject,
      topic: meta.topic.trim(),
      planIndex: meta.planIndex,
      savedAt: new Date().toISOString(),
      present: rows.filter((r) => r.status === "present").length,
      absent: rows.filter((r) => r.status === "absent").length,
      excused: rows.filter((r) => r.status === "excused").length,
      late: rows.filter((r) => r.status === "late").length,
      total: rows.length,
    };
    write(KEY_CONDUCTED, log);
  }

  return delay(undefined, 500);
}

// ---------- Uy vazifasi ----------

export async function getHomeworkList(): Promise<HomeworkItem[]> {
  const saved = read<SubmissionRow[]>(KEY_SUBMISSIONS);
  return delay(
    DEMO_HOMEWORK.map((hw) => {
      const rows = saved[hw.id];
      if (!rows) return hw;
      return { ...hw, gradedCount: rows.filter((r) => r.status === "graded").length };
    }),
  );
}

export async function getSubmissions(
  homeworkId: string,
): Promise<{ homework: HomeworkItem; rows: SubmissionRow[] } | null> {
  const homework = findHomework(homeworkId);
  if (!homework) return delay(null);
  const saved = read<SubmissionRow[]>(KEY_SUBMISSIONS)[homeworkId];
  return delay({ homework, rows: saved ?? buildSubmissions(homework) });
}

export async function saveSubmissions(
  homeworkId: string,
  rows: SubmissionRow[],
): Promise<void> {
  const all = read<SubmissionRow[]>(KEY_SUBMISSIONS);
  all[homeworkId] = rows;
  write(KEY_SUBMISSIONS, all);
  return delay(undefined, 450);
}

// ─────────────────────────── Baholar (JUR-01..04) ───────────────────────────

/**
 * JUR-02, JUR-03: baho turi, vazni va baholash tizimi.
 *
 * Taʼriflar `lib/contracts.ts` da — backenddagi `GradeKind`,
 * `GradingScale` va `SCALE_MAX` ning aksi. Bu yerda faqat qayta
 * eksport, shunda ustoz jurnali va oʻquvchi kabineti bir xil vazndan
 * hisoblaydi.
 */
export {
  GRADE_KIND_LABELS,
  GRADE_WEIGHTS,
  SCALE_MAX,
  codeToScale,
  scaleToCode,
} from "@/lib/contracts";
export type { GradeKind, GradingScale, GradingScaleCode } from "@/lib/contracts";

import type { GradeKind, GradingScale } from "@/lib/contracts";
import { GRADE_WEIGHTS } from "@/lib/contracts";

export interface GradeEntry {
  value: number;
  kind: GradeKind;
  comment?: string;
}

/** Kalit: "11-A|Matematika" -> studentId -> sana -> baho */
type GradeBook = Record<string, Record<string, Record<string, GradeEntry>>>;

export function courseKey(className: string, subject: string): string {
  return `${className}|${subject}`;
}

export function getGrades(className: string, subject: string) {
  const all = read<GradeBook[string]>(KEY_GRADES) as unknown as GradeBook;
  return all[courseKey(className, subject)] ?? {};
}

export function saveGrade(
  className: string,
  subject: string,
  studentId: string,
  date: string,
  entry: GradeEntry | null,
): void {
  const all = (read<unknown>(KEY_GRADES) as unknown as GradeBook) ?? {};
  const key = courseKey(className, subject);
  all[key] ??= {};
  all[key][studentId] ??= {};
  if (entry === null) {
    delete all[key][studentId][date];
  } else {
    all[key][studentId][date] = entry;
  }
  write(KEY_GRADES, all as unknown as Record<string, unknown>);
}

/**
 * Chorak bahosi (JUR-04): vaznli oʻrtacha.
 *
 * Nazorat ishi vazni 3, joriy baho 1. Chorak bahosi yaxlitlanadi —
 * 4.5 va undan yuqorisi 5 ga.
 */
export function termAverage(
  grades: Record<string, GradeEntry>,
  scale: GradingScale,
): { raw: number; rounded: number; count: number } | null {
  const items = Object.values(grades).filter((g) => GRADE_WEIGHTS[g.kind] > 0);
  if (items.length === 0) return null;

  const totalWeight = items.reduce((s, g) => s + GRADE_WEIGHTS[g.kind], 0);
  const sum = items.reduce((s, g) => s + g.value * GRADE_WEIGHTS[g.kind], 0);
  const raw = sum / totalWeight;

  // 100 ballik tizimda chorak bahosi ham 100 ballik boʻlib qoladi.
  const rounded = scale === 5 ? Math.round(raw) : Math.round(raw);
  return { raw, rounded, count: items.length };
}

// ─────────────────── Testlar va eʼlonlar (saqlanadi) ───────────────────

/**
 * Testlar va eʼlonlar avval faqat `useState` da edi — sahifa yangilansa
 * yoʻqolardi. Demo koʻrsatish paytida bu noqulay chiqadi, shuning uchun
 * ular ham xotiraga yoziladi.
 */
export function loadCollection<T>(kind: "tests" | "announcements", seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  const key = kind === "tests" ? KEY_TESTS : KEY_ANNOUNCEMENTS;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : seed;
  } catch {
    return seed;
  }
}

export function saveCollection<T>(kind: "tests" | "announcements", items: T[]): void {
  if (typeof window === "undefined") return;
  const key = kind === "tests" ? KEY_TESTS : KEY_ANNOUNCEMENTS;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* xotira toʻlgan — demo toʻxtamasin */
  }
}

/** Demo qayta boshlanganda tozalash. */
export function resetDemo(): void {
  if (typeof window === "undefined") return;
  for (const k of [
    KEY_ATTENDANCE,
    KEY_SUBMISSIONS,
    KEY_CONDUCTED,
    KEY_GRADES,
    KEY_TESTS,
    KEY_ANNOUNCEMENTS,
  ]) {
    window.localStorage.removeItem(k);
  }
}
