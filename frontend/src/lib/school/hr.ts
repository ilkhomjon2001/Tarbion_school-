/**
 * Kadrlar (HR) — xodimlar reyestri, taʼtil va vakansiyalar.
 *
 * Xodimlar roʻyxati `lib/school/staff.ts` dan keladi — bu yerda faqat
 * MEHNAT maʼlumoti qoʻshiladi: lavozim, ishga kirgan sana, shartnoma turi,
 * toifa, maosh. Ikkinchi roʻyxat tuzilmaydi, aks holda kimdir ustozni
 * bittasidan oʻchirib, ikkinchisida qoldirib yuboradi.
 *
 * Maosh — soʻmda, BUTUN son (CLAUDE.md 2-qoida). Tiyin yoʻq.
 *
 * Ishdan boʻshagan xodim oʻchirilmaydi (1-qoida): `status: "archived"`
 * boʻladi va `EXITS` da sababi bilan qoladi — kadrlar aylanmasi
 * hisobotda shundan chiqadi.
 */

import { TODAY } from "@/lib/school/exams";
import { STAFF, allTeachers, staffById, weeklyLoadOf, type Staff } from "@/lib/school/staff";

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

/** Toʻliq stavka — haftasiga soat. Yuklama shu bilan solishtiriladi. */
export const NORM_HOURS = 24;

/** Toifa amal qilish muddati — shundan keyin qayta attestatsiya. */
const QUALIFICATION_YEARS = 5;

// ───────────────────────── Turlar ─────────────────────────

export type Position =
  | "direktor"
  | "oquv-mudiri"
  | "administrator"
  | "psixolog"
  | "oqituvchi";

export const POSITION_LABELS: Record<Position, string> = {
  direktor: "Direktor",
  "oquv-mudiri": "Oʻquv boʻlimi mudiri",
  administrator: "Administrator",
  psixolog: "Psixolog",
  oqituvchi: "Oʻqituvchi",
};

export type ContractType = "toliq" | "yarim" | "soatbay";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  toliq: "Toʻliq stavka",
  yarim: "Yarim stavka",
  soatbay: "Soatbay",
};

export type Qualification = "oliy" | "birinchi" | "ikkinchi" | "toifasiz";

export const QUALIFICATION_LABELS: Record<Qualification, string> = {
  oliy: "Oliy toifa",
  birinchi: "1-toifa",
  ikkinchi: "2-toifa",
  toifasiz: "Toifasiz",
};

export interface Employee {
  staffId: string;
  fullName: string;
  shortName: string;
  initials: string;
  position: Position;
  /** ISO sana — mehnat shartnomasi boshlangan kun. */
  hiredAt: string;
  contractType: ContractType;
  qualification: Qualification;
  /** Toifa berilgan sana. Undan 5 yil oʻtsa — qayta attestatsiya. */
  qualifiedAt: string;
  education: string;
  birthDate: string;
  /** Oylik maosh, soʻmda. Butun son. */
  salary: number;
  /** Haftalik dars soati — haqiqiy yuklamadan. Oʻqituvchi boʻlmasa 0. */
  weeklyHours: number;
  phone: string;
  email: string;
  status: "active" | "archived";
}

const POSITION_BY_ROLE: Record<Staff["role"], Position> = {
  director: "direktor",
  academic: "oquv-mudiri",
  admin: "administrator",
  psychologist: "psixolog",
  teacher: "oqituvchi",
};

/** Lavozim boʻyicha baza maosh, soʻmda. */
const BASE_SALARY: Record<Position, number> = {
  direktor: 14_000_000,
  "oquv-mudiri": 9_500_000,
  administrator: 6_500_000,
  psixolog: 6_000_000,
  oqituvchi: 4_200_000,
};

/** Toifa ustamasi, soʻmda. */
const QUALIFICATION_BONUS: Record<Qualification, number> = {
  oliy: 1_500_000,
  birinchi: 900_000,
  ikkinchi: 400_000,
  toifasiz: 0,
};

const EDUCATION = [
  "OʻzMU, bakalavr",
  "TDPU, bakalavr",
  "TDPU, magistr",
  "Nizomiy nomidagi TDPU, magistr",
  "Samarqand DU, bakalavr",
  "OʻzMU, magistr",
];

const QUALIFICATIONS: Qualification[] = ["oliy", "birinchi", "ikkinchi", "toifasiz"];

