"use client";

/**
 * Oʻquvchi kabineti — backend bilan ishlash qatlami (T-034).
 *
 * API javoblari kabinet komponentlari allaqachon tushunadigan
 * `lib/types.ts` shakllariga oʻgiriladi — sahifalar deyarli qayta
 * yozilmaydi (ota-ona kabinetidagi yondashuv, `lib/parent/api.ts`).
 *
 * Kirish nazorati BU YERDA EMAS: oʻquvchi faqat OʻZ yozuvini koʻrishini
 * server hal qiladi (`services/access.py`, X-1). `student_id` `/auth/me`
 * dan keladi — qulaylik uchun, ishonch manbai emas.
 */

import {
  academicBells,
  academicCurrentYear,
  authMe,
  journalStudentGrades,
  journalStudentHomework,
  journalSubmit,
  parentChildAttendance,
  scheduleEntries,
  testsAvailable,
  testsStart,
  testsStudentAttempts,
  testsSubmit,
} from "@/lib/api/sdk.gen";
import type {
  AttemptOut,
  AttemptStartOut,
  BellOut,
  DayAttendanceOut,
  GradeOut,
  ScheduleEntryOut,
  StudentHomeworkOut,
  StudentSubjectGradesOut,
  TestOut,
  UserOut,
} from "@/lib/api/types.gen";
import type { GradeKind, SubmissionStatus } from "@/lib/contracts";
import type {
  AttendanceDay,
  AttendanceSummary,
  GradeEntry,
  Homework,
  LessonSummary,
  ScheduleEntry,
  SubjectGradeSummary,
} from "@/lib/types";
import { getUser, withAuth } from "@/lib/session";

// ─────────────────────────── Kim men? ───────────────────────────

export interface StudentMe {
  /** `students.id` — barcha soʻrovlar shu id bilan ketadi. */
  studentId: string | null;
  classId: string | null;
  className: string | null;
  fullName: string;
  shortName: string;
}

function toMe(user: UserOut): StudentMe {
  return {
    studentId: user.student_id ?? null,
    classId: user.class_id ?? null,
    className: user.class_name ?? null,
    fullName: user.full_name,
    shortName: user.short_name,
  };
}

/**
 * Joriy oʻquvchi. Sessiya xotirasidan olinadi (AuthGuard tiklagan),
 * boʻlmasa `/auth/me` dan qayta soʻraladi.
 */
export async function fetchStudentMe(): Promise<StudentMe> {
  const cached = getUser();
  if (cached) return toMe(cached);
  return toMe(await withAuth<UserOut>(() => authMe()));
}

// ─────────────────────────── Jadval ───────────────────────────

const toHm = (t: string) => t.slice(0, 5);

/**
 * Sinf jadvali + qoʻngʻiroqlar vaqti — kabinetdagi `ScheduleEntry`
 * shakliga yigʻiladi. Qoʻngʻiroq yozilmagan para boʻsh vaqt bilan chiqadi.
 */
export async function fetchScheduleForClass(classId: string): Promise<ScheduleEntry[]> {
  const [entries, year] = await Promise.all([
    withAuth<ScheduleEntryOut[]>(() =>
      scheduleEntries({ query: { class_id: classId } }),
    ),
    withAuth<{ id: string }>(() => academicCurrentYear()),
  ]);
  const bells = await withAuth<BellOut[]>(() =>
    academicBells({ path: { year_id: year.id } }),
  );
  const byPeriod = new Map(bells.map((b) => [b.period, b]));

  return entries.map((e) => {
    const bell = byPeriod.get(e.period);
    return {
      id: e.id,
      dayOfWeek: e.weekday,
      periodNumber: e.period,
      startTime: bell ? toHm(bell.starts_at) : "—",
      endTime: bell ? toHm(bell.ends_at) : "—",
      subject: e.subject_name,
      teacherName: e.teacher_name,
      room: e.room ?? "—",
    };
  });
}

/** ISO sanadagi hafta kuni: 1 = dushanba … 7 = yakshanba. */
function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

export function todayLessonsOf(entries: ScheduleEntry[], today: Date): LessonSummary[] {
  const wd = isoWeekday(today);
  const iso = localIso(today);
  return entries
    .filter((e) => e.dayOfWeek === wd)
    .sort((a, b) => a.periodNumber - b.periodNumber)
    .map((e) => ({
      id: e.id,
      date: iso,
      periodNumber: e.periodNumber,
      startTime: e.startTime,
      endTime: e.endTime,
      subject: e.subject,
      teacherName: e.teacherName,
      room: e.room,
    }));
}

export function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─────────────────────────── Davomat ───────────────────────────

const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

/** Kun holati — kundagi eng «ogʻir» dars holati boʻyicha. */
function dayStatus(day: DayAttendanceOut): AttendanceDay["status"] {
  const statuses = day.lessons.map((l) => l.status);
  if (statuses.includes("absent")) return "absent";
  if (statuses.includes("late")) return "late";
  if (statuses.includes("excused")) return "excused";
  return "present";
}

