/**
 * Ustoz paneli turlari.
 *
 * Alohida fayl — `lib/types.ts` oʻquvchi kabinetiga tegishli va uni
 * sherik tahrirlayapti. Konflikt boʻlmasligi uchun ustoz turlari shu yerda.
 * Maydon nomlari kelajakdagi API javoblariga mos qilib tanlangan, shunda
 * backend ulanganda komponentlar oʻzgarmaydi.
 */

export type AttendanceStatus = "present" | "absent" | "excused" | "late";

export type SubmissionStatus =
  | "assigned"
  | "submitted"
  | "late"
  | "graded"
  | "returned";

export interface TeacherProfile {
  id: string;
  fullName: string;
  shortName: string;
  roles: string[];
}

export interface TeacherLesson {
  id: string;
  date: string; // "2026-08-29"
  period: number;
  startTime: string; // "08:30"
  endTime: string; // "09:15"
  className: string;
  subject: string;
  room: string;
  studentCount: number;
  /** Davomat belgilangan boʻlsa — nechta "keldi" boʻlgani. */
  presentCount: number | null;
  /** DAV-03: dars tugaganidan 24 soat oʻtgan boʻlsa tahrirlab boʻlmaydi. */
  editable: boolean;
}

export interface AttendanceRow {
  studentId: string;
  fullName: string;
  status: AttendanceStatus;
  note: string;
}

export interface LessonAttendance {
  lesson: TeacherLesson;
  rows: AttendanceRow[];
}

export interface HomeworkItem {
  id: string;
  className: string;
  subject: string;
  title: string;
  description: string;
  assignedAt: string;
  dueAt: string;
  maxScore: number;
  totalCount: number;
  submittedCount: number;
  gradedCount: number;
}

export interface SubmissionRow {
  id: string;
  studentId: string;
  fullName: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  answerText: string | null;
  attachmentName: string | null;
  score: number | null;
  teacherComment: string | null;
}

/** Interfeys matnlari — bitta manba. */
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Keldi",
  absent: "Kelmadi",
  excused: "Sababli",
  late: "Kechikdi",
};

/** Grid koʻrinishidagi qisqa harf (Stitch dizayni boʻyicha). */
export const ATTENDANCE_LETTERS: Record<AttendanceStatus, string> = {
  present: "K",
  absent: "Y",
  excused: "S",
  late: "G",
};

export const ATTENDANCE_ORDER: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
  "late",
];

export const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  assigned: "Topshirilmagan",
  submitted: "Tekshirilmagan",
  late: "Kechikkan",
  graded: "Baholangan",
  returned: "Qaytarilgan",
};
