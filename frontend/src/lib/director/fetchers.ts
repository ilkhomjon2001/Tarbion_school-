import "server-only";

import {
  classesTaughtBy,
  initialScheduleGrid,
  overview,
  payments,
  reports,
  schoolClasses,
  SUBJECT_LIST,
  teachers,
  teacherStatsFor,
  teacherWeeklySchedule,
  type TeacherWeeklyLesson,
} from "@/lib/director/data";
import type {
  DirectorOverview,
  DirectorReports,
  PaymentRecord,
  SchoolClass,
  ScheduleGrid,
  Teacher,
  TeacherStats,
  Weekday,
} from "@/lib/director/types";

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function getDirectorOverview(): Promise<DirectorOverview> {
  return delay(overview);
}

export async function getTeachers(): Promise<Teacher[]> {
  return delay(teachers);
}

export async function getTeacher(id: string): Promise<Teacher | null> {
  return delay(teachers.find((t) => t.id === id) ?? null);
}

export async function getTeacherStats(id: string): Promise<TeacherStats> {
  return delay(teacherStatsFor(id));
}

export async function getSchoolClasses(): Promise<SchoolClass[]> {
  return delay(schoolClasses);
}

export async function getSchoolClass(id: string): Promise<SchoolClass | null> {
  return delay(schoolClasses.find((c) => c.id === id) ?? null);
}

export async function getPayments(): Promise<PaymentRecord[]> {
  return delay(payments);
}

export async function getDirectorReports(): Promise<DirectorReports> {
  return delay(reports);
}

export async function getSubjectList(): Promise<string[]> {
  return delay([...SUBJECT_LIST]);
}

export async function getInitialScheduleGrid(): Promise<ScheduleGrid> {
  return delay(initialScheduleGrid());
}

export async function getTeacherWeeklySchedule(
  teacherId: string,
): Promise<Record<Weekday, Record<number, TeacherWeeklyLesson | null>>> {
  return delay(teacherWeeklySchedule(teacherId));
}

export async function getClassesTaughtBy(teacherId: string): Promise<SchoolClass[]> {
  return delay(classesTaughtBy(teacherId));
}
