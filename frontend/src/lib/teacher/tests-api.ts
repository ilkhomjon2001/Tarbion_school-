"use client";

/**
 * Testlar — backend qatlami (TST-01…TST-05).
 *
 * Toʻgʻri javob ikkita ALOHIDA tipda ajratilgan:
 *
 *   `QuestionOut`            — ustoz koʻrinishi, `is_correct` bor
 *   `QuestionForStudentOut`  — oʻquvchi koʻrinishi, maydon YOʻQ
 *
 * Bu tiplar backend OpenAPI sxemasidan generatsiya qilinadi. Ya'ni
 * oʻquvchi ekranida `is_correct` ni yozishga urinsangiz `tsc` yiqiladi
 * — himoya kompilyatsiya bosqichida ham bor.
 *
 * Ball hisoblash bu yerda YOʻQ: javoblar serverga yuboriladi va u
 * hisoblaydi (TST-04). Frontend ball yubormaydi.
 */

import {
  testsAddQuestion,
  testsArchiveQuestion,
  testsArchiveTest,
  testsAvailable,
  testsCreateTest,
  testsMyTests,
  testsQuestions,
  testsResults,
  testsSetStatus,
  testsStart,
  testsStudentAttempts,
  testsSubmit,
} from "@/lib/api/sdk.gen";
import type {
  AttemptOut,
  AttemptStartOut,
  QuestionForStudentOut,
  QuestionOut,
  TestOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { AttemptOut, AttemptStartOut, QuestionForStudentOut, QuestionOut, TestOut };

export const TEST_STATUS_LABELS: Record<string, string> = {
  draft: "Qoralama",
  published: "Faol",
  closed: "Yakunlangan",
};

export const TEST_STATUS_TONES: Record<string, "neutral" | "success" | "info"> = {
  draft: "neutral",
  published: "success",
  closed: "info",
};

export const QUESTION_KIND_LABELS: Record<string, string> = {
  single: "Bitta javob",
  multiple: "Bir nechta javob",
};

export function apiXato(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

// ─────────────────────────── Ustoz ───────────────────────────

export async function fetchTests(classId?: string): Promise<TestOut[]> {
  return withAuth<TestOut[]>(() => testsMyTests({ query: { class_id: classId } }));
}

export type TestInput = {
  class_id: string;
  subject_id: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  attempts_allowed?: number;
  shuffle?: boolean;
  opens_at: string;
  closes_at: string;
};

export async function createTest(input: TestInput): Promise<TestOut> {
  return withAuth<TestOut>(() => testsCreateTest({ body: input }));
}

/** `draft` → `published` → `closed`. Savolsiz test eʼlon qilinmaydi. */
export async function setTestStatus(testId: string, status: string): Promise<TestOut> {
  return withAuth<TestOut>(() =>
    testsSetStatus({ path: { test_id: testId }, body: { status } }),
  );
}

/** Arxivlaydi — oʻchirmaydi (CLAUDE.md 1-qoida). */
export async function archiveTest(testId: string): Promise<void> {
  await withAuth<void>(() => testsArchiveTest({ path: { test_id: testId } }));
}

/** USTOZ koʻrinishi — toʻgʻri javoblar bilan. */
export async function fetchQuestions(testId: string): Promise<QuestionOut[]> {
  return withAuth<QuestionOut[]>(() => testsQuestions({ path: { test_id: testId } }));
}

export type QuestionInput = {
  text: string;
  kind: string;
  points: number;
  options: { text: string; is_correct: boolean }[];
};

export async function addQuestion(
  testId: string,
  input: QuestionInput,
): Promise<QuestionOut> {
  return withAuth<QuestionOut>(() =>
    testsAddQuestion({ path: { test_id: testId }, body: input }),
  );
}

export async function archiveQuestion(questionId: string): Promise<void> {
  await withAuth<void>(() => testsArchiveQuestion({ path: { question_id: questionId } }));
}

export async function fetchResults(testId: string): Promise<AttemptOut[]> {
  return withAuth<AttemptOut[]>(() => testsResults({ path: { test_id: testId } }));
}

// ─────────────────────── Oʻquvchi va ota-ona ───────────────────────

export async function fetchAvailableTests(studentId: string): Promise<TestOut[]> {
  return withAuth<TestOut[]>(() => testsAvailable({ path: { student_id: studentId } }));
}

/**
 * Urinishni boshlaydi.
 *
 * Tugallanmagan urinish bor boʻlsa server oʻshanisini qaytaradi —
 * sahifa yangilanganda urinish sarflanib ketmasin.
 */
export async function startAttempt(
  testId: string,
  studentId: string,
): Promise<AttemptStartOut> {
  return withAuth<AttemptStartOut>(() =>
    testsStart({ path: { test_id: testId, student_id: studentId } }),
  );
}

export async function submitAttempt(
  attemptId: string,
  answers: { question_id: string; selected: string[] }[],
): Promise<AttemptOut> {
  return withAuth<AttemptOut>(() =>
    testsSubmit({ path: { attempt_id: attemptId }, body: { answers } }),
  );
}

export async function fetchStudentAttempts(studentId: string): Promise<AttemptOut[]> {
  return withAuth<AttemptOut[]>(() =>
    testsStudentAttempts({ path: { student_id: studentId } }),
  );
}

// ─────────────────────────── Koʻrsatish ───────────────────────────

const DATETIME_FMT = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** «12-sentabr 17:00» — Toshkent boʻyicha (CLAUDE.md 3-qoida). */
export function formatMoment(iso: string): string {
  return DATETIME_FMT.format(new Date(iso));
}

/** `datetime-local` maydoni uchun qiymat. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
