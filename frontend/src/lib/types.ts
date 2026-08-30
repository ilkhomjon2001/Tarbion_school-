/**
 * Backend bilan umumiy kodlar `lib/contracts.ts` da — bu yerda ular faqat
 * qayta eksport qilinadi, aks holda ikki joyda ikki xil roʻyxat paydo
 * boʻladi (ilgari aynan shunday boʻlgan).
 */
export type {
  AttendanceStatus,
  GradeKind,
  SubmissionStatus,
} from "@/lib/contracts";

import type { AttendanceStatus, GradeKind, SubmissionStatus } from "@/lib/contracts";

export type TestQuestionType = "single" | "multiple" | "matching" | "open";

export interface Student {
  id: string;
  fullName: string;
  className: string;
  phone?: string;
  email?: string;
}

export interface NotificationPreferences {
  newGrade: boolean;
  homeworkReminder: boolean;
  announcements: boolean;
}

export interface ScheduleEntry {
  id: string;
  dayOfWeek: number; // 1 (dushanba) ... 7 (yakshanba)
  periodNumber: number;
  startTime: string; // "08:30"
  endTime: string; // "09:15"
  subject: string;
  teacherName: string;
  room: string;
}

export interface LessonSummary {
  id: string;
  date: string; // ISO sana, Asia/Tashkent kuni
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherName: string;
  room: string;
}

export interface Homework {
  id: string;
  subject: string;
  teacherName: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  status: SubmissionStatus;
  grade?: number;
  teacherComment?: string;
  submissionText?: string;
}

export interface MatchTarget {
  id: string;
  text: string;
}

export interface TestQuestion {
  id: string;
  text: string;
  type: TestQuestionType;
  /** single/multiple uchun javob variantlari; matching uchun chap ustun. */
  options: { id: string; text: string }[];
  /** single/multiple uchun toʻgʻri variant(lar) id'si. */
  correctOptionIds: string[];
  /** matching uchun oʻng ustun (aralashtirib koʻrsatiladi). */
  matchTargets?: MatchTarget[];
  /** matching uchun toʻgʻri javob: options[].id -> matchTargets[].id. */
  correctMatches?: Record<string, string>;
  /** open uchun — avtomatik baholanmaydi, ustoz tekshiradi (TST-04). */
  sampleAnswer?: string;
}

export interface TestItem {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  passScore: number;
  questions: TestQuestion[];
  attemptsAllowed: number;
  attemptsUsed: number;
  lastScore?: number;
}

export interface TestAttemptResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  /** Ustoz tomonidan tekshirilishi kerak boʻlgan ochiq savollar soni (TST-04). */
  pendingReviewCount: number;
}

export interface GradeEntry {
  id: string;
  subject: string;
  date: string;
  /** `contracts.ts::GradeKind` — backenddagi `grades.kind` ustuni. */
  kind: GradeKind;
  value: number;
  teacherName: string;
  comment: string;
  homeworkId?: string;
}

export interface SubjectGradeSummary {
  subject: string;
  average: number;
  entries: GradeEntry[];
}

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  subject?: string;
}

export interface AttendanceSummary {
  monthLabel: string;
  percentPresent: number;
  days: AttendanceDay[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  audience: "school" | "class";
}

export interface ClassmateStat {
  studentId: string;
  fullName: string;
  averageGrade: number;
  attendancePercent: number;
}

export interface RankingEntry extends ClassmateStat {
  rank: number;
  score: number;
  isCurrentUser: boolean;
}

export type MealType = "breakfast" | "lunch" | "snack";

export interface MealItem {
  id: string;
  mealType: MealType;
  time: string;
  dishes: string[];
  imageUrl?: string;
}

export interface DailyMenu {
  date: string;
  meals: MealItem[];
  note?: string;
}
