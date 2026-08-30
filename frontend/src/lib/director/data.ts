/**
 * Rahbariyat kabineti uchun demo maʼlumotlar. Backend ulanganda shu fayl
 * `fetchers.ts` orqali real API chaqiruvlariga almashtiriladi.
 */
import type {
  AttendanceTrendPoint,
  ClassStudent,
  DirectorOverview,
  DirectorReports,
  LessonCell,
  OverviewPeriod,
  SchoolClass,
  ScheduleGrid,
  Teacher,
  TeacherStats,
  Weekday,
} from "@/lib/director/types";
import { WEEKDAYS } from "@/lib/director/types";
import { APPEALS, isOpen } from "@/lib/school/appeals";
import {
  allTeachers,
  homeroomClassOf,
  HOMEROOM,
  staffById,
  weeklyLoadOf,
} from "@/lib/school/staff";
import {
  ALL_STUDENTS,
  CLASSES,
  classAttendanceStat,
  contractSummary,
  financeSummary,
  schoolAttendance,
  studentsOfClass,
} from "@/lib/director/school-data";

export const DEMO_DIRECTOR = {
  fullName: "Nortojiyeva Malika Aʼzamovna",
  shortName: "M. Nortojiyeva",
  role: "Direktor",
};

export const SUBJECT_LIST = [
  "Matematika",
  "Algebra",
  "Geometriya",
  "Ona tili",
  "Adabiyot",
  "Fizika",
  "Kimyo",
  "Biologiya",
  "Tarix",
  "Ingliz tili",
  "Informatika",
  "Jismoniy tarbiya",
] as const;

/**
 * Ustozlar va sinflar QAYTA yozilmaydi — `lib/school/staff.ts` va
 * `school-data.ts` dan hosil qilinadi. Shu sabab rahbariyat koʻrgan
 * roʻyxat oʻquvchi/ota-ona koʻrgani bilan har doim bir xil boʻladi.
 */
export const teachers: Teacher[] = allTeachers().map((staff) => ({
  id: staff.id,
  fullName: staff.fullName,
  shortName: staff.shortName,
  subjects: staff.subjects,
  homeroomClassName: homeroomClassOf(staff.id),
  weeklyLoadHours: weeklyLoadOf(staff.id),
  status: staff.status,
  phone: staff.phone,
  email: staff.email,
  avatarInitials: staff.initials,
}));

export const schoolClasses: SchoolClass[] = CLASSES.map((cls) => {
  const students = studentsOfClass(cls.name);
  const homeroomId = HOMEROOM[cls.name] ?? null;
  return {
    id: cls.id,
    name: cls.name,
    stage: cls.stage,
    homeroomTeacherId: homeroomId,
    homeroomTeacherName: homeroomId ? (staffById(homeroomId)?.shortName ?? null) : null,
    studentCount: students.length,
    averageAttendance: classAttendanceStat(cls.name, "month").averagePercent,
    students: students.map<ClassStudent>((s) => ({
      id: s.id,
      fullName: s.fullName,
      // Davomati past oʻquvchi bugun kelmagan deb koʻrsatiladi (demo).
      status: s.attendanceWeek < 80 ? "absent_today" : "active",
    })),
  };
});

const TEACHER_STATS: Record<string, TeacherStats> = {
  "t-1": {
    averageGradeGiven: 4.8,
    attendanceMarkingRate: 98,
    lessonsConducted: 124,
    todayLessons: [
      { startTime: "08:30", className: "10-A", subject: "Algebra" },
      { startTime: "09:20", className: "10-A", subject: "Geometriya" },
    ],
  },
  "t-2": {
    averageGradeGiven: 4.5,
    attendanceMarkingRate: 95,
    lessonsConducted: 98,
    todayLessons: [{ startTime: "10:10", className: "9-B", subject: "Ona tili" }],
  },
  "t-3": {
    averageGradeGiven: 4.2,
    attendanceMarkingRate: 80,
    lessonsConducted: 61,
    todayLessons: [],
  },
  "t-4": {
    averageGradeGiven: 4.6,
    attendanceMarkingRate: 97,
    lessonsConducted: 110,
    todayLessons: [{ startTime: "11:00", className: "6-G", subject: "Ingliz tili" }],
  },
  "t-5": {
    averageGradeGiven: 4.4,
    attendanceMarkingRate: 93,
    lessonsConducted: 87,
    todayLessons: [{ startTime: "09:20", className: "9-B", subject: "Tarix" }],
  },
  "t-6": {
    averageGradeGiven: 4.7,
    attendanceMarkingRate: 96,
    lessonsConducted: 102,
    todayLessons: [{ startTime: "08:30", className: "5-A", subject: "Matematika" }],
  },
  "t-7": {
    averageGradeGiven: 4.9,
    attendanceMarkingRate: 99,
    lessonsConducted: 140,
    todayLessons: [{ startTime: "12:10", className: "11-V", subject: "Jismoniy tarbiya" }],
  },
  "t-8": {
    averageGradeGiven: 4.3,
    attendanceMarkingRate: 91,
    lessonsConducted: 75,
    todayLessons: [],
  },
};

