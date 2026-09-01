"use client";

/**
 * Jurnal va uy vazifasi — backend qatlami (JUR-01…JUR-07, UYV-01…UYV-07).
 *
 * Bu yerda biznes qoidalar YOʻQ. "Kelmagan oʻquvchiga baho qoʻyilmaydi",
 * "boshqa kunning bahosi oʻzgarmaydi", "oʻrtacha fan ustoziga
 * koʻrinmaydi" — hammasi serverda. Frontend faqat serverdan kelgan
 * `gradable`, `editable` va `shows_average` bayroqlarini chizadi
 * (CLAUDE.md 7-qoida).
 */

import {
  journalArchiveHomework,
  journalClassAverages,
  journalClassJournal,
  journalCreateHomework,
  journalGradeSubmission,
  journalLessonJournal,
  journalMyHomework,
  journalReturnSubmission,
  journalSetGrades,
  journalStudentGrades,
  journalStudentHomework,
  journalSubmissions,
  journalSubmit,
} from "@/lib/api/sdk.gen";
import type {
  ClassJournalOut,
  HomeworkOut,
  LessonJournalOut,
  StudentHomeworkOut,
  StudentSubjectGradesOut,
  SubmissionListOut,
  SubmissionOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type {
  ClassJournalOut,
  HomeworkOut,
  LessonJournalOut,
  StudentHomeworkOut,
  StudentSubjectGradesOut,
  SubmissionListOut,
  SubmissionOut,
};

/** Serverdan kelgan xato matni — foydalanuvchiga koʻrsatiladi. */
export function apiXato(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

// ─────────────────────────── Baho ───────────────────────────

export const GRADE_KIND_LABELS: Record<string, string> = {
  current: "Joriy",
  control: "Nazorat ishi",
  term: "Chorak",
  annual: "Yillik",
};

export async function fetchLessonJournal(lessonId: string): Promise<LessonJournalOut> {
  return withAuth<LessonJournalOut>(() =>
    journalLessonJournal({ path: { lesson_id: lessonId } }),
  );
}

export type GradeInput = {
  student_id: string;
  /** `null` — bahoni olib tashlash. Server uni arxivlaydi, oʻchirmaydi. */
  value: number | null;
  comment?: string | null;
};

/**
 * Darsga baho qoʻyadi.
 *
 * Javob — yangilangan jurnal, shuning uchun alohida qayta soʻrash shart
 * emas: server nima yozganini oʻzi qaytaradi va ekran undan chiziladi.
 */
export async function saveLessonGrades(
  lessonId: string,
  rows: GradeInput[],
  meta?: { kind?: string; weight?: number },
): Promise<LessonJournalOut> {
  return withAuth<LessonJournalOut>(() =>
    journalSetGrades({
      path: { lesson_id: lessonId },
      body: {
        rows,
        kind: meta?.kind ?? "current",
        weight: meta?.weight ?? 1,
      },
    }),
  );
}

export async function fetchClassJournal(params: {
  classId: string;
  subjectId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ClassJournalOut> {
  return withAuth<ClassJournalOut>(() =>
    journalClassJournal({
      path: { class_id: params.classId },
      query: {
        subject_id: params.subjectId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
      },
    }),
  );
}

export async function fetchStudentGrades(
  studentId: string,
  range?: { dateFrom?: string; dateTo?: string },
): Promise<StudentSubjectGradesOut[]> {
  return withAuth<StudentSubjectGradesOut[]>(() =>
    journalStudentGrades({
      path: { student_id: studentId },
      query: { date_from: range?.dateFrom, date_to: range?.dateTo },
    }),
  );
}

/** Fan ustoziga `403` — oʻrtacha unga koʻrsatilmaydi (4-qoida). */
export async function fetchClassAverages(classId: string): Promise<Record<string, number>> {
  return withAuth<Record<string, number>>(() =>
    journalClassAverages({ path: { class_id: classId } }),
  );
}

// ─────────────────────────── Uy vazifasi ───────────────────────────

export const SUBMISSION_LABELS: Record<string, string> = {
  assigned: "Topshirilmagan",
  submitted: "Tekshirilmagan",
  late: "Kechikkan",
  graded: "Baholangan",
  returned: "Qaytarilgan",
};

export const SUBMISSION_TONES: Record<string, "neutral" | "info" | "warning" | "success"> = {
  assigned: "neutral",
  submitted: "info",
  late: "warning",
  graded: "success",
  returned: "warning",
};

export async function fetchHomework(classId?: string): Promise<HomeworkOut[]> {
  return withAuth<HomeworkOut[]>(() =>
    journalMyHomework({ query: { class_id: classId } }),
  );
}

export type HomeworkInput = {
  class_id: string;
  subject_id: string;
  title: string;
  description?: string;
  /** ISO datetime. Server oʻtgan sanani rad etadi. */
  due_at: string;
  allow_late?: boolean;
  max_score?: number;
  weight?: number;
};

export async function createHomework(input: HomeworkInput): Promise<HomeworkOut> {
  return withAuth<HomeworkOut>(() => journalCreateHomework({ body: input }));
}

/** Arxivlaydi — oʻchirmaydi (CLAUDE.md 1-qoida). */
export async function archiveHomework(homeworkId: string): Promise<void> {
  await withAuth<void>(() =>
    journalArchiveHomework({ path: { homework_id: homeworkId } }),
  );
}

export async function fetchSubmissions(homeworkId: string): Promise<SubmissionListOut> {
  return withAuth<SubmissionListOut>(() =>
    journalSubmissions({ path: { homework_id: homeworkId } }),
  );
}

/** Baho jurnalga ham tushadi — buni server qiladi (JUR-04). */
export async function gradeSubmission(
  submissionId: string,
  score: number,
  comment?: string | null,
): Promise<SubmissionOut> {
  return withAuth<SubmissionOut>(() =>
    journalGradeSubmission({
      path: { submission_id: submissionId },
      body: { score, comment: comment ?? null },
    }),
  );
}

/** Izoh majburiy — nima notoʻgʻri ekani aytilmasa vazifa foydasiz. */
export async function returnSubmission(
  submissionId: string,
  comment: string,
): Promise<SubmissionOut> {
  return withAuth<SubmissionOut>(() =>
    journalReturnSubmission({
      path: { submission_id: submissionId },
      body: { comment },
    }),
  );
}

export async function fetchStudentHomework(
  studentId: string,
  onlyOpen = false,
): Promise<StudentHomeworkOut[]> {
  return withAuth<StudentHomeworkOut[]>(() =>
    journalStudentHomework({
      path: { student_id: studentId },
      query: { only_open: onlyOpen },
    }),
  );
}

export async function submitHomework(
  submissionId: string,
  answerText?: string,
): Promise<StudentHomeworkOut> {
  return withAuth<StudentHomeworkOut>(() =>
    journalSubmit({
      path: { submission_id: submissionId },
      body: { answer_text: answerText ?? null },
    }),
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
export function formatDue(iso: string): string {
  return DATETIME_FMT.format(new Date(iso));
}

const DATE_ONLY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function localToday(): string {
  return DATE_ONLY.format(new Date());
}

/** `datetime-local` maydonining qiymati → ISO (brauzer zonasida). */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
