/**
 * Ustoz KPI va kengaytirilgan statistikasi.
 *
 * Maktab rahbari toʻrtta KPI aytgan: oʻquvchilarning oylik imtihon
 * natijasi, ichki qoidalarga amal qilish, ota-ona bilan hamkorlik va
 * toʻrtinchisi (eslanmagan). Toʻrtinchi oʻrniga «Jurnal va davomat
 * intizomi» taklif qilinadi — u allaqachon oʻlchanadigan maʼlumot va
 * `proposed: true` bayrogʻi bilan belgilangan, tasdiqlangach olib
 * tashlanadi.
 *
 * Barcha raqamlar barqaror xeshdan chiqadi: sahifa har ochilganda bir xil
 * boʻladi. Backend ulanganda `teacher_kpi` koʻrinishi bilan almashtiriladi,
 * komponentlar oʻzgarmaydi.
 */

import { assignmentsOfTeacher, homeroomClassOf, weeklyLoadOf } from "@/lib/school/staff";

/** `school-data.ts` dagi bilan bir xil mantiq — `>>>` shart. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** [min, max] oraligʻida barqaror son. */
function pick(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1));
}

export type KpiKey = "exams" | "rules" | "parents" | "journal";

export interface KpiDefinition {
  key: KpiKey;
  label: string;
  /** Nimadan hisoblanadi — rahbar tekshira olishi uchun. */
  formula: string;
  /** Rahbar tasdiqlamagan, taklif sifatida turibdi. */
  proposed?: boolean;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: "exams",
    label: "Oylik imtihon natijalari",
    formula: "Oʻquvchilarning oylik imtihonda toʻplagan ballari oʻrtachasi",
  },
  {
    key: "rules",
    label: "Ichki qoidalarga amal qilish",
    formula: "Darsga kechikmaslik, dars rejasini vaqtida topshirish, majlislarda qatnashish",
  },
  {
    key: "parents",
    label: "Ota-ona bilan hamkorlik",
    formula: "Murojaatlarga javob berilgan ulushi va ota-onalar soʻrovnomasi bahosi",
  },
  {
    key: "journal",
    label: "Jurnal va davomat intizomi",
    formula: "Davomat 24 soat ichida belgilangan darslar ulushi, baho kiritish kechikishi",
    proposed: true,
  },
];

export interface KpiScore {
  key: KpiKey;
  /** 0–100. */
  score: number;
  /** Oʻtgan chorakka nisbatan oʻzgarish. */
  delta: number;
  /** Ballning ortidagi tushuntirish — "42 tadan 39 tasi" kabi. */
  detail: string;
}

export interface SubjectResult {
  subject: string;
  className: string;
  averageGrade: number;
  /** Oylik imtihonning oʻrtacha bali, 100 ballik. */
  examAverage: number;
  /** Shu sinfdagi darslarida oʻquvchilar davomati. */
  attendancePercent: number;
  studentCount: number;
}

export interface ExamPoint {
  month: string;
  average: number;
}

export interface RuleCompliance {
  label: string;
  done: number;
  total: number;
}

export interface TeacherKpi {
  teacherId: string;
  /** Toʻrtta KPI oʻrtachasi, 0–100. */
  overall: number;
  scores: KpiScore[];
  subjects: SubjectResult[];
  examTrend: ExamPoint[];
  rules: RuleCompliance[];
  /** Ota-ona hamkorligi tafsilotlari. */
  appealsReceived: number;
  appealsAnswered: number;
  averageReplyHours: number;
  parentSurveyScore: number;
  /** Umumiy oʻqitiladigan oʻquvchilar soni. */
  studentsTaught: number;
  weeklyHours: number;
  homeroomClass: string | null;
}

const EXAM_MONTHS = ["Sentabr", "Oktabr", "Noyabr", "Dekabr", "Yanvar"];

const RULE_ITEMS = [
  "Darsga oʻz vaqtida kirish",
  "Dars rejasini vaqtida topshirish",
  "Metodik majlisda qatnashish",
  "Navbatchilik jadvaliga rioya",
];

