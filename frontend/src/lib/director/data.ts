/**
 * Rahbariyat kabineti uchun demo maʼlumotlar. Backend ulanganda shu fayl
 * `fetchers.ts` orqali real API chaqiruvlariga almashtiriladi.
 */
import type {
  ClassStudent,
  DirectorOverview,
  DirectorReports,
  LessonCell,
  ParentRequest,
  PaymentRecord,
  SchoolClass,
  ScheduleGrid,
  Teacher,
  TeacherStats,
  Weekday,
} from "@/lib/director/types";
import { WEEKDAYS } from "@/lib/director/types";

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

type RawTeacher = Omit<Teacher, "homeroomClassName">;

const RAW_TEACHERS: RawTeacher[] = [
  {
    id: "t-1",
    fullName: "Anvarov Jamshid Odilovich",
    shortName: "J. Anvarov",
    subjects: ["Matematika", "Algebra"],
    weeklyLoadHours: 24,
    status: "active",
    phone: "+998 90 111 22 33",
    email: "jamshid@tarbion.uz",
    avatarInitials: "JA",
  },
  {
    id: "t-2",
    fullName: "Karimova Nargiza Yusupovna",
    shortName: "N. Karimova",
    subjects: ["Ona tili", "Adabiyot"],
    weeklyLoadHours: 18,
    status: "active",
    phone: "+998 91 222 33 44",
    email: "nargiza@tarbion.uz",
    avatarInitials: "NK",
  },
  {
    id: "t-3",
    fullName: "Toshmatov Botir Rahimovich",
    shortName: "B. Toshmatov",
    subjects: ["Fizika"],
    weeklyLoadHours: 20,
    status: "archived",
    phone: "+998 93 333 44 55",
    email: "botir@tarbion.uz",
    avatarInitials: "BT",
  },
  {
    id: "t-4",
    fullName: "Aliyeva Nigora Sobirovna",
    shortName: "N. Aliyeva",
    subjects: ["Ingliz tili"],
    weeklyLoadHours: 22,
    status: "active",
    phone: "+998 94 444 55 66",
    email: "nigora@tarbion.uz",
    avatarInitials: "NA",
  },
  {
    id: "t-5",
    fullName: "Rahimov Dilshod Ergashevich",
    shortName: "D. Rahimov",
    subjects: ["Tarix"],
    weeklyLoadHours: 19,
    status: "active",
    phone: "+998 97 555 66 77",
    email: "dilshod@tarbion.uz",
    avatarInitials: "DR",
  },
  {
    id: "t-6",
    fullName: "Karimova Aziza Baxtiyorovna",
    shortName: "A. Karimova",
    subjects: ["Matematika", "Informatika"],
    weeklyLoadHours: 21,
    status: "active",
    phone: "+998 90 666 77 88",
    email: "aziza@tarbion.uz",
    avatarInitials: "AK",
  },
  {
    id: "t-7",
    fullName: "Sobirov Jasur Nabiyevich",
    shortName: "J. Sobirov",
    subjects: ["Jismoniy tarbiya"],
    weeklyLoadHours: 26,
    status: "active",
    phone: "+998 99 777 88 99",
    email: "jasur@tarbion.uz",
    avatarInitials: "JS",
  },
  {
    id: "t-8",
    fullName: "Yusupova Malika Farxodovna",
    shortName: "M. Yusupova",
    subjects: ["Kimyo", "Biologiya"],
    weeklyLoadHours: 17,
    status: "active",
    phone: "+998 88 888 99 00",
    email: "malika@tarbion.uz",
    avatarInitials: "MY",
  },
];

const CLASS_ROSTER_NAMES: Record<string, string[]> = {
  "5-A": ["Alisher Usmonov", "Malika Nortojiyeva", "Sardor Rahimov", "Zilola Karimova"],
  "6-G": ["Diyorbek Toshpulatov", "Nodira Ergasheva", "Aziz Sultonov"],
  "9-B": ["Alisher Usmonov", "Madina Nazarova", "Sherzod Rustamov"],
  "10-A": ["Kamola Yoqubova", "Otabek Zokirov", "Feruza Islomova"],
  "11-B": ["Jaloliddin Mirzayev", "Sevinch Qodirova"],
  "11-V": ["Ravshan Abdullayev", "Gulbahor Nematova", "Sanjar Yusupov"],
};

