/**
 * Ota-ona (vasiy) kabineti — demo maʼlumotlari.
 *
 * TZ: OTA-01…OTA-09, MUR-01…MUR-04, DAV-04.
 *
 * Pul CLAUDE.md 2-qoidasiga koʻra BUTUN SONDA, soʻmda saqlanadi —
 * float ishlatilmaydi, tiyin yoʻq.
 */

export type AttendanceStatus = "present" | "absent" | "excused" | "late";

export interface Child {
  id: string;
  fullName: string;
  shortName: string;
  className: string;
  /** Vasiyning shu bolaga qarindoshligi. */
  relation: string;
}

export interface DayAttendance {
  date: string;
  /** Kun boʻyicha paralar holati. */
  lessons: { period: number; subject: string; status: AttendanceStatus }[];
}

export interface GradeItem {
  date: string;
  subject: string;
  value: number;
  maxValue: number;
  kind: "current" | "control";
  comment?: string;
}

export interface SubjectSummary {
  subject: string;
  average: number;
  termGrade: number;
  /** Oxirgi 6 ta baho — oʻsish grafigi uchun (OTA-04). */
  trend: number[];
}

export interface HomeworkStatusItem {
  id: string;
  subject: string;
  title: string;
  dueAt: string;
  status: "assigned" | "submitted" | "late" | "graded";
  score: number | null;
  maxScore: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  from: string;
  createdAt: string;
  important: boolean;
}

export interface PaymentRecord {
  id: string;
  /** Soʻmda, butun son (CLAUDE.md 2-qoida). */
  amount: number;
  paidAt: string;
  method: string;
  receiptNo: string;
}

export interface AppealItem {
  id: string;
  topic: string;
  body: string;
  createdAt: string;
  status: "new" | "in_review" | "answered" | "closed";
  assignee: string;
  /** MUR-04: javob berish muddati. */
  dueAt: string;
  answer?: string;
  answeredAt?: string;
}

export const APPEAL_STATUS_LABELS: Record<AppealItem["status"], string> = {
  new: "Yangi",
  in_review: "Koʻrib chiqilmoqda",
  answered: "Javob berildi",
  closed: "Yopilgan",
};

export const APPEAL_TOPICS = [
  "Davomat boʻyicha",
  "Baho boʻyicha",
  "Toʻlov boʻyicha",
  "Dars jadvali",
  "Sinf rahbariga",
  "Boshqa",
];

export const TODAY = "2026-08-29";
export const TODAY_LABEL = "29-avgust, shanba";

// ─────────────────────────── Farzandlar (OTA-02) ───────────────────────────

export const CHILDREN: Child[] = [
  {
    id: "c-1",
    fullName: "Abdullayev Alisher Rustamovich",
    shortName: "Alisher",
    className: "11-A",
    relation: "Otasi",
  },
  {
    id: "c-2",
    fullName: "Abdullayeva Zarina Rustamovna",
    shortName: "Zarina",
    className: "6-B",
    relation: "Otasi",
  },
];

// ─────────────────────────── Davomat (OTA-03) ───────────────────────────

const SUBJECTS_11A = ["Matematika", "Algebra", "Geometriya", "Fizika", "Ona tili"];
const SUBJECTS_6B = ["Matematika", "Robototexnika", "Ona tili", "Ingliz tili"];

/**
 * Avgust oyining davomati. Sanalar qatʼiy — demo har safar bir xil
 * koʻrinishi uchun.
 */
const ABSENCES: Record<string, Record<string, AttendanceStatus>> = {
  "c-1": {
    "2026-08-26": "absent",
    "2026-08-27": "late",
    "2026-08-28": "excused",
  },
  "c-2": {
    "2026-08-25": "excused",
    "2026-08-28": "late",
  },
};

export function attendanceForMonth(childId: string, year: number, month: number): DayAttendance[] {
  const subjects = childId === "c-1" ? SUBJECTS_11A : SUBJECTS_6B;
  const out: DayAttendance[] = [];
  const last = new Date(year, month, 0).getDate();

  for (let d = 1; d <= last; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const wd = new Date(`${date}T00:00:00`).getDay();
    if (wd === 0) continue; // yakshanba — dars yoʻq
    if (date > TODAY) continue; // kelajak kunlar koʻrsatilmaydi

    const special = ABSENCES[childId]?.[date];
    const count = 4 + (d % 2);
    out.push({
      date,
      lessons: Array.from({ length: count }, (_, i) => ({
        period: i + 1,
        subject: subjects[i % subjects.length],
        // Faqat bitta parada istisno boʻladi, qolgani "keldi".
        status: special && i === 1 ? special : ("present" as AttendanceStatus),
      })),
    });
  }
  return out;
}

