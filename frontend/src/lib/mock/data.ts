import { computeWeightedAverage } from "@/lib/grades";
import type {
  Announcement,
  AttendanceSummary,
  ClassmateStat,
  GradeEntry,
  Homework,
  NotificationPreferences,
  ScheduleEntry,
  Student,
  SubjectGradeSummary,
  TestItem,
} from "@/lib/types";

export const currentStudent: Student = {
  id: "std-1",
  fullName: "Aziza Karimova",
  className: "8-A",
  phone: "+998 90 123 45 67",
  email: "aziza.karimova@example.com",
};

export const notificationPreferences: NotificationPreferences = {
  newGrade: true,
  homeworkReminder: true,
  announcements: true,
};

export const scheduleEntries: ScheduleEntry[] = [
  { id: "sch-1", dayOfWeek: 1, periodNumber: 1, startTime: "08:30", endTime: "09:15", subject: "Matematika", teacherName: "Dilnoza Yusupova", room: "204" },
  { id: "sch-2", dayOfWeek: 1, periodNumber: 2, startTime: "09:25", endTime: "10:10", subject: "Ona tili", teacherName: "Shoira Nabiyeva", room: "112" },
  { id: "sch-3", dayOfWeek: 1, periodNumber: 3, startTime: "10:20", endTime: "11:05", subject: "Fizika", teacherName: "Bahodir Rashidov", room: "301" },
  { id: "sch-4", dayOfWeek: 2, periodNumber: 1, startTime: "08:30", endTime: "09:15", subject: "Ingliz tili", teacherName: "Kamola Tosheva", room: "108" },
  { id: "sch-5", dayOfWeek: 2, periodNumber: 2, startTime: "09:25", endTime: "10:10", subject: "Matematika", teacherName: "Dilnoza Yusupova", room: "204" },
  { id: "sch-6", dayOfWeek: 2, periodNumber: 3, startTime: "10:20", endTime: "11:05", subject: "Tarix", teacherName: "Otabek Qodirov", room: "205" },
  { id: "sch-7", dayOfWeek: 3, periodNumber: 1, startTime: "08:30", endTime: "09:15", subject: "Kimyo", teacherName: "Nilufar Ergasheva", room: "302" },
  { id: "sch-8", dayOfWeek: 3, periodNumber: 2, startTime: "09:25", endTime: "10:10", subject: "Ona tili", teacherName: "Shoira Nabiyeva", room: "112" },
  { id: "sch-9", dayOfWeek: 4, periodNumber: 1, startTime: "08:30", endTime: "09:15", subject: "Matematika", teacherName: "Dilnoza Yusupova", room: "204" },
  { id: "sch-10", dayOfWeek: 4, periodNumber: 2, startTime: "09:25", endTime: "10:10", subject: "Jismoniy tarbiya", teacherName: "Sardor Aliyev", room: "Sport zali" },
  { id: "sch-11", dayOfWeek: 5, periodNumber: 1, startTime: "08:30", endTime: "09:15", subject: "Fizika", teacherName: "Bahodir Rashidov", room: "301" },
  { id: "sch-12", dayOfWeek: 5, periodNumber: 2, startTime: "09:25", endTime: "10:10", subject: "Ingliz tili", teacherName: "Kamola Tosheva", room: "108" },
];

export const todayLessons = [
  { id: "les-1", periodNumber: 1, startTime: "08:30", endTime: "09:15", subject: "Matematika", teacherName: "Dilnoza Yusupova", room: "204" },
  { id: "les-2", periodNumber: 2, startTime: "09:25", endTime: "10:10", subject: "Ona tili", teacherName: "Shoira Nabiyeva", room: "112" },
  { id: "les-3", periodNumber: 3, startTime: "10:20", endTime: "11:05", subject: "Fizika", teacherName: "Bahodir Rashidov", room: "301" },
];