/** Roʻyxatda yoʻq ustoz uchun barqaror (har safar bir xil) statistika. */
function fallbackStats(teacherId: string): TeacherStats {
  let seed = 0;
  for (let i = 0; i < teacherId.length; i += 1) seed = (seed * 31 + teacherId.charCodeAt(i)) >>> 0;
  return {
    averageGradeGiven: Math.round((4 + (seed % 10) / 10) * 10) / 10,
    attendanceMarkingRate: 85 + (seed % 15),
    lessonsConducted: 60 + (seed % 80),
    todayLessons: [],
  };
}

export function teacherStatsFor(teacherId: string): TeacherStats {
  return TEACHER_STATS[teacherId] ?? fallbackStats(teacherId);
}


/**
 * DIR-01/02: ochiq murojaatlar soni — barcha rollar uchun umumiy
 * `lib/school/appeals` dan hisoblanadi, qoʻlda takrorlanmaydi.
 */
const OPEN_REQUESTS_COUNT = APPEALS.filter(isOpen).length;

const MONTH_TREND: AttendanceTrendPoint[] = [
  { dateLabel: "01 Sen", percent: 90 },
  { dateLabel: "05 Sen", percent: 92 },
  { dateLabel: "10 Sen", percent: 89 },
  { dateLabel: "15 Sen", percent: 91 },
  { dateLabel: "20 Sen", percent: 93 },
  { dateLabel: "25 Sen", percent: 96 },
  { dateLabel: "30 Sen", percent: 94 },
];

const YEAR_TREND: AttendanceTrendPoint[] = [
  { dateLabel: "Sen", percent: 94 },
  { dateLabel: "Okt", percent: 92 },
  { dateLabel: "Noy", percent: 90 },
  { dateLabel: "Dek", percent: 87 },
  { dateLabel: "Yan", percent: 85 },
  { dateLabel: "Fev", percent: 88 },
  { dateLabel: "Mar", percent: 91 },
  { dateLabel: "Apr", percent: 93 },
  { dateLabel: "May", percent: 92 },
];

/** Oʻquv yili sentabrdan maygacha — 9 oy. */
const MONTHS_IN_YEAR = 9;

/**
 * Bosh sahifa koʻrsatkichlari. `period` — "month" (joriy oy) yoki
 * "year" (oʻquv yili boshidan). Moliyaviy raqamlar va shartnoma
 * harakati shu davr boʻyicha qayta hisoblanadi.
 */
