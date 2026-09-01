"use client";

/**
 * Imtihonlar va dars rejalari — oʻquv boʻlimi backend qatlami.
 *
 * Butun modul serverda oʻquv boʻlimi/administrator rollari bilan
 * yopiq (router darajasida) — ustoz va ota-onaga 403.
 */

import {
  examsCreateExam,
  examsCreatePlan,
  examsEnterResults,
  examsListExams,
  examsListPlans,
  examsResults,
  examsSetPlanStatus,
  examsSetStatus,
} from "@/lib/api/sdk.gen";
import type { ExamOut, ExamResultRowOut, PlanOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { ExamOut, ExamResultRowOut, PlanOut };

export const EXAM_KIND_LABELS: Record<string, string> = {
  oylik: "Oylik nazorat",
  chorak: "Chorak imtihoni",
  yakuniy: "Yakuniy imtihon",
  sinov: "Sinov imtihoni",
};

export const EXAM_STATUS_LABELS: Record<string, string> = {
  rejada: "Rejada",
  otkazildi: "Oʻtkazildi",
  bekor: "Bekor qilindi",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  topshirildi: "Topshirildi",
  tasdiqlandi: "Tasdiqlandi",
  qaytarildi: "Qaytarildi",
};

export async function fetchExams(): Promise<ExamOut[]> {
  return withAuth<ExamOut[]>(() => examsListExams({}));
}

export async function createExam(input: {
  title: string;
  kind: string;
  subject_id: string;
  class_id: string;
  exam_date: string;
}): Promise<ExamOut> {
  return withAuth<ExamOut>(() => examsCreateExam({ body: input }));
}

export async function setExamStatus(id: string, status: string): Promise<ExamOut> {
  return withAuth<ExamOut>(() =>
    examsSetStatus({ path: { exam_id: id }, query: { status } }),
  );
}

export async function fetchExamResults(examId: string): Promise<ExamResultRowOut[]> {
  return withAuth<ExamResultRowOut[]>(() =>
    examsResults({ path: { exam_id: examId } }),
  );
}

export async function enterExamResults(
  examId: string,
  scores: { student_id: string; score: number | null; absent: boolean }[],
): Promise<void> {
  await withAuth(() => examsEnterResults({ path: { exam_id: examId }, body: { scores } }));
}

export async function fetchPlans(): Promise<PlanOut[]> {
  return withAuth<PlanOut[]>(() => examsListPlans({}));
}

export async function createPlan(input: {
  teacher_id: string;
  subject_id: string;
  class_id: string;
  period: string;
}): Promise<PlanOut> {
  return withAuth<PlanOut>(() => examsCreatePlan({ body: input }));
}

/** Qaytarishda sabab majburiy — serverda ham tekshiriladi. */
export async function setPlanStatus(
  id: string,
  status: string,
  comment?: string,
): Promise<PlanOut> {
  return withAuth<PlanOut>(() =>
    examsSetPlanStatus({
      path: { plan_id: id },
      body: { status, comment: comment ?? null },
    }),
  );
}
