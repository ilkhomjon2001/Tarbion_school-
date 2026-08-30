/**
 * Sifat nazorati — dars kuzatuvi.
 *
 * Oʻquv boʻlimi mudiri va rahbariyat darsga kirib, beshta mezon boʻyicha
 * baho qoʻyadi. Bu KPI dan ALOHIDA narsa: KPI raqamlardan (imtihon, davomat)
 * chiqadi, sifat nazorati esa darsning oʻzini koʻrib baholaydi.
 *
 * Kuzatuv HAQIQIY dars yuklamasidan quriladi (`TEACHING_ASSIGNMENTS`) —
 * kuzatilgan sinf va fan ustozning haqiqatda oʻqitadigan fani boʻladi.
 * Ball esa imtihon natijasiga bogʻlangan: bir ustoz imtihonda past natija
 * berib, dars kuzatuvida aʼlo baho olib qolmasin.
 *
 * Backend ulanganda `lesson_observations` jadvali. Baho oʻzgarishi
 * `audit_log` ga tushishi shart — ustozning ish haqi va attestatsiyasiga
 * taʼsir qiladigan maʼlumot.
 */

import { TODAY, teacherExamSummary } from "@/lib/school/exams";
import {
  ACADEMIC_HEAD,
  DIRECTOR,
  TEACHING_ASSIGNMENTS,
  allTeachers,
  staffById,
} from "@/lib/school/staff";

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

// ───────────────────────── Mezonlar ─────────────────────────

export type CriterionKey = "maqsad" | "faollik" | "vaqt" | "baholash" | "material";

export interface Criterion {
  key: CriterionKey;
  label: string;
  /** Kuzatuvchi nimaga qaraydi — varaqadagi izoh. */
  hint: string;
}

export const CRITERIA: Criterion[] = [
  {
    key: "maqsad",
    label: "Dars maqsadi va kutilayotgan natija",
    hint: "Maqsad oʻquvchilarga aytilganmi, dars oxirida natija tekshirildimi",
  },
  {
    key: "faollik",
    label: "Oʻquvchilar faolligi",
    hint: "Nechta oʻquvchi ishtirok etdi, savol-javob jonlimi",
  },
  {
    key: "vaqt",
    label: "Vaqt taqsimoti va dars bosqichlari",
    hint: "Takrorlash, yangi mavzu, mustahkamlash — har biriga vaqt yetdimi",
  },
  {
    key: "baholash",
    label: "Baholash va qayta aloqa",
    hint: "Baho izohlandimi, xato tushuntirildimi, uy vazifasi aniq berildimi",
  },
  {
    key: "material",
    label: "Metodik material va texnika",
    hint: "Tarqatma, taqdimot, doska va jihozdan foydalanish",
  },
];

export const CRITERION_LABELS: Record<CriterionKey, string> = Object.fromEntries(
  CRITERIA.map((c) => [c.key, c.label]),
) as Record<CriterionKey, string>;

/**
 * Maktab boʻyicha mezon ogʻishi. Bu tasodifiy son emas — maqsadli:
 * demo maʼlumotda ham «eng zaif mezon» aniq koʻrinsin, oʻquv boʻlimi
 * qaysi mavzuda seminar oʻtkazishi kerakligini bilsin.
 */
const CRITERION_BIAS: Record<CriterionKey, number> = {
  maqsad: 0.25,
  faollik: 0.1,
  vaqt: -0.15,
  baholash: -0.5,
  material: 0.05,
};

// ───────────────────────── Xulosa ─────────────────────────

export type Verdict = "namunali" | "yaxshi" | "tavsiya" | "qayta";

export const VERDICT_LABELS: Record<Verdict, string> = {
  namunali: "Namunali dars",
  yaxshi: "Yaxshi",
  tavsiya: "Tavsiya berildi",
  qayta: "Qayta kuzatuv kerak",
};

export function verdictOf(overall: number): Verdict {
  if (overall >= 88) return "namunali";
  if (overall >= 74) return "yaxshi";
  if (overall >= 60) return "tavsiya";
  return "qayta";
}

export type ObservationStatus = "rejada" | "otkazildi";

export interface Observation {
  id: string;
  teacherId: string;
  className: string;
  subject: string;
  /** ISO sana. */
  date: string;
  /** Nechanchi dars. */
  lessonNo: number;
  observerId: string;
  status: ObservationStatus;
  /**
   * Natija kiritilmagan boʻlsa `null` — 0 EMAS. Nol ball «yomon dars»
   * degani, kiritilmagani esa «hali baholanmagan».
   */
  scores: Record<CriterionKey, number> | null;
  /** 0–100. Ball kiritilmaganda `null`. */
  overall: number | null;
  verdict: Verdict | null;
  note: string;
  /** Past baho olganda beriladigan tavsiya. */
  followUp: string | null;
  /** Qayta kuzatuv sanasi. */
  recheckAt: string | null;
}

