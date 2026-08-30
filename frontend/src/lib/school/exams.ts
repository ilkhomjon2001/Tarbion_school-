/**
 * Imtihonlar — YAGONA manba.
 *
 * Oʻquv boʻlimi imtihon eʼlon qiladi va natijasini kiritadi; ustoz, oʻquvchi,
 * ota-ona va rahbariyat aynan shu roʻyxatni oʻqiydi. Ustoz KPI sidagi
 * «oylik imtihon natijasi» ham shu yerdan chiqadi — alohida son toʻqilmaydi.
 *
 * Backend ulanganda `exams` + `exam_results` jadvallari. Natija oʻzgarishi
 * `audit_log` ga tushishi shart (CLAUDE.md 4-qoida) — baho bilan bir xil
 * darajadagi maʼlumot.
 */

import { ALL_STUDENTS, CLASSES, type StudentRecord } from "@/lib/director/school-data";
import { subjectTeachersOf } from "@/lib/school/staff";

/** Barqaror xesh. `>>>` shart — `>>` manfiy indeks beradi. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1));
}

export type ExamKind = "oylik" | "chorak" | "yakuniy" | "sinov";

export const EXAM_KIND_LABELS: Record<ExamKind, string> = {
  oylik: "Oylik imtihon",
  chorak: "Chorak imtihoni",
  yakuniy: "Yakuniy attestatsiya",
  sinov: "Sinov testi",
};

export type ExamStatus = "rejada" | "otkazildi" | "bekor";

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  rejada: "Rejada",
  otkazildi: "Oʻtkazildi",
  bekor: "Bekor qilindi",
};

export interface Exam {
  id: string;
  title: string;
  subject: string;
  className: string;
  kind: ExamKind;
  /** ISO sana. */
  date: string;
  startTime: string;
  durationMin: number;
  room: string;
  /** Imtihonni oʻtkazadigan ustoz. */
  teacherId: string;
  /** Eng yuqori ball. */
  maxScore: number;
  status: ExamStatus;
  /** Natija kiritilganmi. */
  resultsEntered: boolean;
  createdBy: string;
}

export interface ExamResult {
  examId: string;
  studentId: string;
  studentName: string;
  /** Kelmagan boʻlsa `null`. */
  score: number | null;
  absent: boolean;
}

// ─────────────────────── Generatsiya ───────────────────────

/** Bugungi sana — demo uchun qatʼiy, jadval har kuni siljib ketmasin. */
export const TODAY = "2026-09-20";

const ROOMS = ["101", "108", "110", "204", "206", "301", "302", "305"];

/**
 * Imtihon bosqichlari. Oʻquv yili 24-avgustda boshlangan (`lib/teacher/terms.ts`),
 * demo kuni — 20-sentabr. Shu sabab avgust va sentabr bosqichlari
 * oʻtkazilgan, oktabr va noyabr rejada turadi.
 *
 * Holat SANADAN chiqadi, qoʻlda yozilmaydi: kelajakdagi imtihon
 * «oʻtkazildi» deb koʻrinib qolmasin.
 */
const EXAM_ROUNDS: { month: string; label: string; kind: ExamKind; day: number }[] = [
  { month: "2026-08", label: "Avgust", kind: "sinov", day: 27 },
  { month: "2026-09", label: "Sentabr", kind: "oylik", day: 14 },
  { month: "2026-10", label: "Oktabr", kind: "oylik", day: 13 },
  { month: "2026-11", label: "Noyabr", kind: "oylik", day: 16 },
];

/** Har bir sinfda bir bosqichda nechta fandan imtihon boʻladi. */
const SUBJECTS_PER_ROUND = 2;

