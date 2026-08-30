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
 * Birinchi koʻrsatkich HAQIQIY manbadan keladi — `lib/school/exams.ts`
 * dagi imtihon natijalari. Qolgan uchtasi hali barqaror xeshdan (davomat
 * jurnali va murojaat javoblari backendsiz oʻlchanmaydi). Backend
 * ulanganda ular ham oʻz manbasiga ulanadi, komponentlar oʻzgarmaydi.
 */

import { teacherExamSummary } from "@/lib/school/exams";
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
  /**
   * Maʼlumot bormi. Imtihoni boʻlmagan ustozga 0 qoʻyish — yolgʻon:
   * u yomon ishlagani emas, oʻlchanmagani. Umumiy ball hisoblanganda
   * bunday koʻrsatkich CHIQARIB TASHLANADI.
   */
  available: boolean;
}

export interface SubjectResult {
  subject: string;
  className: string;
  averageGrade: number;
  /** Oylik imtihonning oʻrtacha bali, 100 ballik. */
  examAverage: number;
  /** Shu sinf+fan boʻyicha imtihon oʻtkazilganmi. */
  hasExam: boolean;
  /** 60 balldan past olganlar soni. */
  failing: number;
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
  /** Oʻlchangan koʻrsatkichlar oʻrtachasi, 0–100. */
  overall: number;
  /** Nechta koʻrsatkich boʻyicha maʼlumot bor (4 tadan). */
  measuredCount: number;
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


const RULE_ITEMS = [
  "Darsga oʻz vaqtida kirish",
  "Dars rejasini vaqtida topshirish",
  "Metodik majlisda qatnashish",
  "Navbatchilik jadvaliga rioya",
];

export function teacherKpi(teacherId: string): TeacherKpi {
  const seed = hash(`kpi-${teacherId}`);
  const assignments = assignmentsOfTeacher(teacherId);

  // ── Imtihon natijalari: HAQIQIY manbadan (`lib/school/exams.ts`) ──
  const exams = teacherExamSummary(teacherId);
  const examByClass = new Map(
    exams.byClass.map((row) => [`${row.className}|${row.subject}`, row]),
  );

  // ── Fanlar va sinflar kesimi ──
  const subjects: SubjectResult[] = assignments.map((a) => {
    const s = hash(`${teacherId}-${a.className}-${a.subject}`);
    const fromExam = examByClass.get(`${a.className}|${a.subject}`);
    // Imtihon boʻlmagan sinf uchun oʻrtacha ball yoʻq — 0 emas, `null`
    // boʻlishi kerak edi, lekin jadval sodda qolsin deb umumiy oʻrtacha
    // olinadi va «imtihon boʻlmagan» deb belgilanadi.
    const examAverage = fromExam?.average ?? exams.average;
    return {
      subject: a.subject,
      className: a.className,
      // Oʻrtacha baho imtihon bali bilan bogʻliq — ikkisi qarama-qarshi
      // chiqib qolmasin.
      averageGrade: Number((2.6 + (examAverage / 100) * 2.3).toFixed(1)),
      examAverage,
      hasExam: Boolean(fromExam),
      failing: fromExam?.failing ?? 0,
      attendancePercent: pick(s >>> 7, 84, 99),
      studentCount: fromExam?.studentCount ?? pick(s, 18, 29),
    };
  });

  const studentsTaught = subjects.reduce((sum, s) => sum + s.studentCount, 0);
  const examScore = exams.average;

  // ── Imtihon dinamikasi ── oylar imtihon jadvalidan keladi
  const examTrend: ExamPoint[] = exams.trend.map((point) => ({
    month: point.month,
    average: point.average,
  }));

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

  const hasLoad = assignments.length > 0;

  const scores: KpiScore[] = [
    {
      key: "exams",
      score: examScore,
      delta: pick(seed >>> 2, 0, 12) - 6,
      detail:
        exams.examCount > 0
          ? `${exams.examCount} ta imtihon · ${exams.studentCount} ta natija boʻyicha`
          : "Imtihon oʻtkazilmagan — baholanmaydi",
      available: exams.examCount > 0,
    },
    {
      key: "rules",
      score: rulesScore,
      delta: pick(seed >>> 6, 0, 10) - 5,
      detail: `${rules.reduce((s, r) => s + r.done, 0)} / ${rules.reduce((s, r) => s + r.total, 0)} bajarilgan`,
      available: true,
    },
    {
      key: "parents",
      score: parentsScore,
      delta: pick(seed >>> 10, 0, 14) - 7,
      detail: `${appealsAnswered}/${appealsReceived} murojaatga javob · soʻrovnoma ${parentSurveyScore}/5`,
      available: true,
    },
    {
      key: "journal",
      score: journalScore,
      delta: pick(seed >>> 14, 0, 8) - 4,
      detail: hasLoad
        ? `Davomat oʻz vaqtida: ${markedInTime}% · baho kechikishi ${gradeDelayDays} kun`
        : "Dars yuklamasi yoʻq — baholanmaydi",
      available: hasLoad,
    },
  ];

  // Faqat oʻlchangan koʻrsatkichlar oʻrtachasi. Oʻlchanmagani 0 emas —
  // aks holda yuklamasi yoʻq ustoz eng yomon koʻrinardi.
  const measured = scores.filter((s) => s.available);

  return {
    teacherId,
    overall: measured.length
      ? Math.round(measured.reduce((sum, s) => sum + s.score, 0) / measured.length)
      : 0,
    measuredCount: measured.length,
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