function buildEmployee(staff: Staff): Employee {
  const seed = hash(`hr-${staff.id}`);
  const position = POSITION_BY_ROLE[staff.role];
  const teaching = position === "oqituvchi";

  // Ish staji 1–14 yil. Rahbariyat kamida 5 yil ishlagan.
  const years = teaching ? pick(seed, 1, 14) : pick(seed, 5, 18);
  const hiredMonth = pick(seed >>> 5, 1, 8);
  const hiredAt = `${2026 - years}-${String(hiredMonth).padStart(2, "0")}-15`;

  // Toifa stajga bogʻliq — 2 yillik ustozda oliy toifa boʻlmaydi.
  const qualification: Qualification =
    years >= 10
      ? QUALIFICATIONS[pick(seed >>> 9, 0, 1)]
      : years >= 5
        ? QUALIFICATIONS[pick(seed >>> 9, 1, 2)]
        : QUALIFICATIONS[pick(seed >>> 9, 2, 3)];

  // Toifa oxirgi 5 yil ichida berilgan (yoki toifasiz boʻlsa — ishga
  // kirgan sana, attestatsiyaga chiqishi kerakligini koʻrsatadi).
  const qualifiedYearsAgo = pick(seed >>> 13, 0, 5);
  const qualifiedAt =
    qualification === "toifasiz"
      ? hiredAt
      : `${2026 - qualifiedYearsAgo}-${String(pick(seed >>> 17, 1, 12)).padStart(2, "0")}-01`;

  // Tugʻilgan sana ishga kirgan sanadan chiqadi, aks holda 2008-yilda
  // ishga kirgan 1990-yilgi xodim paydo boʻladi — 18 yoshli direktor.
  const ageAtHire = pick(seed >>> 21, 22, 40);
  const birthYear = 2026 - years - ageAtHire;

  const weeklyHours = teaching ? weeklyLoadOf(staff.id) : 0;
  const contractType: ContractType = !teaching
    ? "toliq"
    : weeklyHours >= 18
      ? "toliq"
      : weeklyHours >= 9
        ? "yarim"
        : "soatbay";

  // Maosh = baza + toifa ustamasi + dars soati uchun. 50 000 gacha
  // yaxlitlanadi — buxgalteriya shunday hisoblaydi.
  const raw =
    BASE_SALARY[position] +
    QUALIFICATION_BONUS[qualification] +
    weeklyHours * 210_000 +
    years * 60_000;

  return {
    staffId: staff.id,
    fullName: staff.fullName,
    shortName: staff.shortName,
    initials: staff.initials,
    position,
    hiredAt,
    contractType,
    qualification,
    qualifiedAt,
    education: EDUCATION[seed % EDUCATION.length],
    birthDate: `${birthYear}-${String(pick(seed >>> 3, 1, 12)).padStart(2, "0")}-${String(pick(seed >>> 7, 1, 28)).padStart(2, "0")}`,
    salary: Math.round(raw / 50_000) * 50_000,
    weeklyHours,
    phone: staff.phone,
    email: staff.email,
    status: staff.status,
  };
}

export const EMPLOYEES: Employee[] = STAFF.map(buildEmployee);

export function employeeOf(staffId: string): Employee | null {
  return EMPLOYEES.find((e) => e.staffId === staffId) ?? null;
}

// ───────────────────────── Taʼtil va ruxsat ─────────────────────────

export type LeaveType = "tatil" | "kasallik" | "oz-hisobidan" | "malaka";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  tatil: "Mehnat taʼtili",
  kasallik: "Kasallik varaqasi",
  "oz-hisobidan": "Oʻz hisobidan",
  malaka: "Malaka oshirish",
};

