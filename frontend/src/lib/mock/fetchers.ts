import "server-only";
import {
  announcements,
  attendanceSummary,
  currentStudent,
  homeworkList,
  scheduleEntries,
  subjectGrades,
  testList,
  todayLessons,
} from "@/lib/mock/data";
import type {
  Announcement,
  AttendanceSummary,
  Homework,
  LessonSummary,
  ScheduleEntry,
  Student,
  SubjectGradeSummary,
  TestItem,
} from "@/lib/types";

/**
 * Backend hali yoʻqligi sababli tarmoq kechikishini simulyatsiya qiladi —
 * shu orqali loading holatlari (Suspense skeleton) haqiqiy sharoitga yaqin
 * tekshiriladi. Real API ulanganda bu fayl butunlay almashtiriladi.
 */
function delay<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function getCurrentStudent(): Promise<Student> {
  return delay(currentStudent);
}

export async function getTodayLessons(): Promise<LessonSummary[]> {
  return delay(
    todayLessons.map((lesson) => ({ ...lesson, date: "2026-08-29" })),
  );
}

export async function getSchedule(): Promise<ScheduleEntry[]> {
  return delay(scheduleEntries);
}

export async function getHomeworkList(): Promise<Homework[]> {
  return delay(homeworkList);
}

export async function getHomeworkById(id: string): Promise<Homework | null> {
  const found = homeworkList.find((item) => item.id === id) ?? null;
  return delay(found);
}

export async function getTestList(): Promise<TestItem[]> {
  return delay(testList);
}

export async function getTestById(id: string): Promise<TestItem | null> {
  const found = testList.find((item) => item.id === id) ?? null;
  return delay(found);
}

export async function getSubjectGrades(): Promise<SubjectGradeSummary[]> {
  return delay(subjectGrades);
}

export async function getAttendanceSummary(): Promise<AttendanceSummary> {
  return delay(attendanceSummary);
}

export async function getAnnouncements(): Promise<Announcement[]> {
  return delay(announcements);
}

export async function getLatestAnnouncements(count = 2): Promise<Announcement[]> {
  const all = await getAnnouncements();
  return all.slice(0, count);
}

export async function getRecentGrades(count = 3) {
  const bySubject = await getSubjectGrades();
  return bySubject
    .flatMap((s) => s.entries)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, count);
}
