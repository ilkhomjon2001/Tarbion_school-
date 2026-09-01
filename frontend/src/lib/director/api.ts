"use client";

/**
 * Rahbariyat kabineti — backend bilan ishlash qatlami.
 *
 * `lib/director/fetchers.ts` (mock, server-only) oʻrnini bosadi: token
 * brauzer xotirasida boʻlgani uchun maʼlumot MIJOZ tomonida olinadi
 * (DECISIONS.md — BFF yoʻq).
 */

import {
  attendanceClassStudents,
  directorClasses,
  directorOverview,
  directorTeachers,
} from "@/lib/api/sdk.gen";
import type {
  ClassRowOut,
  DirectorOverviewOut,
  StudentStatOut,
  TeacherRowOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { ClassRowOut, DirectorOverviewOut, StudentStatOut, TeacherRowOut };

export async function fetchOverview(days: number): Promise<DirectorOverviewOut> {
  return withAuth<DirectorOverviewOut>(() => directorOverview({ query: { days } }));
}

export async function fetchClasses(): Promise<ClassRowOut[]> {
  return withAuth<ClassRowOut[]>(() => directorClasses());
}

export async function fetchTeachers(): Promise<TeacherRowOut[]> {
  return withAuth<TeacherRowOut[]>(() => directorTeachers());
}

/** Sinfdagi har bir oʻquvchining davomati (DAV-02 kesimi). */
export async function fetchClassStudentStats(
  classId: string,
  range?: { from: string; to: string },
): Promise<StudentStatOut[]> {
  return withAuth<StudentStatOut[]>(() =>
    attendanceClassStudents({
      path: { class_id: classId },
      query: range ? { date_from: range.from, date_to: range.to } : undefined,
    }),
  );
}

/**
 * DIR-07 chegarasi — davomat shu foizdan past oʻquvchi «xavf ostida»
 * deb belgilanadi. Mockdagi qiymat bilan bir xil (85).
 */
export const RISK_THRESHOLD = 85;

export function isAtRisk(percent: number): boolean {
  return percent < RISK_THRESHOLD;
}