/** Beshta mezon oʻrtachasi 100 ballik shkalada. */
export function scoreOverall(scores: Record<CriterionKey, number>): number {
  const sum = CRITERIA.reduce((acc, c) => acc + scores[c.key], 0);
  return Math.round((sum / CRITERIA.length) * 20);
}

// ───────────────────────── Generatsiya ─────────────────────────

/**
 * Kuzatuv bosqichlari. Oʻquv yili 24-avgustda boshlangan, demo kuni —
 * 20-sentabr. Holat SANADAN chiqadi: kelajakdagi kuzatuv «oʻtkazildi»
 * boʻlib qolmasin (imtihonlarda aynan shu xato boʻlgan edi).
 */
const OBSERVATION_ROUNDS = [
  { month: "2026-08", day: 27 },
  { month: "2026-09", day: 8 },
  { month: "2026-10", day: 12 },
  { month: "2026-11", day: 9 },
];

const FOLLOW_UPS = [
  "Baholashni izohlash boʻyicha metodik yordam — sinf rahbarlari seminarida",
  "Dars bosqichlariga vaqt taqsimotini qayta koʻrib chiqish",
  "Tarqatma material va interaktiv topshiriqlarni koʻpaytirish",
  "Kuchsiz oʻquvchilar bilan alohida ishlash rejasini topshirish",
];

const NOTES_GOOD = [
  "Dars maqsadi doskaga yozilgan, oxirida qisqa test bilan tekshirildi.",
  "Oʻquvchilar juftlikda ishladi, sinfning katta qismi javob berdi.",
  "Yangi mavzu hayotiy misol bilan boshlandi, eʼtibor oxirigacha saqlandi.",
];

const NOTES_WEAK = [
  "Dars maqsadi aytilmadi, oʻquvchilar nima oʻrganishini bilmay qoldi.",
  "Vaqtning yarmi takrorlashga ketdi, mustahkamlashga ulgurilmadi.",
  "Baholar izohsiz qoʻyildi, xatolar tahlil qilinmadi.",
];

function buildObservations(): Observation[] {
  const list: Observation[] = [];

  allTeachers().forEach((teacher, teacherIndex) => {
    const assignments = TEACHING_ASSIGNMENTS.filter((a) => a.teacherId === teacher.id);
    // Yuklamasi yoʻq ustoz kuzatilmaydi — darsi yoʻq. Bu «eʼtibordan
    // chetda qolgan ustoz» sifatida xulosada alohida koʻrsatiladi.
    if (assignments.length === 0) return;

    const anchorRaw = teacherExamSummary(teacher.id).average;
    // Imtihoni yoʻq ustozga neytral tayanch — past ball qoʻyish yolgʻon.
    const anchor = anchorRaw > 0 ? anchorRaw : 74;

    OBSERVATION_ROUNDS.forEach((round, roundIndex) => {
      const a = assignments[(teacherIndex + roundIndex) % assignments.length];
      const seed = hash(`obs-${teacher.id}-${round.month}`);
      // Kuzatuvlar bir kunga toʻplanib qolmasin.
      const day = round.day + ((teacherIndex + roundIndex) % 4);
      const date = `${round.month}-${String(day).padStart(2, "0")}`;
      const conducted = date < TODAY;

      const base: Observation = {
        id: `obs-${teacher.id}-${round.month}`,
        teacherId: teacher.id,
        className: a.className,
        subject: a.subject,
        date,
        lessonNo: pick(seed >>> 3, 1, 6),
        observerId: seed % 3 === 0 ? DIRECTOR.id : ACADEMIC_HEAD.id,
        status: conducted ? "otkazildi" : "rejada",
        scores: null,
        overall: null,
        verdict: null,
        note: "",
        followUp: null,
        recheckAt: null,
      };

      if (!conducted) {
        list.push(base);
        return;
      }

      // Oʻtkazilgan, lekin varaqasi hali kiritilmagan kuzatuvlar —
      // oʻquv boʻlimining ish navbati shundan chiqadi.
      if (seed % 7 === 0) {
        list.push(base);
        return;
      }

      // Imtihon oʻrtachasini kuzatuv shkalasiga toʻgʻridan-toʻgʻri boʻlib
      // oʻtkazib boʻlmaydi: 68 ball — sinf uchun oddiy natija, lekin 3.4/5
      // — yomon dars. Shu sabab markaz 4.0 ga qoʻyiladi va imtihon natijasi
      // uni atigi ±0.8 ga suradi.
      const center = 4 + (anchor - 68) / 30;

      const scores = {} as Record<CriterionKey, number>;
      for (const c of CRITERIA) {
        const s = hash(`${teacher.id}-${round.month}-${c.key}`);
        const raw = center + CRITERION_BIAS[c.key] + (pick(s, 0, 8) - 4) / 5;
        scores[c.key] = Math.max(1, Math.min(5, Math.round(raw)));
      }

      const overall = scoreOverall(scores);
      const verdict = verdictOf(overall);
      const weak = verdict === "tavsiya" || verdict === "qayta";

      list.push({
        ...base,
        scores,
        overall,
        verdict,
        note: weak
          ? NOTES_WEAK[seed % NOTES_WEAK.length]
          : NOTES_GOOD[seed % NOTES_GOOD.length],
        followUp: weak ? FOLLOW_UPS[seed % FOLLOW_UPS.length] : null,
        recheckAt: verdict === "qayta" ? nextMonth(date) : null,
      });
    });
  });

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/** Sanaga bir oy qoʻshadi — qayta kuzatuv muddati. */
function nextMonth(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, d));
  return next.toISOString().slice(0, 10);
}

