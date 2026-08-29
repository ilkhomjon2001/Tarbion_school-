import type {
  Announcement,
  AttendanceSummary,
  GradeEntry,
  Homework,
  ScheduleEntry,
  Student,
  SubjectGradeSummary,
  TestItem,
} from "@/lib/types";

export const currentStudent: Student = {
  id: "std-1",
  fullName: "Aziza Karimova",
  className: "8-A",
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
    ],
  },
];

export const subjectGrades: SubjectGradeSummary[] = [
  {
    subject: "Matematika",
    average: 4.6,
    entries: [
      { id: "g1", subject: "Matematika", date: "2026-08-10", type: "joriy", value: 5 },
      { id: "g2", subject: "Matematika", date: "2026-08-17", type: "joriy", value: 4 },
      { id: "g3", subject: "Matematika", date: "2026-08-24", type: "nazorat", value: 5 },
    ] as GradeEntry[],
  },
  {
    subject: "Ona tili",
    average: 4.3,
    entries: [
      { id: "g4", subject: "Ona tili", date: "2026-08-12", type: "joriy", value: 4 },
      { id: "g5", subject: "Ona tili", date: "2026-08-19", type: "joriy", value: 5 },
      { id: "g6", subject: "Ona tili", date: "2026-08-26", type: "joriy", value: 4 },
    ] as GradeEntry[],
  },
  {
    subject: "Fizika",
    average: 4.0,
    entries: [
      { id: "g7", subject: "Fizika", date: "2026-08-14", type: "joriy", value: 4 },
      { id: "g8", subject: "Fizika", date: "2026-08-21", type: "nazorat", value: 4 },
    ] as GradeEntry[],
  },
  {
    subject: "Tarix",
    average: 3.5,
    entries: [
      { id: "g9", subject: "Tarix", date: "2026-08-11", type: "joriy", value: 3 },
      { id: "g10", subject: "Tarix", date: "2026-08-25", type: "joriy", value: 4 },
    ] as GradeEntry[],
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