function buildRoster(className: string, absentIndex?: number): ClassStudent[] {
  const names = CLASS_ROSTER_NAMES[className] ?? [];
  return names.map((fullName, i) => ({
    id: `${className}-s${i + 1}`,
    fullName,
    status: i === absentIndex ? "absent_today" : "active",
  }));
}

type RawClass = Omit<SchoolClass, "homeroomTeacherName">;

const RAW_CLASSES: RawClass[] = [
  {
    id: "c-5a",
    name: "5-A",
    stage: "boshlangʻich",
    homeroomTeacherId: "t-6",
    studentCount: 24,
    averageAttendance: 96,
    students: buildRoster("5-A"),
  },
  {
    id: "c-6g",
    name: "6-G",
    stage: "boshlangʻich",
    homeroomTeacherId: "t-4",
    studentCount: 26,
    averageAttendance: 94,
    students: buildRoster("6-G"),
  },
  {
    id: "c-9b",
    name: "9-B",
    stage: "oʻrta",
    homeroomTeacherId: "t-5",
    studentCount: 28,
    averageAttendance: 92,
    students: buildRoster("9-B", 2),
  },
  {
    id: "c-10a",
    name: "10-A",
    stage: "yuqori",
    homeroomTeacherId: "t-1",
    studentCount: 21,
    averageAttendance: 98,
    students: buildRoster("10-A"),
  },
  {
    id: "c-11b",
    name: "11-B",
    stage: "yuqori",
    homeroomTeacherId: "t-3",
    studentCount: 19,
    averageAttendance: 82,
    students: buildRoster("11-B"),
  },
  {
    id: "c-11v",
    name: "11-V",
    stage: "yuqori",
    homeroomTeacherId: "t-7",
    studentCount: 20,
    averageAttendance: 88,
    students: buildRoster("11-V", 1),
  },
];

/**
 * `homeroomTeacherId` — yagona manba. Ikkala tomonning koʻrsatish uchun
 * qulay maydonlari (`homeroomTeacherName`, `homeroomClassName`) shundan
 * hisoblanadi, shuning uchun ular hech qachon bir-biridan uzilib qolmaydi.
 */
export const schoolClasses: SchoolClass[] = RAW_CLASSES.map((cls) => ({
  ...cls,
  homeroomTeacherName:
    RAW_TEACHERS.find((t) => t.id === cls.homeroomTeacherId)?.shortName ?? null,
}));

export const teachers: Teacher[] = RAW_TEACHERS.map((teacher) => ({
  ...teacher,
  homeroomClassName:
    RAW_CLASSES.find((c) => c.homeroomTeacherId === teacher.id)?.name ?? null,
}));

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

export function teacherStatsFor(teacherId: string): TeacherStats {
  return (
    TEACHER_STATS[teacherId] ?? {
      averageGradeGiven: 0,
      attendanceMarkingRate: 0,
      lessonsConducted: 0,
      todayLessons: [],
    }
  );
}