export function buildOverview(period: OverviewPeriod): DirectorOverview {
  const months = period === "year" ? MONTHS_IN_YEAR : 1;
  const finance = financeSummary(months);
  const contracts = contractSummary(months);

  return {
    period,
    totalStudents: ALL_STUDENTS.length,
    studentGrowthPercent:
      contracts.startCount === 0
        ? 0
        : Math.round((contracts.net / contracts.startCount) * 1000) / 10,
    totalTeachers: teachers.filter((t) => t.status === "active").length,
    todayAttendancePercent: schoolAttendance("week"),
    averageGrade: 4.3,
    openRequestsCount: OPEN_REQUESTS_COUNT,
    revenue: finance.collected,
    expectedRevenue: finance.expected,
    debtAmount: finance.debt,
    debtPercent: finance.debtPercent,
    contracts,
    attendanceTrend: period === "year" ? YEAR_TREND : MONTH_TREND,
    alerts: [
      {
        id: "al-1",
        level: "danger",
        title: `Past davomat (${WORST_ATTENDANCE_CLASS.className} sinf)`,
        description: `Oʻrtacha davomat ${WORST_ATTENDANCE_CLASS.averagePercent}% — maktab boʻyicha eng past koʻrsatkich.`,
      },
      {
        id: "al-2",
        level: "info",
        title: "Toʻlov kechikishlari",
        description: `${finance.overdueCount} nafar oʻquvchining toʻlovi kechikmoqda, qarzdorlik ${finance.debtPercent}%.`,
      },
    ],
    announcements: [
      {
        id: "an-1",
        title: "Ota-onalar majlisi",
        body: "Ertaga soat 15:00 da barcha sinf rahbarlari uchun umumiy majlis boʻlib oʻtadi.",
        createdAtLabel: "Bugun, 09:30",
      },
      {
        id: "an-2",
        title: "Yangi oʻquv dasturi",
        body: "Oktabr oyidan boshlab informatika fanidan yangilangan dastur joriy etiladi.",
        createdAtLabel: "Kecha, 14:15",
      },
    ],
  };
}

/** Eng past davomatli sinf — ogohlantirish matni uchun. */
const WORST_ATTENDANCE_CLASS = CLASSES.map((c) => classAttendanceStat(c.name, "month")).sort(
  (a, b) => a.averagePercent - b.averagePercent,
)[0];

/**
 * DIR-04: sinflar boʻyicha oʻzlashtirish reytingi. Baho maʼlumoti hali
 * yoʻq, shuning uchun davomatga bogʻlangan barqaror taxminiy baho —
 * backend ulanganda `grades` jadvalidan olinadi.
 */
function estimatedGrade(attendancePercent: number): number {
  return Math.round((3.2 + (attendancePercent - 76) * 0.06) * 10) / 10;
}

export const reports: DirectorReports = {
  gradeDistribution: [
    { label: "2", count: 12 },
    { label: "3", count: 145 },
    { label: "4", count: 520 },
    { label: "5", count: 480 },
  ],
  attendanceTrend: MONTH_TREND,
  subjectAverages: [
    { subject: "Matematika", average: 4.2 },
    { subject: "Ona tili", average: 4.5 },
    { subject: "Fizika", average: 3.9 },
    { subject: "Ingliz tili", average: 4.4 },
    { subject: "Tarix", average: 4.3 },
  ],
  classRanking: CLASSES.map((cls) => ({
    className: cls.name,
    averageGrade: estimatedGrade(classAttendanceStat(cls.name, "month").averagePercent),
  })).sort((a, b) => b.averageGrade - a.averageGrade),
  paymentTrend: [
    { monthLabel: "Aprel", collectedPercent: 91 },
    { monthLabel: "May", collectedPercent: 88 },
    { monthLabel: "Iyun", collectedPercent: 94 },
    { monthLabel: "Avgust", collectedPercent: 90 },
    { monthLabel: "Sentabr", collectedPercent: 95 },
  ],
  // Davomati eng past 6 nafar — roʻyxat maʼlumotdan hosil qilinadi.
  atRiskStudents: [...ALL_STUDENTS]
    .sort((a, b) => a.attendanceMonth - b.attendanceMonth)
    .slice(0, 6)
    .map((s) => ({
      id: `risk-${s.id}`,
      fullName: s.fullName,
      className: s.className,
      reason: "attendance" as const,
      detail: `Oylik davomat: ${s.attendanceMonth}% (chegara: 85%)`,
    })),
};

// ─────────────────────── Boshlangʻich dars jadvali ───────────────────────

function slot(subject: string, teacherId: string, room: string): LessonCell {
  return { subject, teacherId, room };
}

function emptyWeek(): Record<Weekday, Record<number, LessonCell | null>> {
  const week = {} as Record<Weekday, Record<number, LessonCell | null>>;
  for (const day of WEEKDAYS) {
    week[day] = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null };
  }
  return week;
}

