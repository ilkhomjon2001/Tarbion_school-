export type AttendanceStatus = "present" | "absent" | "excused" | "late";

export type HomeworkStatus = "assigned" | "submitted" | "late" | "graded";

export type TestQuestionType = "single" | "multiple";

export interface Student {
  id: string;
  fullName: string;
  className: string;
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
  status: HomeworkStatus;
  grade?: number;
  teacherComment?: string;
}

export interface TestQuestion {
  id: string;
  text: string;
  type: TestQuestionType;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
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
}

export type GradeType = "joriy" | "nazorat" | "chorak" | "yillik";

export interface GradeEntry {
  id: string;
  subject: string;
  date: string;
  type: GradeType;
  value: number;
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
