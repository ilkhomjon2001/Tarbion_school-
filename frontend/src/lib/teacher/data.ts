/**
 * Demo maʼlumotlari.
 *
 * Backend (`backend/`) yozilmoqda, lekin demo bugun kerak. Shuning uchun
 * ekranlar shu yerdagi maʼlumot bilan ishlaydi. API ulanganda faqat shu
 * fayl va `store.ts` dagi yuklash funksiyalari almashtiriladi —
 * komponentlar oʻzgarmaydi.
 */

import type {
  AttendanceRow,
  HomeworkItem,
  SubmissionRow,
  TeacherLesson,
  TeacherProfile,
} from "@/lib/teacher/types";

export const DEMO_TEACHER: TeacherProfile = {
  id: "t-1",
  fullName: "Aliyev Sardor Baxtiyorovich",
  shortName: "Aliyev S.",
  roles: ["teacher", "homeroom_teacher"],
};

/** Demo uchun qatʼiy sana — skrinshot va taqdimot bir xil chiqishi uchun. */
export const DEMO_DATE = "2026-08-29";
export const DEMO_DATE_LABEL = "29-avgust, shanba";

export const DEMO_LESSONS: TeacherLesson[] = [
  {
    id: "l-1",
    date: DEMO_DATE,
    period: 1,
    startTime: "08:30",
    endTime: "09:15",
    className: "11-A",
    subject: "Matematika",
    room: "204-xona",
    studentCount: 12,
    topic: "",
    presentCount: null,
    editable: true,
  },
  {
    id: "l-2",
    date: DEMO_DATE,
    period: 2,
    startTime: "09:25",
    endTime: "10:10",
    className: "9-B",
    subject: "Matematika",
    room: "204-xona",
    studentCount: 10,
    topic: "",
    presentCount: null,
    editable: true,
  },
  {
    id: "l-3",
    date: DEMO_DATE,
    period: 4,
    startTime: "11:20",
    endTime: "12:05",
    className: "10-A",
    subject: "Geometriya",
    room: "301-xona",
    studentCount: 11,
    topic: "",
    presentCount: 10,
    editable: true,
  },
  {
    id: "l-4",
    date: DEMO_DATE,
    period: 6,
    startTime: "13:15",
    endTime: "14:00",
    className: "11-A",
    subject: "Algebra",
    room: "204-xona",
    studentCount: 12,
    topic: "",
    presentCount: 11,
    // DAV-03 ni koʻrsatish uchun: muddati tugagan dars.
    editable: false,
  },
];

const NAMES_11A = [
  "Abdullayev Alisher",
  "Azizova Barno",
  "Bekmurodova Dilnoza",
  "Botirov Jasur",
  "Choriyev Sanjar",
  "Davronov Temur",
  "Ergashev Sanjar",
  "Fayzullayeva Asal",
  "Gʻaniyev Murod",
  "Hasanov Bobur",
  "Islomova Nigina",
  "Jalilov Sardor",
];

const NAMES_9B = [
  "Aliyeva Malika",
  "Boymurodov Aziz",
  "Dadajonova Zilola",
  "Eshonov Shahzod",
  "Fozilov Otabek",
  "Gulomova Sevara",
  "Hamidov Javohir",
  "Ibrohimova Zarina",
  "Karimov Doniyor",
  "Latipova Mohira",
];

const NAMES_10A = [
  "Ahmedov Ulugʻbek",
  "Bahodirova Nilufar",
  "Doniyorov Sherzod",
  "Egamberdiyeva Aziza",
  "Farhodov Bekzod",
  "Gʻofurova Madina",
  "Hakimov Nodir",
  "Isroilova Kamola",
  "Jamolov Anvar",
  "Kamolova Dilfuza",
  "Mahmudov Sanjar",
];

const ROSTERS: Record<string, string[]> = {
  "11-A": NAMES_11A,
  "9-B": NAMES_9B,
  "10-A": NAMES_10A,
};

