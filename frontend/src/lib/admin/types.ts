/**
 * Administrator kabineti maʼlumot modeli.
 *
 * Admin — kun boʻyi maʼlumot kiritadigan rol: oʻquvchi qabul qiladi,
 * toʻlov oladi, hujjat beradi, ota-ona bilan gaplashadi. Shu sabab bu
 * yerdagi tiplar "amal" atrofida qurilgan, koʻrsatkich atrofida emas.
 *
 * CLAUDE.md qoidalari model darajasida:
 *   – pul BUTUN SONDA, soʻmda (2-qoida);
 *   – hech narsa oʻchirilmaydi, `status: "archived"` (1-qoida);
 *   – toʻlov yozuvi tahrirlanmaydi — xato boʻlsa storno (9-qoida);
 *   – har bir amal `AuditEntry` hosil qiladi (4-qoida).
 */

export type StudentStatus = "active" | "archived";

export interface AdminStudent {
  id: string;
  fullName: string;
  className: string;
  birthYear: number;
  guardianName: string;
  guardianPhone: string;
  /** Qabul qilingan sana, ISO. */
  enrolledAt: string;
  /** Oylik shartnoma summasi, soʻmda. */
  monthlyFee: number;
  /** Shu oy uchun toʻlangan summa, soʻmda. */
  paidAmount: number;
  /** Toʻlov muddati, ISO. */
  dueDate: string;
  attendancePercent: number;
  discountPercent: number;
  status: StudentStatus;
}

// ─────────────────────────── Toʻlovlar ───────────────────────────

export type PaymentMethod = "naqd" | "karta" | "bank";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  naqd: "Naqd",
  karta: "Karta",
  bank: "Bank oʻtkazmasi",
};

export interface PaymentEntry {
  id: string;
  studentId: string;
  /** Musbat — toʻlov, manfiy — storno tuzatuvi. */
  amount: number;
  method: PaymentMethod;
  /** Toʻlov sanasi, ISO. */
  paidAt: string;
  receiptNo: string;
  note: string;
  createdBy: string;
  kind: "payment" | "storno";
}

export type DebtActionType = "extend" | "discount" | "writeoff";

export const DEBT_ACTION_LABELS: Record<DebtActionType, string> = {
  extend: "Muddat choʻzildi",
  discount: "Chegirma berildi",
  writeoff: "Hisobdan chiqarildi",
};

export interface DebtAction {
  id: string;
  studentId: string;
  type: DebtActionType;
  /** `extend` uchun yangi muddat, ISO. */
  newDueDate?: string;
  /** `discount` uchun foiz. */
  percent?: number;
  /** `writeoff` uchun summa, soʻmda. */
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface Reminder {
  id: string;
  studentIds: string[];
  channel: "bot" | "sms";
  text: string;
  sentAt: string;
  sentBy: string;
}

// ─────────────────────────── Qabul ───────────────────────────

export type ApplicationStatus = "new" | "accepted" | "rejected";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "Yangi",
  accepted: "Qabul qilindi",
  rejected: "Rad etildi",
};

export interface Application {
  id: string;
  studentFullName: string;
  birthDate: string;
  gender: "erkak" | "ayol";
  previousSchool: string;
  guardianFullName: string;
  guardianPhone: string;
  guardianRelation: string;
  address: string;
  className: string;
  academicYear: string;
  enrollDate: string;
  monthlyFee: number;
  discountPercent: number;
  discountReason: string;
  payDay: number;
  note: string;
  status: ApplicationStatus;
  createdAt: string;
}

// ─────────────────────────── Maʼlumotnomalar ───────────────────────────

export type DocumentType =
  | "oquv_joyi"
  | "daromad"
  | "harbiy"
  | "baho_kochirmasi"
  | "tibbiy";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  oquv_joyi: "Oʻquv joyi haqida",
  daromad: "Daromad uchun",
  harbiy: "Harbiy komissariat uchun",
  baho_kochirmasi: "Baho koʻchirmasi",
  tibbiy: "Tibbiy maʼlumotnoma (086-U)",
};

export type DocumentStatus = "new" | "waiting" | "issued";

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  new: "Yangi",
  waiting: "Kutishda",
  issued: "Berildi",
};

export interface DocumentRequest {
  id: string;
  studentId: string;
  type: DocumentType;
  /** Kim soʻragan — odatda ota-ona. */
  requestedBy: string;
  createdAt: string;
  status: DocumentStatus;
  /** Berilgandan keyin toʻladi. */
  number?: string;
  issuedAt?: string;
  issuedBy?: string;
  recipient?: string;
  copies?: number;
  extraText?: string;
}

// ─────────────────────── Suhbat qaydnomasi ───────────────────────

export type ConversationKind = "telefon" | "yuzma" | "onlayn";

export const CONVERSATION_KIND_LABELS: Record<ConversationKind, string> = {
  telefon: "Telefon",
  yuzma: "Yuzma-yuz",
  onlayn: "Onlayn",
};

/**
 * Admin ota-ona bilan suhbatdan keyin yozadigan qayd. Ustoz haqidagi
 * fikr shu yerdan soʻrovnoma natijalariga qoʻshiladi — ikkala manba
 * bitta ustoz profilida yigʻiladi.
 */
export interface ConversationNote {
  id: string;
  appealId: string;
  kind: ConversationKind;
  date: string;
  summary: string;
  teacherId?: string;
  rating?: number;
  comment?: string;
  authorName: string;
  createdAt: string;
}

// ─────────────────────────── Soʻrovnoma ───────────────────────────

export interface SurveyCriterion {
  label: string;
  score: number;
}

export interface SurveyComment {
  id: string;
  text: string;
  className: string;
}

export interface TeacherSurveyResult {
  teacherId: string;
  /** 1..5 baholar taqsimoti. */
  distribution: Record<number, number>;
  responseCount: number;
  average: number;
  criteria: SurveyCriterion[];
  comments: SurveyComment[];
}

export interface SurveyRound {
  id: string;
  label: string;
  sentCount: number;
  answeredCount: number;
}

// ─────────────────────────── Audit ───────────────────────────

export type AuditAction =
  | "payment"
  | "storno"
  | "debt"
  | "reminder"
  | "enroll"
  | "archive"
  | "document"
  | "note";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  payment: "Toʻlov kiritildi",
  storno: "Storno",
  debt: "Qarzdorlik amali",
  reminder: "Eslatma yuborildi",
  enroll: "Oʻquvchi qabul qilindi",
  archive: "Arxivlandi",
  document: "Maʼlumotnoma berildi",
  note: "Suhbat qaydnomasi",
};

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  /** Nimaga tegishli — oʻquvchi ismi yoki hujjat raqami. */
  entity: string;
  detail: string;
}