export const homeworkList: Homework[] = [
  {
    id: "hw-1",
    subject: "Matematika",
    teacherName: "Dilnoza Yusupova",
    title: "Kvadrat tenglamalar",
    description: "Darslikdagi 45-betdagi 1-10 misollarni yeching.",
    assignedDate: "2026-08-25",
    dueDate: "2026-08-30",
    status: "assigned",
  },
  {
    id: "hw-2",
    subject: "Ona tili",
    teacherName: "Shoira Nabiyeva",
    title: "Insho: \"Mening orzuim\"",
    description: "Kamida 150 soʻzdan iborat insho yozing.",
    assignedDate: "2026-08-24",
    dueDate: "2026-08-29",
    status: "submitted",
    submissionText:
      "Mening orzuim shifokor boʻlish. Bolaligimdan buyon odamlarga yordam " +
      "berishni yaxshi koʻraman. Shu sababli tibbiyot institutiga kirish uchun " +
      "tayyorgarlik koʻryapman va biologiya hamda kimyo fanlariga koʻproq vaqt " +
      "ajratyapman...",
  },
  {
    id: "hw-3",
    subject: "Fizika",
    teacherName: "Bahodir Rashidov",
    title: "Nyuton qonunlari",
    description: "1-3 qonunlar boʻyicha savollarga yozma javob tayyorlang.",
    assignedDate: "2026-08-20",
    dueDate: "2026-08-27",
    status: "graded",
    grade: 5,
    teacherComment: "Barcha savollarga toʻliq va aniq javob berilgan.",
    submissionText:
      "1-qonun: Kuch taʼsir etmasa, jism tinch holatda yoki toʻgʻri chiziqli " +
      "tekis harakatda qoladi. 2-qonun: F=ma. 3-qonun: Har bir taʼsirga teng va " +
      "qarama-qarshi aks taʼsir mavjud.",
  },
  {
    id: "hw-4",
    subject: "Tarix",
    teacherName: "Otabek Qodirov",
    title: "Mustaqillik davri",
    description: "Mavzu boʻyicha referat tayyorlang.",
    assignedDate: "2026-08-18",
    dueDate: "2026-08-25",
    status: "late",
  },
  {
    id: "hw-5",
    subject: "Kimyo",
    teacherName: "Nilufar Ergasheva",
    title: "Davriy jadval",
    description: "Birinchi 20 elementni yod oling.",
    assignedDate: "2026-08-26",
    dueDate: "2026-09-02",
    status: "assigned",
  },
];

export const testList: TestItem[] = [
  {
    id: "test-1",
    subject: "Matematika",
    title: "Kvadrat tenglamalar — nazorat testi",
    durationMinutes: 15,
    passScore: 60,
    attemptsAllowed: 2,
    attemptsUsed: 0,
    questions: [
      {
        id: "q1",
        text: "x² − 5x + 6 = 0 tenglamaning ildizlari yigʻindisi nechaga teng?",
        type: "single",
        options: [
          { id: "a", text: "5" },
          { id: "b", text: "6" },
          { id: "c", text: "-5" },
          { id: "d", text: "1" },
        ],
        correctOptionIds: ["a"],
      },
      {
        id: "q2",
        text: "Quyidagilardan qaysilari toʻgʻri kvadrat tenglama koʻrinishi? (bir nechtasini belgilang)",
        type: "multiple",
        options: [
          { id: "a", text: "ax² + bx + c = 0, a ≠ 0" },
          { id: "b", text: "ax + b = 0" },
          { id: "c", text: "x² = 9" },
          { id: "d", text: "2x³ + 1 = 0" },
        ],
        correctOptionIds: ["a", "c"],
      },
      {
        id: "q3",
        text: "Diskriminant manfiy boʻlsa, tenglama nechta haqiqiy ildizga ega?",
        type: "single",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "1" },
          { id: "c", text: "0" },
          { id: "d", text: "Cheksiz" },
        ],
        correctOptionIds: ["c"],
      },
    ],
  },
  {
    id: "test-2",
    subject: "Ingliz tili",
    title: "Present Perfect — mavzu testi",
    durationMinutes: 10,
    passScore: 70,
    attemptsAllowed: 3,
    attemptsUsed: 1,
    lastScore: 83,
    questions: [
      {
        id: "q1",
        text: "She ___ (finish) her homework already.",
        type: "single",
        options: [
          { id: "a", text: "has finished" },
          { id: "b", text: "finished" },
          { id: "c", text: "finish" },
          { id: "d", text: "is finishing" },
        ],
        correctOptionIds: ["a"],
      },
      {
        id: "q2",
        text: "Present Perfect bilan koʻp ishlatiladigan soʻzlar qaysilar?",
        type: "multiple",
        options: [
          { id: "a", text: "already" },
          { id: "b", text: "yesterday" },
          { id: "c", text: "just" },
          { id: "d", text: "yet" },
        ],
        correctOptionIds: ["a", "c", "d"],
      },
      {
        id: "q3",
        text: "Feʼllarni toʻgʻri Past Participle shakli bilan moslashtiring.",
        type: "matching",
        options: [
          { id: "a", text: "go" },
          { id: "b", text: "see" },
          { id: "c", text: "eat" },
        ],
        correctOptionIds: [],
        matchTargets: [
          { id: "t1", text: "eaten" },
          { id: "t2", text: "gone" },
          { id: "t3", text: "seen" },
        ],
        correctMatches: { a: "t2", b: "t3", c: "t1" },
      },
    ],
  },
  {
    id: "test-3",
    subject: "Tarix",
    title: "Mustaqillik davri — yakuniy test",
    durationMinutes: 20,
    passScore: 60,
    attemptsAllowed: 1,
    attemptsUsed: 1,
    lastScore: 45,
    questions: [
      {
        id: "q1",
        text: "Oʻzbekiston mustaqilligi qachon eʼlon qilingan?",
        type: "single",
        options: [
          { id: "a", text: "1990-yil 20-iyun" },
          { id: "b", text: "1991-yil 1-sentabr" },
          { id: "c", text: "1992-yil 8-dekabr" },
          { id: "d", text: "1989-yil 21-oktabr" },
        ],
        correctOptionIds: ["b"],
      },
      {
        id: "q2",
        text: "Mustaqillik yillaridagi eng muhim islohotlardan birini qisqacha tavsiflab bering.",
        type: "open",
        options: [],
        correctOptionIds: [],
        sampleAnswer:
          "Masalan: milliy valyuta — soʻmning joriy etilishi (1994) yoki taʼlim tizimidagi islohotlar.",
      },
    ],
  },
];