function buildExams(): Exam[] {
  const list: Exam[] = [];

  for (const cls of CLASSES) {
    const teachers = subjectTeachersOf(cls.name);
    if (teachers.length === 0) continue;

    // Fanlar bosqichma-bosqich navbat bilan olinadi — bir necha bosqichda
    // sinfning deyarli hamma fani qamrab olinadi va har bir ustozga
    // imtihon tushadi.
    const base = hash(`ex-${cls.name}`);

    EXAM_ROUNDS.forEach((round, roundIndex) => {
      for (let slot = 0; slot < SUBJECTS_PER_ROUND; slot += 1) {
        const row =
          teachers[(base + roundIndex * SUBJECTS_PER_ROUND + slot) % teachers.length];
        const seed = hash(`${cls.name}-${round.month}-${row.subject}`);
        // Ikkinchi fan ikki kundan keyin — bir kunda ikki imtihon boʻlmasin.
        const day = round.day + slot * 2;
        const date = `${round.month}-${String(day).padStart(2, "0")}`;
        const conducted = date < TODAY;
        list.push({
          id: `ex-${cls.id}-${round.month}-${slot}`,
          title: `${row.subject} — ${round.label} ${
            round.kind === "sinov" ? "kirish nazorati" : "imtihoni"
          }`,
          subject: row.subject,
          className: cls.name,
          kind: round.kind,
          date,
          startTime: slot === 0 ? "09:00" : "11:00",
          durationMin: 60 + (seed % 3) * 15,
          room: ROOMS[seed % ROOMS.length],
          teacherId: row.teacher.id,
          maxScore: 100,
          status: conducted ? "otkazildi" : "rejada",
          resultsEntered: conducted,
          createdBy: "Oʻquv boʻlimi",
        });
      }
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export const EXAMS: Exam[] = buildExams();

// ─────────────────────── Natijalar ───────────────────────

const studentsByClass = new Map<string, StudentRecord[]>();
for (const student of ALL_STUDENTS) {
  const list = studentsByClass.get(student.className) ?? [];
  list.push(student);
  studentsByClass.set(student.className, list);
}

/**
 * Imtihon natijalari. Ball oʻquvchining davomatiga bogʻliq — kam
 * qatnashgan oʻquvchi pastroq ball oladi, aks holda raqamlar bir-biriga
 * qarama-qarshi chiqib qolardi.
 */
export function resultsOf(examId: string): ExamResult[] {
  const exam = EXAMS.find((e) => e.id === examId);
  if (!exam || !exam.resultsEntered) return [];

  const students = studentsByClass.get(exam.className) ?? [];
  return students.map((student) => {
    const seed = hash(`${examId}-${student.id}`);
    const absent = seed % 23 === 0;
    if (absent) {
      return { examId, studentId: student.id, studentName: student.fullName, score: null, absent: true };
    }
    // Davomat 100% boʻlsa +12 ball, 80% boʻlsa −8 ball atrofida.
    const attendanceBonus = Math.round((student.attendanceMonth - 90) * 0.9);
    const base = pick(seed >>> 3, 48, 92) + attendanceBonus;
    return {
      examId,
      studentId: student.id,
      studentName: student.fullName,
      score: Math.max(20, Math.min(100, base)),
      absent: false,
    };
  });
}

export interface ExamStats {
  examId: string;
  entered: number;
  absent: number;
  average: number;
  highest: number;
  lowest: number;
  /** «2» ga teng — 60 balldan past. */
  failing: number;
  passRate: number;
}

export function statsOf(examId: string): ExamStats | null {
  const results = resultsOf(examId);
  if (results.length === 0) return null;
  const scored = results.filter((r) => !r.absent && r.score !== null);
  if (scored.length === 0) {
    return {
      examId,
      entered: 0,
      absent: results.length,
      average: 0,
      highest: 0,
      lowest: 0,
      failing: 0,
      passRate: 0,
    };
  }
  const scores = scored.map((r) => r.score as number);
  const failing = scores.filter((s) => s < 60).length;
  return {
    examId,
    entered: scored.length,
    absent: results.length - scored.length,
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    failing,
    passRate: Math.round(((scored.length - failing) / scored.length) * 100),
  };
}

// ─────────────────────── Kesimlar ───────────────────────

export function examsOfClass(className: string): Exam[] {
  return EXAMS.filter((e) => e.className === className);
}

export function examsOfTeacher(teacherId: string): Exam[] {
  return EXAMS.filter((e) => e.teacherId === teacherId);
}

export function upcomingExams(from = TODAY, limit = 10): Exam[] {
  return EXAMS.filter((e) => e.date >= from && e.status === "rejada")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

/** Natijasi kiritilmagan, lekin oʻtib ketgan imtihonlar — oʻquv boʻlimi ishi. */
export function examsAwaitingResults(from = TODAY): Exam[] {
  return EXAMS.filter((e) => e.date < from && e.status === "otkazildi" && !e.resultsEntered);
}

export interface TeacherExamSummary {
  /** Oʻrtacha ball, 0–100. */
  average: number;
  examCount: number;
  studentCount: number;
  /** Oy boʻyicha dinamika, eskidan yangiga. */
  trend: { month: string; average: number }[];
  /** Sinf va fan kesimida. */
  byClass: { className: string; subject: string; average: number; failing: number; studentCount: number }[];
}

const MONTH_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_ROUNDS.map((r) => [r.month, r.label]),
);

/**
 * Ustozning imtihon natijalari — KPI shu yerdan oladi.
 * Faqat natijasi kiritilgan imtihonlar hisobga olinadi.
 */
export function teacherExamSummary(teacherId: string): TeacherExamSummary {
  const exams = examsOfTeacher(teacherId).filter((e) => e.resultsEntered);

  const byMonth = new Map<string, number[]>();
  const byClass: TeacherExamSummary["byClass"] = [];
  let studentTotal = 0;
  const allScores: number[] = [];

  for (const exam of exams) {
    const stats = statsOf(exam.id);
    if (!stats || stats.entered === 0) continue;
    const month = exam.date.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(stats.average);
    byMonth.set(month, list);

    byClass.push({
      className: exam.className,
      subject: exam.subject,
      average: stats.average,
      failing: stats.failing,
      studentCount: stats.entered,
    });
    studentTotal += stats.entered;
    allScores.push(stats.average);
  }

  const trend = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, list]) => ({
      month: MONTH_LABELS[month] ?? month,
      average: Math.round(list.reduce((a, b) => a + b, 0) / list.length),
    }));

  return {
    average: allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0,
    examCount: exams.length,
    studentCount: studentTotal,
    trend,
    byClass: byClass.sort((a, b) => b.average - a.average),
  };
}

/**
 * DEMO koʻprigi: oʻquvchi va ota-ona kabinetlari alohida mock
 * maʼlumotdan qurilgan (`lib/mock/data.ts`, `lib/parent/data.ts`) va
 * ularning id lari `ALL_STUDENTS` bilan mos kelmaydi.
 *
 * Shu funksiya kabinet oʻquvchisini oʻsha sinfdagi HAQIQIY yozuvga
 * barqaror bogʻlaydi — natijalar har ochilganda bir xil boʻladi.
 * Backend ulanganda kerak boʻlmaydi: id bitta boʻladi.
 */
export function examIdentityFor(className: string, key: string): string | null {
  const students = studentsByClass.get(className);
  if (!students || students.length === 0) return null;
  return students[hash(`bridge-${key}`) % students.length].id;
}

/** Bitta oʻquvchining imtihon natijalari — kabinetlarda koʻrsatiladi. */
export function studentExamResults(studentId: string): {
  exam: Exam;
  score: number | null;
  absent: boolean;
  classAverage: number;
}[] {
  const student = ALL_STUDENTS.find((s) => s.id === studentId);
  if (!student) return [];
  return examsOfClass(student.className)
    .filter((e) => e.resultsEntered)
    .map((exam) => {
      const mine = resultsOf(exam.id).find((r) => r.studentId === studentId);
      return {
        exam,
        score: mine?.score ?? null,
        absent: mine?.absent ?? false,
        classAverage: statsOf(exam.id)?.average ?? 0,
      };
    })
    .sort((a, b) => b.exam.date.localeCompare(a.exam.date));
}