export const OBSERVATIONS: Observation[] = buildObservations();

export function observerName(id: string): string {
  return staffById(id)?.shortName ?? "—";
}

// ───────────────────────── Kesimlar ─────────────────────────

export interface TeacherQuality {
  teacherId: string;
  /** Oʻtkazilgan va baholangan kuzatuvlar oʻrtachasi. Boʻlmasa `null`. */
  average: number | null;
  conducted: number;
  planned: number;
  last: Observation | null;
  /** Yopilmagan tavsiyalar soni. */
  openFollowUps: number;
}

export function teacherQuality(
  teacherId: string,
  list: Observation[] = OBSERVATIONS,
): TeacherQuality {
  const mine = list.filter((o) => o.teacherId === teacherId);
  const scored = mine.filter((o) => o.overall !== null);
  const conducted = mine.filter((o) => o.status === "otkazildi");

  return {
    teacherId,
    average: scored.length
      ? Math.round(scored.reduce((sum, o) => sum + (o.overall ?? 0), 0) / scored.length)
      : null,
    conducted: conducted.length,
    planned: mine.length - conducted.length,
    last: scored[0] ?? conducted[0] ?? null,
    openFollowUps: mine.filter((o) => o.followUp !== null).length,
  };
}

export interface CriterionAverage {
  key: CriterionKey;
  label: string;
  /** 1–5 shkalasida. */
  average: number;
}

export interface QualitySummary {
  conducted: number;
  planned: number;
  /** Oʻtkazilgan, lekin varaqasi kiritilmagan. */
  awaitingScores: number;
  /** Barcha baholangan kuzatuvlar oʻrtachasi, 0–100. Boʻlmasa `null`. */
  average: number | null;
  byVerdict: Record<Verdict, number>;
  byCriterion: CriterionAverage[];
  /** Eng past mezon — seminar mavzusi shundan tanlanadi. */
  weakest: CriterionAverage | null;
  /** Bu oʻquv yilida umuman kuzatilmagan ustozlar. */
  notObserved: { id: string; fullName: string }[];
  openFollowUps: number;
}

export function qualitySummary(list: Observation[] = OBSERVATIONS): QualitySummary {
  const conducted = list.filter((o) => o.status === "otkazildi");
  const scored = conducted.filter((o) => o.overall !== null);

  const byVerdict: Record<Verdict, number> = {
    namunali: 0,
    yaxshi: 0,
    tavsiya: 0,
    qayta: 0,
  };
  for (const o of scored) if (o.verdict) byVerdict[o.verdict] += 1;

  const byCriterion: CriterionAverage[] = CRITERIA.map((c) => ({
    key: c.key,
    label: c.label,
    average: scored.length
      ? Number(
          (
            scored.reduce((sum, o) => sum + (o.scores?.[c.key] ?? 0), 0) / scored.length
          ).toFixed(2),
        )
      : 0,
  }));

  const observedIds = new Set(list.map((o) => o.teacherId));

  return {
    conducted: conducted.length,
    planned: list.length - conducted.length,
    awaitingScores: conducted.filter((o) => o.overall === null).length,
    average: scored.length
      ? Math.round(scored.reduce((sum, o) => sum + (o.overall ?? 0), 0) / scored.length)
      : null,
    byVerdict,
    byCriterion,
    weakest: scored.length
      ? byCriterion.reduce((min, c) => (c.average < min.average ? c : min))
      : null,
    notObserved: allTeachers()
      .filter((t) => !observedIds.has(t.id))
      .map((t) => ({ id: t.id, fullName: t.fullName })),
    openFollowUps: list.filter((o) => o.followUp !== null).length,
  };
}

/** Rejadagi kuzatuvlar, sana boʻyicha yaqinidan. */
export function upcomingObservations(
  list: Observation[] = OBSERVATIONS,
  from = TODAY,
): Observation[] {
  return list
    .filter((o) => o.status === "rejada" && o.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Ball rangi — KPI bilan bir xil chegara. */
export function qualityTone(score: number): "success" | "warning" | "danger" {
  if (score >= 85) return "success";
  if (score >= 70) return "warning";
  return "danger";
}