const matematikaEntries: GradeEntry[] = [
  {
    id: "g1",
    subject: "Matematika",
    date: "2026-08-10",
    type: "joriy",
    value: 5,
    teacherName: "Dilnoza Yusupova",
    comment: "Kvadrat tenglamalarni yechishda barcha qadamlar toʻgʻri koʻrsatilgan.",
  },
  {
    id: "g2",
    subject: "Matematika",
    date: "2026-08-17",
    type: "joriy",
    value: 4,
    teacherName: "Dilnoza Yusupova",
    comment: "Yechim toʻgʻri, lekin oxirgi misolda hisoblash xatosi bor edi.",
  },
  {
    id: "g3",
    subject: "Matematika",
    date: "2026-08-24",
    type: "nazorat",
    value: 5,
    teacherName: "Dilnoza Yusupova",
    comment: "Nazorat ishi aʼlo darajada bajarilgan.",
  },
];

const onaTiliEntries: GradeEntry[] = [
  {
    id: "g4",
    subject: "Ona tili",
    date: "2026-08-12",
    type: "joriy",
    value: 4,
    teacherName: "Shoira Nabiyeva",
    comment: "Insho mavzuga mos, ammo imlo xatolari uchrayapti.",
  },
  {
    id: "g5",
    subject: "Ona tili",
    date: "2026-08-19",
    type: "joriy",
    value: 5,
    teacherName: "Shoira Nabiyeva",
    comment: "Ijodiy fikrlash va uslub aʼlo baholandi.",
  },
  {
    id: "g6",
    subject: "Ona tili",
    date: "2026-08-26",
    type: "joriy",
    value: 4,
    teacherName: "Shoira Nabiyeva",
    comment: "Matn tuzilishi yaxshilangan, davom eting.",
  },
];

const fizikaEntries: GradeEntry[] = [
  {
    id: "g7",
    subject: "Fizika",
    date: "2026-08-14",
    type: "joriy",
    value: 4,
    teacherName: "Bahodir Rashidov",
    comment: "Formulalarni qoʻllash toʻgʻri, tushuntirish yetarli.",
  },
  {
    id: "g8",
    subject: "Fizika",
    date: "2026-08-21",
    type: "nazorat",
    value: 4,
    teacherName: "Bahodir Rashidov",
    comment: "Nazorat ishida asosiy formulalar toʻgʻri qoʻllangan.",
  },
  {
    id: "g11",
    subject: "Fizika",
    date: "2026-08-27",
    type: "joriy",
    value: 5,
    teacherName: "Bahodir Rashidov",
    comment: "Barcha savollarga toʻliq va aniq javob berilgan.",
    homeworkId: "hw-3",
  },
];

const tarixEntries: GradeEntry[] = [
  {
    id: "g9",
    subject: "Tarix",
    date: "2026-08-11",
    type: "joriy",
    value: 3,
    teacherName: "Otabek Qodirov",
    comment: "Sanalarni aniqroq yodlash kerak, tahlil qismi yaxshi.",
  },
  {
    id: "g10",
    subject: "Tarix",
    date: "2026-08-25",
    type: "joriy",
    value: 4,
    teacherName: "Otabek Qodirov",
    comment: "Oldingi baholardan yaxshilanish sezilyapti, davom eting.",
  },
];