export function initialScheduleGrid(): ScheduleGrid {
  const grid: ScheduleGrid = {};
  for (const cls of schoolClasses) {
    grid[cls.id] = emptyWeek();
  }

  // 10-A uchun namunaviy toʻldirilgan jadval.
  grid["c-10a"]["Dushanba"][1] = slot("Algebra", "t-1", "204");
  grid["c-10a"]["Dushanba"][2] = slot("Geometriya", "t-1", "204");
  grid["c-10a"]["Dushanba"][3] = slot("Ona tili", "t-2", "108");
  grid["c-10a"]["Seshanba"][1] = slot("Fizika", "t-3", "312");
  grid["c-10a"]["Seshanba"][2] = slot("Ingliz tili", "t-4", "205");
  grid["c-10a"]["Chorshanba"][1] = slot("Algebra", "t-1", "204");
  grid["c-10a"]["Payshanba"][1] = slot("Jismoniy tarbiya", "t-7", "Sport zali");

  // 9-B uchun namunaviy jadval.
  grid["c-9b"]["Dushanba"][1] = slot("Tarix", "t-5", "110");
  grid["c-9b"]["Dushanba"][2] = slot("Ona tili", "t-2", "108");
  grid["c-9b"]["Seshanba"][1] = slot("Matematika", "t-6", "201");

  return grid;
}

export interface TeacherWeeklyLesson {
  className: string;
  subject: string;
  room: string;
}

/** Berilgan ustozning haftalik jadvali — barcha sinflar bo'yicha yig'ilgan. */
export function teacherWeeklySchedule(
  teacherId: string,
): Record<Weekday, Record<number, TeacherWeeklyLesson | null>> {
  const grid = initialScheduleGrid();
  const result = {} as Record<Weekday, Record<number, TeacherWeeklyLesson | null>>;
  for (const day of WEEKDAYS) {
    result[day] = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null };
    for (const period of [1, 2, 3, 4, 5, 6, 7]) {
      for (const cls of schoolClasses) {
        const cell = grid[cls.id]?.[day]?.[period];
        if (cell && cell.teacherId === teacherId) {
          result[day][period] = { className: cls.name, subject: cell.subject, room: cell.room };
        }
      }
    }
  }
  return result;
}

/** Ustoz dars beradigan sinflar ro'yxati (rahbarlik + jadvaldagi darslar). */
export function classesTaughtBy(teacherId: string): SchoolClass[] {
  const grid = initialScheduleGrid();
  const ids = new Set<string>();
  for (const cls of schoolClasses) {
    for (const day of WEEKDAYS) {
      for (const period of [1, 2, 3, 4, 5, 6, 7]) {
        if (grid[cls.id]?.[day]?.[period]?.teacherId === teacherId) {
          ids.add(cls.id);
        }
      }
    }
  }
  const homeroom = schoolClasses.find((c) => c.homeroomTeacherId === teacherId);
  if (homeroom) ids.add(homeroom.id);
  return schoolClasses.filter((c) => ids.has(c.id));
}

/**
 * Sinf rahbarini almashtiradi (DEMO — faqat client holatida, backend
 * ulanganda `PATCH /classes/{id}` chaqiradi). Bir ustoz bir vaqtda faqat
 * bitta sinfga rahbar bo'lishi mumkin — tanlangan ustoz allaqachon boshqa
 * sinfga rahbar bo'lsa, u yerdan avtomatik olib tashlanadi.
 */
export function reassignHomeroom(
  classesList: SchoolClass[],
  teachersList: Teacher[],
  classId: string,
  newTeacherId: string | null,
): { classes: SchoolClass[]; teachers: Teacher[] } {
  const newTeacherName = newTeacherId
    ? (teachersList.find((t) => t.id === newTeacherId)?.shortName ?? null)
    : null;

  const updatedClasses = classesList.map((cls) => {
    if (cls.id === classId) {
      return { ...cls, homeroomTeacherId: newTeacherId, homeroomTeacherName: newTeacherName };
    }
    if (newTeacherId && cls.homeroomTeacherId === newTeacherId) {
      return { ...cls, homeroomTeacherId: null, homeroomTeacherName: null };
    }
    return cls;
  });

  const updatedTeachers = teachersList.map((teacher) => ({
    ...teacher,
    homeroomClassName:
      updatedClasses.find((c) => c.homeroomTeacherId === teacher.id)?.name ?? null,
  }));

  return { classes: updatedClasses, teachers: updatedTeachers };
}