/** Dars uchun boshlangʻich davomat: sukut boʻyicha HAMMASI "keldi" (T-014). */
export function buildInitialRows(className: string): AttendanceRow[] {
  const names = ROSTERS[className] ?? NAMES_11A;
  return names.map((fullName, i) => ({
    studentId: `${className}-${i + 1}`,
    fullName,
    status: "present" as const,
    note: "",
  }));
}

export function findLesson(lessonId: string): TeacherLesson | undefined {
  return DEMO_LESSONS.find((l) => l.id === lessonId);
}

/** Muddati tugagan dars uchun oldindan belgilangan davomat. */
export const CLOSED_LESSON_ROWS: AttendanceRow[] = buildInitialRows("11-A").map(
  (row, i) =>
    i === 3
      ? { ...row, status: "absent" as const, note: "Sabab koʻrsatilmagan" }
      : row,
);

export const DEMO_HOMEWORK: HomeworkItem[] = [
  {
    id: "h-1",
    className: "11-A",
    subject: "Algebra",
    title: "Kvadrat tenglamalar — 5-mashq",
    description:
      "Darslikning 42-betidagi 1-8 masalalarni yeching. Har bir masalada diskriminant hisoblanishi koʻrsatilsin.",
    assignedAt: "2026-08-27",
    dueAt: "2026-08-30",
    maxScore: 5,
    totalCount: 12,
    submittedCount: 8,
    gradedCount: 3,
  },
  {
    id: "h-2",
    className: "9-B",
    subject: "Matematika",
    title: "Kasrlar ustida amallar",
    description: "Ish daftarining 18-19 betlari toʻliq bajarilsin.",
    assignedAt: "2026-08-28",
    dueAt: "2026-09-01",
    maxScore: 5,
    totalCount: 10,
    submittedCount: 4,
    gradedCount: 0,
  },
  {
    id: "h-3",
    className: "10-A",
    subject: "Geometriya",
    title: "Uchburchaklar tengligi — nazorat ishiga tayyorgarlik",
    description:
      "Uchburchaklar tengligining uchta alomatini isbot bilan yozing va har biriga bittadan misol keltiring.",
    assignedAt: "2026-08-25",
    dueAt: "2026-08-28",
    maxScore: 5,
    totalCount: 11,
    submittedCount: 11,
    gradedCount: 11,
  },
];

const SAMPLE_ANSWERS = [
  "Barcha masalalar yechildi. 6-masalada diskriminant manfiy chiqdi, shuning uchun haqiqiy ildiz yoʻq deb yozdim.",
  "1-7 masalalarni yechdim. 8-masalani tushunmadim, tushuntirib bersangiz.",
  "Vazifa toʻliq bajarildi, javoblar daftarda rasmga olingan.",
  "Diskriminant formulasini qoʻllab hammasini yechdim.",
];

export function buildSubmissions(homework: HomeworkItem): SubmissionRow[] {
  const names = ROSTERS[homework.className] ?? NAMES_11A;
  return names.map((fullName, i) => {
    const submitted = i < homework.submittedCount;
    const graded = i < homework.gradedCount;
    const late = submitted && i === 2;

    return {
      id: `${homework.id}-s${i + 1}`,
      studentId: `${homework.className}-${i + 1}`,
      fullName,
      status: graded
        ? ("graded" as const)
        : late
          ? ("late" as const)
          : submitted
            ? ("submitted" as const)
            : ("assigned" as const),
      submittedAt: submitted ? "2026-08-28 19:42" : null,
      answerText: submitted ? SAMPLE_ANSWERS[i % SAMPLE_ANSWERS.length] : null,
      attachmentName: submitted && i % 3 === 0 ? "vazifa.jpg" : null,
      score: graded ? [5, 4, 5, 3, 4, 5, 4, 5, 4, 5, 3][i % 11] : null,
      teacherComment: graded ? "Yaxshi bajarilgan." : null,
    };
  });
}

export function findHomework(id: string): HomeworkItem | undefined {
  return DEMO_HOMEWORK.find((h) => h.id === id);
}
