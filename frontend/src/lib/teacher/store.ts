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
  HomeworkItem,
  SubmissionRow,
  TeacherLesson,
} from "@/lib/teacher/types";

const KEY_ATTENDANCE = "tarbion.demo.attendance";
const KEY_SUBMISSIONS = "tarbion.demo.submissions";
const KEY_CONDUCTED = "tarbion.demo.conducted";

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

/** Demo qayta boshlanganda tozalash. */
export function resetDemo(): void {
  if (typeof window === "undefined") return;
  for (const k of [KEY_ATTENDANCE, KEY_SUBMISSIONS, KEY_CONDUCTED]) {
    window.localStorage.removeItem(k);
  }
}