/**
 * Oylik davomat xulosasi (kalendar uchun). Faqat davomat BELGILANGAN
 * kunlar keladi — belgilanmagan kun «kelmadi» boʻlib koʻrinmaydi.
 */
export async function fetchAttendanceSummary(
  studentId: string,
  year: number,
  monthIndex: number, // 0 asosli, Date bilan bir xil
): Promise<AttendanceSummary> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const days = await withAuth<DayAttendanceOut[]>(() =>
    parentChildAttendance({
      path: { student_id: studentId },
      query: {
        date_from: `${year}-${pad(monthIndex + 1)}-01`,
        date_to: `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`,
      },
    }),
  );

  const mapped: AttendanceDay[] = days.map((d) => ({
    date: d.date,
    status: dayStatus(d),
  }));
  const lessonsTotal = days.reduce((n, d) => n + d.lessons.length, 0);
  const lessonsPresent = days.reduce(
    (n, d) => n + d.lessons.filter((l) => l.status !== "absent").length,
    0,
  );

  return {
    monthLabel: `${MONTHS_UZ[monthIndex]} ${year}`,
    percentPresent:
      lessonsTotal > 0 ? Math.round((lessonsPresent / lessonsTotal) * 100) : 100,
    days: mapped,
  };
}

// ─────────────────────────── Uy vazifasi ───────────────────────────

/**
 * `Homework.id` sifatida SUBMISSION id olinadi — topshirish ham,
 * tafsilot sahifasi ham shu id bilan ishlaydi.
 */
function toHomework(r: StudentHomeworkOut): Homework {
  return {
    id: r.submission_id,
    subject: r.subject_name,
    teacherName: "",
    title: r.title,
    description: r.description,
    assignedDate: "",
    dueDate: r.due_at,
    status: r.status as SubmissionStatus,
    grade: r.score ?? undefined,
    teacherComment: r.teacher_comment ?? undefined,
  };
}

export async function fetchHomeworkList(studentId: string): Promise<Homework[]> {
  const rows = await withAuth<StudentHomeworkOut[]>(() =>
    journalStudentHomework({ path: { student_id: studentId } }),
  );
  return rows.map(toHomework);
}

export async function submitHomework(
  submissionId: string,
  answerText: string,
): Promise<Homework> {
  const row = await withAuth<StudentHomeworkOut>(() =>
    journalSubmit({
      path: { submission_id: submissionId },
      body: { answer_text: answerText },
    }),
  );
  return toHomework(row);
}

// ─────────────────────────── Baholar ───────────────────────────

function toGradeEntry(subject: string, g: GradeOut): GradeEntry {
  return {
    id: g.id,
    subject,
    date: g.lesson_date ?? "",
    kind: g.kind as GradeKind,
    value: g.value,
    teacherName: "",
    comment: g.comment ?? "",
  };
}

export async function fetchSubjectGrades(
  studentId: string,
): Promise<SubjectGradeSummary[]> {
  const rows = await withAuth<StudentSubjectGradesOut[]>(() =>
    journalStudentGrades({ path: { student_id: studentId } }),
  );
  return rows.map((r) => ({
    subject: r.subject_name,
    average: r.average ?? 0,
    entries: r.grades.map((g) => toGradeEntry(r.subject_name, g)),
  }));
}

// ─────────────────────────── Testlar ───────────────────────────

export interface StudentTestRow {
  id: string;
  subject: string;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  /** Oxirgi topshirilgan urinish foizi. */
  lastPercent: number | null;
  closesAt: string;
}

export async function fetchAvailableTests(studentId: string): Promise<StudentTestRow[]> {
  const [tests, attempts] = await Promise.all([
    withAuth<TestOut[]>(() => testsAvailable({ path: { student_id: studentId } })),
    withAuth<AttemptOut[]>(() => testsStudentAttempts({ path: { student_id: studentId } })),
  ]);

  const used = new Map<string, AttemptOut[]>();
  for (const a of attempts) {
    const list = used.get(a.test_id) ?? [];
    list.push(a);
    used.set(a.test_id, list);
  }

  return tests.map((t) => {
    const mine = used.get(t.id) ?? [];
    const submitted = mine.filter((a) => a.submitted_at !== null);
    const last = submitted.sort((a, b) => b.attempt_no - a.attempt_no)[0];
    return {
      id: t.id,
      subject: t.subject_name,
      title: t.title,
      description: t.description,
      durationMinutes: t.duration_minutes,
      questionCount: t.question_count,
      attemptsAllowed: t.attempts_allowed,
      attemptsUsed: mine.length,
      lastPercent: last?.percent != null ? Math.round(last.percent) : null,
      closesAt: t.closes_at,
    };
  });
}

export async function startTest(
  testId: string,
  studentId: string,
): Promise<AttemptStartOut> {
  return withAuth<AttemptStartOut>(() =>
    testsStart({ path: { test_id: testId, student_id: studentId } }),
  );
}

export async function submitTestAttempt(
  attemptId: string,
  answers: { question_id: string; selected: string[] }[],
): Promise<AttemptOut> {
  return withAuth<AttemptOut>(() =>
    testsSubmit({ path: { attempt_id: attemptId }, body: { answers } }),
  );
}
