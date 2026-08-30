import "server-only";

import {
  buildOverview,
  classesTaughtBy,
  initialScheduleGrid,
  reports,
  schoolClasses,
  SUBJECT_LIST,
  teachers,
  teacherStatsFor,
  teacherWeeklySchedule,
  type TeacherWeeklyLesson,
} from "@/lib/director/data";
import {
  allClassAttendanceStats,
  allClassPaymentStats,
  financeSummary,
  studentsOfClass,
  type AttendancePeriod,
  type ClassAttendanceStat,
  type ClassPaymentStat,
  type FinanceSummary,
  type StudentRecord,
} from "@/lib/director/school-data";
import type {
  DirectorOverview,
  DirectorReports,
  OverviewPeriod,
  SchoolClass,
  ScheduleGrid,
  Teacher,
  TeacherStats,
  Weekday,
} from "@/lib/director/types";

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function getDirectorOverview(
  period: OverviewPeriod = "month",
): Promise<DirectorOverview> {
  return delay(buildOverview(period));
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

// ─────────────────────── Toʻlov va davomat kesimlari ───────────────────────

export async function getFinanceSummary(months = 1): Promise<FinanceSummary> {
  return delay(financeSummary(months));
}

export async function getClassPaymentStats(): Promise<ClassPaymentStat[]> {
  return delay(allClassPaymentStats());
}

export async function getClassAttendanceStats(
  period: AttendancePeriod,
): Promise<ClassAttendanceStat[]> {
  return delay(allClassAttendanceStats(period));
}

/** Sinf ichidagi oʻquvchilar — toʻlov va davomat tafsiloti uchun. */
export async function getClassStudents(className: string): Promise<StudentRecord[]> {
  return delay(studentsOfClass(className));
}