export function monthSummary(days: DayAttendance[]) {
  let present = 0;
  let absent = 0;
  let excused = 0;
  let late = 0;
  for (const day of days) {
    for (const l of day.lessons) {
      if (l.status === "present") present++;
      else if (l.status === "absent") absent++;
      else if (l.status === "excused") excused++;
      else late++;
    }
  }
  const total = present + absent + excused + late;
  return {
    total,
    present,
    absent,
    excused,
    late,
    percent: total ? Math.round(((present + late) / total) * 100) : 100,
  };
}

/** Kun uchun umumiy holat — kalendar katakchasi rangi uchun. */
export function dayStatus(day: DayAttendance): AttendanceStatus {
  if (day.lessons.some((l) => l.status === "absent")) return "absent";
  if (day.lessons.some((l) => l.status === "excused")) return "excused";
  if (day.lessons.some((l) => l.status === "late")) return "late";
  return "present";
}

// ─────────────────────────── Baholar (OTA-04) ───────────────────────────

export const SUBJECT_SUMMARY: Record<string, SubjectSummary[]> = {
  "c-1": [
    { subject: "Matematika", average: 4.4, termGrade: 4, trend: [4, 3, 5, 4, 5, 5] },
    { subject: "Algebra", average: 4.8, termGrade: 5, trend: [5, 4, 5, 5, 5, 5] },
    { subject: "Geometriya", average: 3.6, termGrade: 4, trend: [3, 3, 4, 3, 4, 5] },
    { subject: "Fizika", average: 4.0, termGrade: 4, trend: [4, 4, 3, 4, 5, 4] },
    { subject: "Ona tili", average: 4.6, termGrade: 5, trend: [5, 4, 5, 4, 5, 5] },
  ],
  "c-2": [
    { subject: "Matematika", average: 3.8, termGrade: 4, trend: [3, 4, 3, 4, 4, 5] },
    { subject: "Robototexnika", average: 5.0, termGrade: 5, trend: [5, 5, 5, 5, 5, 5] },
    { subject: "Ona tili", average: 4.2, termGrade: 4, trend: [4, 4, 5, 4, 4, 4] },
    { subject: "Ingliz tili", average: 3.4, termGrade: 3, trend: [3, 3, 4, 3, 3, 4] },
  ],
};

export const RECENT_GRADES: Record<string, GradeItem[]> = {
  "c-1": [
    { date: "2026-08-28", subject: "Algebra", value: 5, maxValue: 5, kind: "control", comment: "Nazorat ishi aʼlo bajarilgan." },
    { date: "2026-08-28", subject: "Ona tili", value: 5, maxValue: 5, kind: "current" },
    { date: "2026-08-27", subject: "Geometriya", value: 4, maxValue: 5, kind: "current" },
    { date: "2026-08-27", subject: "Matematika", value: 5, maxValue: 5, kind: "current" },
    { date: "2026-08-26", subject: "Fizika", value: 4, maxValue: 5, kind: "current" },
  ],
  "c-2": [
    { date: "2026-08-28", subject: "Robototexnika", value: 5, maxValue: 5, kind: "current", comment: "Loyihani mustaqil yigʻdi." },
    { date: "2026-08-28", subject: "Ingliz tili", value: 4, maxValue: 5, kind: "current" },
    { date: "2026-08-27", subject: "Matematika", value: 4, maxValue: 5, kind: "current" },
    { date: "2026-08-26", subject: "Ona tili", value: 4, maxValue: 5, kind: "current" },
  ],
};

// ─────────────────────────── Uy vazifasi (OTA-05) ───────────────────────────

export const HOMEWORK: Record<string, HomeworkStatusItem[]> = {
  "c-1": [
    { id: "h-1", subject: "Algebra", title: "Kvadrat tenglamalar — 5-mashq", dueAt: "2026-08-30", status: "submitted", score: null, maxScore: 5 },
    { id: "h-2", subject: "Geometriya", title: "Uchburchaklar tengligi", dueAt: "2026-08-28", status: "graded", score: 4, maxScore: 5 },
    { id: "h-3", subject: "Fizika", title: "Mexanika — masalalar", dueAt: "2026-09-01", status: "assigned", score: null, maxScore: 5 },
    { id: "h-4", subject: "Ona tili", title: "Insho: «Vatan tuygʻusi»", dueAt: "2026-08-27", status: "late", score: null, maxScore: 5 },
  ],
  "c-2": [
    { id: "h-5", subject: "Robototexnika", title: "ESP32 — birinchi dastur", dueAt: "2026-08-31", status: "submitted", score: null, maxScore: 5 },
    { id: "h-6", subject: "Matematika", title: "Kasrlar ustida amallar", dueAt: "2026-09-01", status: "assigned", score: null, maxScore: 5 },
    { id: "h-7", subject: "Ingliz tili", title: "Unit 3 — vocabulary", dueAt: "2026-08-28", status: "graded", score: 4, maxScore: 5 },
  ],
};