export interface LeaveRecord {
  id: string;
  staffId: string;
  type: LeaveType;
  /** ISO sanalar, ikki chegara ham kiradi. */
  from: string;
  to: string;
  days: number;
  note: string;
  /** Kim rasmiylashtirdi. */
  createdBy: string;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export { daysBetween };

const LEAVE_PLAN: { staffId: string; type: LeaveType; from: string; to: string; note: string }[] = [
  { staffId: "t-3", type: "kasallik", from: "2026-09-16", to: "2026-09-23", note: "Shifokor xulosasi 4412-son" },
  { staffId: "t-12", type: "malaka", from: "2026-09-14", to: "2026-09-25", note: "RTM kurslari — ingliz tili metodikasi" },
  { staffId: "t-7", type: "oz-hisobidan", from: "2026-09-21", to: "2026-09-22", note: "Oilaviy sabab" },
  { staffId: "t-10", type: "tatil", from: "2026-10-05", to: "2026-10-18", note: "Yillik taʼtilning ikkinchi qismi" },
  { staffId: "t-5", type: "kasallik", from: "2026-09-02", to: "2026-09-08", note: "Shifokor xulosasi 4180-son" },
  { staffId: "t-14", type: "malaka", from: "2026-11-02", to: "2026-11-13", note: "Kimyo oʻqituvchilari seminari" },
  { staffId: "t-2", type: "tatil", from: "2026-08-01", to: "2026-08-21", note: "Yillik taʼtil" },
  { staffId: "s-psy", type: "malaka", from: "2026-10-06", to: "2026-10-10", note: "Maktab psixologlari yigʻini" },
];

export const LEAVES: LeaveRecord[] = LEAVE_PLAN.map((row, i) => ({
  id: `lv-${i + 1}`,
  staffId: row.staffId,
  type: row.type,
  from: row.from,
  to: row.to,
  days: daysBetween(row.from, row.to),
  note: row.note,
  createdBy: "B. Qodirov",
}));

/** Berilgan kunda ishda boʻlmagan xodimlar. */
export function onLeaveAt(day = TODAY, list: LeaveRecord[] = LEAVES): LeaveRecord[] {
  return list.filter((l) => l.from <= day && day <= l.to);
}

// ───────────────────────── Vakansiyalar ─────────────────────────

export interface Vacancy {
  id: string;
  title: string;
  subject: string;
  hoursPerWeek: number;
  openedAt: string;
  reason: string;
  status: "ochiq" | "yopilgan";
}

export const VACANCIES: Vacancy[] = [
  {
    id: "vac-1",
    title: "Boshlangʻich taʼlim oʻqituvchisi",
    subject: "Boshlangʻich taʼlim",
    hoursPerWeek: 20,
    openedAt: "2026-08-18",
    reason: "5-B sinf yuklamasi taqsimlanmagan",
    status: "ochiq",
  },
  {
    id: "vac-2",
    title: "Matematika oʻqituvchisi",
    subject: "Matematika",
    hoursPerWeek: 14,
    openedAt: "2026-09-01",
    reason: "Mavjud ikki ustozning yuklamasi normadan yuqori",
    status: "ochiq",
  },
  {
    id: "vac-3",
    title: "Logoped",
    subject: "—",
    hoursPerWeek: 12,
    openedAt: "2026-09-10",
    reason: "Boshlangʻich sinflar uchun rahbariyat talabi",
    status: "ochiq",
  },
  {
    id: "vac-4",
    title: "Geografiya oʻqituvchisi",
    subject: "Geografiya",
    hoursPerWeek: 10,
    openedAt: "2026-06-12",
    reason: "Oldingi xodim ishdan boʻshagan",
    status: "yopilgan",
  },
];

// ───────────────────────── Ishdan boʻshash ─────────────────────────

export type ExitReason =
  | "oz-arizasi"
  | "boshqa-ish"
  | "kochib-ketdi"
  | "shartnoma-tugadi"
  | "intizom";

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  "oz-arizasi": "Oʻz arizasiga koʻra",
  "boshqa-ish": "Boshqa ishga oʻtdi",
  "kochib-ketdi": "Koʻchib ketdi",
  "shartnoma-tugadi": "Shartnoma muddati tugadi",
  intizom: "Intizomiy sabab",
};

export interface ExitRecord {
  id: string;
  /** Reyestrda qolgan xodim boʻlsa — uning id si, boʻlmasa `null`. */
  staffId: string | null;
  fullName: string;
  position: Position;
  hiredAt: string;
  leftAt: string;
  reason: ExitReason;
  note: string;
}

/**
 * Oʻtgan oʻquv yilida ketgan xodimlar. Ular `STAFF` da yoʻq — reyestrdan
 * chiqarilgan, lekin yozuvi qoladi: kadrlar aylanmasi shundan hisoblanadi.
 */
export const EXITS: ExitRecord[] = [
  {
    id: "ex-1",
    staffId: null,
    fullName: "Qoraboyev Otabek Shuhratovich",
    position: "oqituvchi",
    hiredAt: "2022-08-20",
    leftAt: "2026-06-10",
    reason: "boshqa-ish",
    note: "Geografiya · davlat maktabiga oʻtdi",
  },
  {
    id: "ex-2",
    staffId: null,
    fullName: "Halimova Sevara Baxtiyorovna",
    position: "oqituvchi",
    hiredAt: "2024-09-02",
    leftAt: "2026-05-28",
    reason: "kochib-ketdi",
    note: "Boshlangʻich taʼlim · viloyatga koʻchdi",
  },
  {
    id: "ex-3",
    staffId: null,
    fullName: "Mirzayev Doniyor Alisherovich",
    position: "administrator",
    hiredAt: "2023-01-16",
    leftAt: "2026-02-14",
    reason: "oz-arizasi",
    note: "Qabul boʻlimi administratori",
  },
  {
    id: "ex-4",
    staffId: null,
    fullName: "Toʻrayeva Nilufar Rustamovna",
    position: "oqituvchi",
    hiredAt: "2025-08-25",
    leftAt: "2026-01-09",
    reason: "shartnoma-tugadi",
    note: "Musiqa · soatbay shartnoma yangilanmadi",
  },
];

