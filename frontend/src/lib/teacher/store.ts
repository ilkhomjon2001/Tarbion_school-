"use client";

/**
 * Demo uchun brauzer xotirasidagi saqlash.
 *
 * Backend ulanmagunicha davomat va baholar `localStorage` da saqlanadi —
 * shunda demo paytida davomat belgilanadi, boshqa sahifaga oʻtib qaytilsa
 * saqlangani koʻrinib turadi. Funksiya imzolari kelajakdagi API bilan bir
 * xil (`Promise` qaytaradi), shuning uchun almashtirish oson boʻladi.
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

function read<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    // Buzilgan yoki bloklangan xotira — demo toʻxtab qolmasin.
    return {};
  }
}

function write<T>(key: string, value: Record<string, T>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* xotira toʻlgan yoki bloklangan — jimgina oʻtkazib yuboriladi */
  }
}

/** Tarmoq kechikishini taqlid qiladi — loading holatlari haqiqiy koʻrinsin. */
function delay<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
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
): Promise<{ lesson: TeacherLesson; rows: AttendanceRow[] } | null> {
  const lesson = findLesson(lessonId);
  if (!lesson) return delay(null);

  const saved = read<AttendanceRow[]>(KEY_ATTENDANCE)[lessonId];
  if (saved) return delay({ lesson, rows: saved });

  // Muddati tugagan dars — oldindan belgilangan holat koʻrsatiladi.
  const rows = lesson.editable
    ? buildInitialRows(lesson.className)
    : CLOSED_LESSON_ROWS;
  return delay({ lesson, rows });
}

export async function saveAttendance(
  lessonId: string,
  rows: AttendanceRow[],
): Promise<void> {
  const all = read<AttendanceRow[]>(KEY_ATTENDANCE);
  all[lessonId] = rows;
  write(KEY_ATTENDANCE, all);
  return delay(undefined, 500);
}

// ---------- Uy vazifasi ----------

export async function getHomeworkList(): Promise<HomeworkItem[]> {
  const saved = read<SubmissionRow[]>(KEY_SUBMISSIONS);
  return delay(
    DEMO_HOMEWORK.map((hw) => {
      const rows = saved[hw.id];
      if (!rows) return hw;
      return {
        ...hw,
        gradedCount: rows.filter((r) => r.status === "graded").length,
      };
    }),
  );
}

export async function getSubmissions(
  homeworkId: string,
): Promise<{ homework: HomeworkItem; rows: SubmissionRow[] } | null> {
  const homework = findHomework(homeworkId);
  if (!homework) return delay(null);

  const saved = read<SubmissionRow[]>(KEY_SUBMISSIONS)[homeworkId];
  return delay({
    homework,
    rows: saved ?? buildSubmissions(homework),
  });
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

/** Demo qayta boshlanganda tozalash uchun. */
export function resetDemo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_ATTENDANCE);
  window.localStorage.removeItem(KEY_SUBMISSIONS);
}