// ─────────────────────────── Eʼlonlar (OTA-08) ───────────────────────────

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a-1",
    title: "Ota-onalar majlisi — 5-sentabr, soat 15:00",
    body: "Hurmatli ota-onalar! 5-sentabr kuni soat 15:00 da 204-xonada sinf majlisi boʻlib oʻtadi. Chorak yakunlari muhokama qilinadi.",
    from: "Aliyev S. — sinf rahbari",
    createdAt: "2026-08-28 14:30",
    important: true,
  },
  {
    id: "a-2",
    title: "Nazorat ishi — 8-sentabr",
    body: "8-sentabr kuni kvadrat tenglamalar boʻyicha nazorat ishi boʻladi. Darslikning 38–46-betlari kiradi.",
    from: "Aliyev S. — matematika",
    createdAt: "2026-08-27 09:15",
    important: false,
  },
  {
    id: "a-3",
    title: "Maktab formasi haqida eslatma",
    body: "1-sentabrdan boshlab maktab formasi majburiy. Savollar boʻlsa administratsiyaga murojaat qiling.",
    from: "Maktab administratsiyasi",
    createdAt: "2026-08-25 11:00",
    important: false,
  },
];

// ─────────────────────────── Toʻlov (OTA-06) ───────────────────────────

export interface PaymentState {
  /** Oylik shartnoma summasi, soʻmda. */
  monthlyFee: number;
  /** Joriy qarzdorlik, soʻmda. Manfiy boʻlsa — oldindan toʻlangan. */
  balance: number;
  nextDueDate: string;
  history: PaymentRecord[];
}

export const PAYMENTS: Record<string, PaymentState> = {
  "c-1": {
    monthlyFee: 3_500_000,
    balance: 3_500_000,
    nextDueDate: "2026-09-05",
    history: [
      { id: "p-1", amount: 3_500_000, paidAt: "2026-08-04", method: "Plastik karta", receiptNo: "TRB-2026-08-0412" },
      { id: "p-2", amount: 3_500_000, paidAt: "2026-07-03", method: "Naqd", receiptNo: "TRB-2026-07-0311" },
      { id: "p-3", amount: 3_500_000, paidAt: "2026-06-05", method: "Plastik karta", receiptNo: "TRB-2026-06-0508" },
    ],
  },
  "c-2": {
    monthlyFee: 3_200_000,
    balance: 0,
    nextDueDate: "2026-09-05",
    history: [
      { id: "p-4", amount: 3_200_000, paidAt: "2026-08-04", method: "Plastik karta", receiptNo: "TRB-2026-08-0413" },
      { id: "p-5", amount: 3_200_000, paidAt: "2026-07-03", method: "Plastik karta", receiptNo: "TRB-2026-07-0312" },
    ],
  },
};

/** Pulni oʻzbekcha formatda koʻrsatish: 3 500 000 soʻm */
export function formatSom(amount: number): string {
  return `${amount.toLocaleString("uz-UZ").replace(/,/g, " ")} soʻm`;
}

// ─────────────────────────── Murojaatlar (OTA-07, MUR) ───────────────────────────

export const APPEALS: AppealItem[] = [
  {
    id: "m-1",
    topic: "Davomat boʻyicha",
    body: "Assalomu alaykum. 26-avgust kuni Alisher shifokorda edi, lekin davomatda sababsiz koʻrsatilgan. Iltimos tekshirib bering.",
    createdAt: "2026-08-27 18:22",
    status: "answered",
    assignee: "Aliyev S. — sinf rahbari",
    dueAt: "2026-08-29",
    answer: "Assalomu alaykum. Tekshirdik, davomat sababli deb tuzatildi. Maʼlumot uchun rahmat.",
    answeredAt: "2026-08-28 09:40",
  },
  {
    id: "m-2",
    topic: "Dars jadvali",
    body: "Payshanba kuni 6-para juda kech tugayapti. Avvalroq qilish imkoni bormi?",
    createdAt: "2026-08-28 20:10",
    status: "in_review",
    assignee: "Maktab administratsiyasi",
    dueAt: "2026-09-01",
  },
];