// ───────────────────────── Kesimlar ─────────────────────────

export interface HrSummary {
  headcount: number;
  teachers: number;
  /** Oylik ish haqi fondi, soʻmda. */
  payroll: number;
  averageExperience: number;
  averageAge: number;
  onLeave: number;
  openVacancies: number;
  /** Toifasi 5 yildan oshgan yoki toifasiz ustozlar. */
  attestationDue: number;
  /** Yuklamasi normadan yuqori ustozlar. */
  overloaded: number;
  /** Kadrlar aylanmasi, foizda — oxirgi 12 oyda ketganlar ulushi. */
  turnoverPercent: number;
}

function yearsSince(date: string, at = TODAY): number {
  return (Date.parse(`${at}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 31_557_600_000;
}

/** Qayta attestatsiyaga chiqishi kerak boʻlgan xodimlar. */
export function attestationDue(list: Employee[] = EMPLOYEES): Employee[] {
  return list.filter(
    (e) =>
      e.status === "active" &&
      e.position === "oqituvchi" &&
      (e.qualification === "toifasiz" || yearsSince(e.qualifiedAt) >= QUALIFICATION_YEARS),
  );
}

/** Normadan ortiq yuklama — dam olishga vaqti qolmaydi, sifat tushadi. */
export function overloadedTeachers(list: Employee[] = EMPLOYEES): Employee[] {
  return list
    .filter((e) => e.status === "active" && e.weeklyHours > NORM_HOURS)
    .sort((a, b) => b.weeklyHours - a.weeklyHours);
}

/** Yuklamasi umuman yoʻq — stavka boʻsh turibdi. */
export function unloadedTeachers(list: Employee[] = EMPLOYEES): Employee[] {
  return list.filter(
    (e) => e.status === "active" && e.position === "oqituvchi" && e.weeklyHours === 0,
  );
}

export function hrSummary(
  employees: Employee[] = EMPLOYEES,
  leaves: LeaveRecord[] = LEAVES,
  vacancies: Vacancy[] = VACANCIES,
  exits: ExitRecord[] = EXITS,
): HrSummary {
  const active = employees.filter((e) => e.status === "active");
  const recentExits = exits.filter((e) => yearsSince(e.leftAt) <= 1).length;

  return {
    headcount: active.length,
    teachers: active.filter((e) => e.position === "oqituvchi").length,
    payroll: active.reduce((sum, e) => sum + e.salary, 0),
    averageExperience: active.length
      ? Number(
          (active.reduce((sum, e) => sum + yearsSince(e.hiredAt), 0) / active.length).toFixed(1),
        )
      : 0,
    averageAge: active.length
      ? Math.round(active.reduce((sum, e) => sum + yearsSince(e.birthDate), 0) / active.length)
      : 0,
    onLeave: onLeaveAt(TODAY, leaves).length,
    openVacancies: vacancies.filter((v) => v.status === "ochiq").length,
    attestationDue: attestationDue(employees).length,
    overloaded: overloadedTeachers(employees).length,
    // Aylanma = ketganlar / (hozirgi shtat + ketganlar).
    turnoverPercent: Math.round((recentExits / Math.max(1, active.length + recentExits)) * 100),
  };
}

/** Fan boʻyicha yuklama taqsimoti — vakansiya asosli ochilishi uchun. */
export interface SubjectLoad {
  subject: string;
  totalHours: number;
  teacherCount: number;
  averagePerTeacher: number;
}

export function subjectLoads(): SubjectLoad[] {
  const map = new Map<string, { hours: number; teachers: Set<string> }>();
  for (const teacher of allTeachers()) {
    for (const subject of teacher.subjects) {
      if (!map.has(subject)) map.set(subject, { hours: 0, teachers: new Set() });
      map.get(subject)!.teachers.add(teacher.id);
    }
  }
  // Soatlar haqiqiy yuklamadan — ustozning fanlari boʻyicha teng boʻlinadi.
  for (const teacher of allTeachers()) {
    const hours = weeklyLoadOf(teacher.id);
    if (teacher.subjects.length === 0) continue;
    const share = hours / teacher.subjects.length;
    for (const subject of teacher.subjects) {
      map.get(subject)!.hours += share;
    }
  }

  return Array.from(map.entries())
    .map(([subject, v]) => ({
      subject,
      totalHours: Math.round(v.hours),
      teacherCount: v.teachers.size,
      averagePerTeacher: Math.round(v.hours / Math.max(1, v.teachers.size)),
    }))
    .sort((a, b) => b.averagePerTeacher - a.averagePerTeacher);
}

export function staffLabel(staffId: string): string {
  return staffById(staffId)?.shortName ?? staffId;
}