export function teacherKpi(teacherId: string): TeacherKpi {
  const seed = hash(`kpi-${teacherId}`);
  const assignments = assignmentsOfTeacher(teacherId);

  // ── Fanlar va sinflar kesimi ──
  const subjects: SubjectResult[] = assignments.map((a) => {
    const s = hash(`${teacherId}-${a.className}-${a.subject}`);
    const examAverage = pick(s >>> 3, 58, 94);
    return {
      subject: a.subject,
      className: a.className,
      // Oʻrtacha baho imtihon bali bilan bogʻliq boʻlsin — ikkisi
      // qarama-qarshi chiqib qolmasin.
      averageGrade: Number((2.6 + (examAverage / 100) * 2.3).toFixed(1)),
      examAverage,
      attendancePercent: pick(s >>> 7, 84, 99),
      studentCount: pick(s, 18, 29),
    };
  });

  const studentsTaught = subjects.reduce((sum, s) => sum + s.studentCount, 0);
  const examScore = subjects.length
    ? Math.round(subjects.reduce((sum, s) => sum + s.examAverage, 0) / subjects.length)
    : 0;

  // ── Imtihon dinamikasi ──
  const examTrend: ExamPoint[] = EXAM_MONTHS.map((month, i) => {
    const s = hash(`${teacherId}-exam-${month}`);
    // Oxirgi nuqta joriy oʻrtachaga yaqinlashsin.
    const drift = pick(s, 0, 10) - 5;
    const weight = i / (EXAM_MONTHS.length - 1);
    return {
      month,
      average: Math.max(40, Math.min(100, Math.round(examScore + drift * (1 - weight)))),
    };
  });

  // ── Ichki qoidalar ──
  const rules: RuleCompliance[] = RULE_ITEMS.map((label, i) => {
    const s = hash(`${teacherId}-rule-${label}`);
    const total = [42, 18, 9, 12][i];
    const missed = pick(s, 0, Math.max(1, Math.round(total * 0.18)));
    return { label, done: total - missed, total };
  });
  const rulesScore = Math.round(
    (rules.reduce((sum, r) => sum + r.done / r.total, 0) / rules.length) * 100,
  );

  // ── Ota-ona hamkorligi ──
  const appealsReceived = pick(seed >>> 5, 2, 14);
  const appealsAnswered = Math.max(0, appealsReceived - pick(seed >>> 9, 0, 2));
  const averageReplyHours = pick(seed >>> 13, 2, 26);
  const parentSurveyScore = Number((3.4 + (pick(seed >>> 17, 0, 15) / 15) * 1.5).toFixed(1));
  const answeredRate = appealsReceived ? appealsAnswered / appealsReceived : 1;
  // Javob tezligi 24 soatdan oshsa ball tushadi.
  const speedFactor = Math.max(0, Math.min(1, (30 - averageReplyHours) / 30));
  const parentsScore = Math.round(
    (answeredRate * 0.45 + (parentSurveyScore / 5) * 0.4 + speedFactor * 0.15) * 100,
  );

  // ── Jurnal intizomi ──
  const markedInTime = pick(seed >>> 11, 78, 100);
  const gradeDelayDays = pick(seed >>> 19, 0, 4);
  const journalScore = Math.max(
    0,
    Math.min(100, Math.round(markedInTime - gradeDelayDays * 4)),
  );

  const scores: KpiScore[] = [
    {
      key: "exams",
      score: examScore,
      delta: pick(seed >>> 2, 0, 12) - 6,
      detail: `${subjects.length} ta sinf boʻyicha oʻrtacha ball`,
    },
    {
      key: "rules",
      score: rulesScore,
      delta: pick(seed >>> 6, 0, 10) - 5,
      detail: `${rules.reduce((s, r) => s + r.done, 0)} / ${rules.reduce((s, r) => s + r.total, 0)} bajarilgan`,
    },
    {
      key: "parents",
      score: parentsScore,
      delta: pick(seed >>> 10, 0, 14) - 7,
      detail: `${appealsAnswered}/${appealsReceived} murojaatga javob · soʻrovnoma ${parentSurveyScore}/5`,
    },
    {
      key: "journal",
      score: journalScore,
      delta: pick(seed >>> 14, 0, 8) - 4,
      detail: `Davomat oʻz vaqtida: ${markedInTime}% · baho kechikishi ${gradeDelayDays} kun`,
    },
  ];

  return {
    teacherId,
    overall: Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length),
    scores,
    subjects: subjects.sort((a, b) => b.examAverage - a.examAverage),
    examTrend,
    rules,
    appealsReceived,
    appealsAnswered,
    averageReplyHours,
    parentSurveyScore,
    studentsTaught,
    weeklyHours: weeklyLoadOf(teacherId),
    homeroomClass: homeroomClassOf(teacherId),
  };
}

/** Ball rangi — 85+ yaxshi, 70+ oʻrta, pastrogʻi eʼtibor talab qiladi. */
export function kpiTone(score: number): "success" | "warning" | "danger" {
  if (score >= 85) return "success";
  if (score >= 70) return "warning";
  return "danger";
}
