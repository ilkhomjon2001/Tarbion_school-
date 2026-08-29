/**
 * Rahbariyat kabineti (Direktor + Administrator) uchun turlar.
 *
 * TZ: DIR-01…DIR-08 (T-050…T-053, 3-bosqich). Frontend-only prototip —
 * docs/DECISIONS.md ga qarang (T-034 kabi bosqich tartibidan tashqarida).
 */

export type TeacherStatus = "active" | "archived";

export interface Teacher {
  id: string;
  fullName: string;
  shortName: string;
  subjects: string[];
  /** `schoolClasses[].homeroomTeacherId` asosida hisoblanadi. */
  homeroomClassName: string | null;
  weeklyLoadHours: number;
  status: TeacherStatus;
  phone: string;
  email: string;
  avatarInitials: string;
}

export interface TeacherTodayLesson {
  startTime: string;
  className: string;
  subject: string;
}

export interface TeacherStats {
  averageGradeGiven: number;
  attendanceMarkingRate: number;
  lessonsConducted: number;
  todayLessons: TeacherTodayLesson[];
}

export type ClassStudentStatus = "active" | "absent_today";

export interface ClassStudent {
  id: string;
  fullName: string;
  status: ClassStudentStatus;
}

export type ClassStage = "boshlangʻich" | "oʻrta" | "yuqori";

export interface SchoolClass {
  id: string;
  name: string;
  stage: ClassStage;
  /** Yagona manba — sinf rahbari shu orqali aniqlanadi. */
  homeroomTeacherId: string | null;
  /** `homeroomTeacherId` asosida hisoblanadi (koʻrsatish uchun qulaylik). */
  homeroomTeacherName: string | null;
  studentCount: number;
  averageAttendance: number;
  students: ClassStudent[];
}

export type PaymentStatus = "paid" | "overdue" | "partial";

export interface PaymentRecord {
  id: string;
  studentFullName: string;
  className: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
}

export type RequestStatus = "new" | "in_progress" | "closed";

export type RequestReplyAuthor = "maktab" | "ota-ona";

export interface RequestReply {
  id: string;
  author: RequestReplyAuthor;
  text: string;
  createdAt: string;
}

export interface ParentRequest {
  id: string;
  parentName: string;
  studentFullName: string;
  className: string;
  subject: string;
  message: string;
  createdAt: string;
  status: RequestStatus;
  replies: RequestReply[];
}

export interface AttendanceTrendPoint {
  dateLabel: string;
  percent: number;
}

export type AlertLevel = "warning" | "danger" | "info";

export interface DirectorAlert {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
}

export interface DirectorAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAtLabel: string;
}

export interface DirectorOverview {
  totalStudents: number;
  studentGrowthPercent: number;
  totalTeachers: number;
  todayAttendancePercent: number;
  /** DIR-01: o'rtacha ball (barcha maktab bo'yicha). */
  averageGrade: number;
  /** DIR-02: ochiq (yopilmagan) murojaatlar soni. */
  openRequestsCount: number;
  monthlyRevenue: number;
  revenueVsPlanPercent: number;
  attendanceTrend: AttendanceTrendPoint[];
  alerts: DirectorAlert[];
  announcements: DirectorAnnouncement[];
}

export interface GradeDistributionBucket {
  label: string;
  count: number;
}

export interface SubjectAveragePoint {
  subject: string;
  average: number;
}

/** DIR-04: sinflar bo'yicha o'zlashtirish reytingi. */
export interface ClassRankingEntry {
  className: string;
  averageGrade: number;
}

/** DIR-09 (qisman): to'lov yig'ilishi dinamikasi, oylar kesimida. */
export interface PaymentTrendPoint {
  monthLabel: string;
  collectedPercent: number;
}

export type AtRiskReason = "attendance" | "grades";

/** DIR-09: xavf ostidagi o'quvchilar — davomati past yoki bahosi keskin tushgan. */
export interface AtRiskStudent {
  id: string;
  fullName: string;
  className: string;
  reason: AtRiskReason;
  detail: string;
}

export interface DirectorReports {
  gradeDistribution: GradeDistributionBucket[];
  attendanceTrend: AttendanceTrendPoint[];
  subjectAverages: SubjectAveragePoint[];
  classRanking: ClassRankingEntry[];
  paymentTrend: PaymentTrendPoint[];
  atRiskStudents: AtRiskStudent[];
}

// ─────────────────────── Dars jadvali quruvchisi ───────────────────────

export const WEEKDAYS = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PERIOD_TIMES: Record<number, string> = {
  1: "08:30–09:10",
  2: "09:20–10:00",
  3: "10:10–10:50",
  4: "11:00–11:40",
  5: "12:10–12:50",
  6: "13:00–13:40",
  7: "13:50–14:30",
};

export interface LessonCell {
  subject: string;
  teacherId: string;
  room: string;
}

/** classId → kun → para raqami → dars (yoki boʻsh). */
export type ScheduleGrid = Record<string, Record<Weekday, Record<number, LessonCell | null>>>;
