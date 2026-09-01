"use client";

/**
 * Soʻrovnomalar — backend qatlami.
 *
 * Ota-ona faqat farzandiga dars beradigan ustozlarni koʻradi va
 * baholaydi — roʻyxat serverda quriladi. Natijada ota-onaning kimligi
 * yoʻq: anonimlik sxema darajasida.
 */

import {
  surveysActive,
  surveysCreate,
  surveysListSurveys,
  surveysRespond,
  surveysResults,
  surveysSetStatus,
} from "@/lib/api/sdk.gen";
import type {
  ActiveSurveyOut,
  SurveyOut,
  TeacherResultOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { ActiveSurveyOut, SurveyOut, TeacherResultOut };

export const SURVEY_STATUS_LABELS: Record<string, string> = {
  draft: "Qoralama",
  active: "Faol",
  closed: "Yopilgan",
};

/** Yangi soʻrovnoma uchun standart savollar. */
export const DEFAULT_QUESTIONS = [
  "Darsni tushunarli tushuntiradi",
  "Uy vazifasi meʼyorida beriladi",
  "Bolam bilan munosabati yaxshi",
  "Ota-ona bilan aloqasi yetarli",
];

export async function fetchSurveys(): Promise<SurveyOut[]> {
  return withAuth<SurveyOut[]>(() => surveysListSurveys({}));
}

export async function createSurvey(
  title: string,
  questions: string[],
): Promise<SurveyOut> {
  return withAuth<SurveyOut>(() => surveysCreate({ body: { title, questions } }));
}

/** draft → active → closed. Orqaga yoʻl yoʻq. */
export async function setSurveyStatus(id: string, status: string): Promise<SurveyOut> {
  return withAuth<SurveyOut>(() =>
    surveysSetStatus({ path: { survey_id: id }, query: { status } }),
  );
}

export async function fetchActiveSurvey(): Promise<ActiveSurveyOut> {
  return withAuth<ActiveSurveyOut>(() => surveysActive({}));
}

export async function respondSurvey(
  surveyId: string,
  teacherId: string,
  scores: Record<string, number>,
  comment: string,
): Promise<void> {
  await withAuth(() =>
    surveysRespond({
      path: { survey_id: surveyId },
      body: { teacher_id: teacherId, scores, comment: comment.trim() || null },
    }),
  );
}

export async function fetchSurveyResults(surveyId: string): Promise<TeacherResultOut[]> {
  return withAuth<TeacherResultOut[]>(() =>
    surveysResults({ path: { survey_id: surveyId } }),
  );
}