/**
 * Har bir fanning oʻrtachasi endi qoʻlda kiritilmaydi — JUR-04 talabiga
 * mos ravishda vaznlar asosida (grades.ts) avtomatik hisoblanadi.
 */
export const subjectGrades: SubjectGradeSummary[] = [
  {
    subject: "Matematika",
    average: computeWeightedAverage(matematikaEntries),
    entries: matematikaEntries,
  },
  {
    subject: "Ona tili",
    average: computeWeightedAverage(onaTiliEntries),
    entries: onaTiliEntries,
  },
  {
    subject: "Fizika",
    average: computeWeightedAverage(fizikaEntries),
    entries: fizikaEntries,
  },
  {
    subject: "Tarix",
    average: computeWeightedAverage(tarixEntries),
    entries: tarixEntries,
  },
];

export const attendanceSummary: AttendanceSummary = {
  monthLabel: "Avgust 2026",
  percentPresent: 92,
  days: [
    { date: "2026-08-03", status: "present" },
    { date: "2026-08-04", status: "present" },
    { date: "2026-08-05", status: "present" },
    { date: "2026-08-06", status: "late", subject: "Matematika" },
    { date: "2026-08-07", status: "present" },
    { date: "2026-08-10", status: "present" },
    { date: "2026-08-11", status: "excused" },
    { date: "2026-08-12", status: "present" },
    { date: "2026-08-13", status: "present" },
    { date: "2026-08-14", status: "present" },
    { date: "2026-08-17", status: "present" },
    { date: "2026-08-18", status: "absent" },
    { date: "2026-08-19", status: "present" },
    { date: "2026-08-20", status: "present" },
    { date: "2026-08-21", status: "present" },
    { date: "2026-08-24", status: "present" },
    { date: "2026-08-25", status: "present" },
    { date: "2026-08-26", status: "present" },
    { date: "2026-08-27", status: "present" },
    { date: "2026-08-28", status: "present" },
  ],
};

export const announcements: Announcement[] = [
  {
    id: "ann-1",
    title: "1-sentabr — Bilimlar kuni tantanasi",
    body: "1-sentabr kuni soat 08:00 da maktab hovlisida umumiy tantanali marosim boʻlib oʻtadi. Barcha oʻquvchilar maktab formasida kelishlari soʻraladi.",
    publishedAt: "2026-08-27",
    audience: "school",
  },
  {
    id: "ann-2",
    title: "8-A sinf uchun ota-onalar yigʻilishi",
    body: "5-sentabr kuni soat 18:00 da 112-xonada ota-onalar yigʻilishi oʻtkaziladi.",
    publishedAt: "2026-08-26",
    audience: "class",
  },
  {
    id: "ann-3",
    title: "Kutubxona ish vaqti oʻzgardi",
    body: "Yangi oʻquv yilidan boshlab maktab kutubxonasi 08:00 dan 17:00 gacha ishlaydi.",
    publishedAt: "2026-08-24",
    audience: "school",
  },
];

export const classmateStats: ClassmateStat[] = [
  { studentId: "std-2", fullName: "Sardor Umarov", averageGrade: 4.8, attendancePercent: 98 },
  { studentId: "std-3", fullName: "Madina Yusupova", averageGrade: 4.7, attendancePercent: 96 },
  { studentId: "std-4", fullName: "Javlon Rashidov", averageGrade: 4.5, attendancePercent: 94 },
  { studentId: "std-5", fullName: "Kamila Tosheva", averageGrade: 4.4, attendancePercent: 97 },
  {
    studentId: currentStudent.id,
    fullName: currentStudent.fullName,
    averageGrade:
      Math.round(
        (subjectGrades.reduce((sum, s) => sum + s.average, 0) / subjectGrades.length) * 10,
      ) / 10,
    attendancePercent: attendanceSummary.percentPresent,
  },
  { studentId: "std-6", fullName: "Sanjar Ibragimov", averageGrade: 4.0, attendancePercent: 90 },
  { studentId: "std-7", fullName: "Nodira Xolova", averageGrade: 3.9, attendancePercent: 88 },
  { studentId: "std-8", fullName: "Bekzod Nazarov", averageGrade: 3.8, attendancePercent: 85 },
  { studentId: "std-9", fullName: "Dilshod Aminov", averageGrade: 3.6, attendancePercent: 82 },
  { studentId: "std-10", fullName: "Zarina Saidova", averageGrade: 3.4, attendancePercent: 80 },
];