export const overview: DirectorOverview = {
  totalStudents: 1420,
  studentGrowthPercent: 2.4,
  totalTeachers: teachers.filter((t) => t.status === "active").length,
  todayAttendancePercent: 94,
  monthlyRevenue: 245_000_000,
  revenueVsPlanPercent: 5,
  attendanceTrend: [
    { dateLabel: "01 Sen", percent: 90 },
    { dateLabel: "05 Sen", percent: 92 },
    { dateLabel: "10 Sen", percent: 89 },
    { dateLabel: "15 Sen", percent: 91 },
    { dateLabel: "20 Sen", percent: 93 },
    { dateLabel: "25 Sen", percent: 96 },
    { dateLabel: "30 Sen", percent: 94 },
  ],
  alerts: [
    {
      id: "al-1",
      level: "danger",
      title: "Past davomat (11-B sinf)",
      description: "Ushbu hafta davomat koʻrsatkichi 82% ga tushib ketdi.",
    },
    {
      id: "al-2",
      level: "info",
      title: "Toʻlov kechikishlari",
      description: "12 nafar oʻquvchining sentabr oyi toʻlovi kechikmoqda.",
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

export const payments: PaymentRecord[] = [
  { id: "p-1", studentFullName: "Alisher Usmonov", className: "9-B", amount: 3_500_000, dueDate: "2026-09-05", status: "paid" },
  { id: "p-2", studentFullName: "Madina Nazarova", className: "9-B", amount: 3_500_000, dueDate: "2026-08-25", status: "overdue" },
  { id: "p-3", studentFullName: "Kamola Yoqubova", className: "10-A", amount: 4_000_000, dueDate: "2026-09-05", status: "paid" },
  { id: "p-4", studentFullName: "Jaloliddin Mirzayev", className: "11-B", amount: 4_000_000, dueDate: "2026-08-20", status: "overdue" },
  { id: "p-5", studentFullName: "Diyorbek Toshpulatov", className: "6-G", amount: 3_000_000, dueDate: "2026-09-05", status: "partial" },
  { id: "p-6", studentFullName: "Ravshan Abdullayev", className: "11-V", amount: 4_000_000, dueDate: "2026-09-05", status: "paid" },
];

export const parentRequests: ParentRequest[] = [
  {
    id: "r-1",
    parentName: "Nortojiyev Sherzod",
    studentFullName: "Malika Nortojiyeva",
    className: "5-A",
    subject: "Ovqatlanish narxi haqida",
    message: "Oshxona narxlari qachondan oshadi, oldindan xabar berilsinmi?",
    createdAt: "2026-08-29 08:10",
    status: "new",
    replies: [],
  },
  {
    id: "r-2",
    parentName: "Nazarova Gulbahor",
    studentFullName: "Madina Nazarova",
    className: "9-B",
    subject: "Toʻlov kechikishi",
    message: "Sentabr toʻlovini 5 kunga kechiktirish mumkinmi?",
    createdAt: "2026-08-28 17:45",
    status: "in_progress",
    replies: [
      {
        id: "r-2-1",
        author: "maktab",
        text: "Assalomu alaykum! Bu masalani buxgalteriya bilan aniqlashtirib, bugun kuningizda javob beramiz.",
        createdAt: "2026-08-28 18:05",
      },
    ],
  },
  {
    id: "r-3",
    parentName: "Mirzayev Aziz",
    studentFullName: "Jaloliddin Mirzayev",
    className: "11-B",
    subject: "Dars jadvali",
    message: "Farzandimning payshanba kungi jadvali juda zich, koʻrib chiqsangiz.",
    createdAt: "2026-08-26 11:20",
    status: "closed",
    replies: [
      {
        id: "r-3-1",
        author: "maktab",
        text: "Payshanba kungi jadval qayta koʻrib chiqildi, endi bir para kamaytirildi.",
        createdAt: "2026-08-26 15:30",
      },
      {
        id: "r-3-2",
        author: "ota-ona",
        text: "Rahmat, yordamingiz uchun!",
        createdAt: "2026-08-26 16:00",
      },
    ],
  },
];

export const reports: DirectorReports = {
  gradeDistribution: [
    { label: "2", count: 12 },
    { label: "3", count: 145 },
    { label: "4", count: 520 },
    { label: "5", count: 480 },
  ],
  attendanceTrend: overview.attendanceTrend,
  subjectAverages: [
    { subject: "Matematika", average: 4.2 },
    { subject: "Ona tili", average: 4.5 },
    { subject: "Fizika", average: 3.9 },
    { subject: "Ingliz tili", average: 4.4 },
    { subject: "Tarix", average: 4.3 },
  ],
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
