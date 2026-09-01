"use client";

/**
 * Audit jurnali — backend qatlami (T-021).
 *
 * Faqat oʻqish. Yozish funksiyasi ATAYLAB yoʻq: jurnal servislardan
 * avtomatik toʻladi va bazada `UPDATE`/`DELETE` trigger bilan
 * toʻsilgan.
 */

import { auditEntries, auditFilters } from "@/lib/api/sdk.gen";
import type { AuditEntryOut, AuditFiltersOut, AuditPageOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { AuditEntryOut, AuditFiltersOut, AuditPageOut };

export type AuditFilter = {
  objectType?: string;
  action?: string;
  /** `YYYY-MM-DD`, MAHALLIY kun (server Toshkent chegarasini oladi). */
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export async function fetchAudit(filter: AuditFilter = {}): Promise<AuditPageOut> {
  return withAuth<AuditPageOut>(() =>
    auditEntries({
      query: {
        object_type: filter.objectType || undefined,
        action: filter.action || undefined,
        date_from: filter.dateFrom || undefined,
        date_to: filter.dateTo || undefined,
        q: filter.query || undefined,
        limit: filter.limit ?? 50,
        offset: filter.offset ?? 0,
      },
    }),
  );
}

/** Jurnalda HAQIQATAN uchraydigan turlar — qatʼiy roʻyxat emas. */
export async function fetchAuditFilters(): Promise<AuditFiltersOut> {
  return withAuth<AuditFiltersOut>(() => auditFilters());
}

// ─────────────────────────── Koʻrsatish ───────────────────────────

/** Obyekt turining oʻzbekcha nomi. Roʻyxatda yoʻq turi — oʻzi qaytadi. */
export const OBJECT_LABELS: Record<string, string> = {
  user: "Foydalanuvchi",
  student: "Oʻquvchi",
  class: "Sinf",
  subject: "Fan",
  class_subject: "Sinf fani",
  teacher_subjects: "Ustoz fanlari",
  academic_year: "Oʻquv yili",
  term: "Chorak",
  holiday: "Taʼtil",
  bell_schedule: "Qoʻngʻiroq",
  schedule_entry: "Dars jadvali",
  lessons: "Darslar",
  attendance: "Davomat",
  grade: "Baho",
  homework: "Uy vazifasi",
  homework_submission: "Topshiriq",
  test: "Test",
  test_question: "Test savoli",
  test_attempt: "Test urinishi",
  permission: "Huquq",
  refresh_token: "Sessiya",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "Qoʻshildi",
  update: "Oʻzgartirildi",
  archive: "Arxivlandi",
  login: "Kirdi",
  logout: "Chiqdi",
  reuse_detected: "Token qayta ishlatildi",
};

export const ACTION_TONES: Record<
  string,
  "success" | "info" | "neutral" | "warning" | "danger"
> = {
  create: "success",
  update: "info",
  archive: "neutral",
  login: "neutral",
  logout: "neutral",
  reuse_detected: "danger",
};

const FMT = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Toshkent boʻyicha koʻrsatiladi (CLAUDE.md 3-qoida). */
export function formatMoment(iso: string): string {
  return FMT.format(new Date(iso));
}

/**
 * Oʻzgargan qiymatni oʻqiladigan matnga aylantiradi.
 *
 * Audit faqat OʻZGARGAN maydonlarni saqlaydi, shuning uchun bu odatda
 * bir-ikki juftlik. UUID lar qisqartiriladi — toʻliq koʻrsatilsa
 * qator oʻqilmay qoladi.
 */
export function describeValue(value: Record<string, unknown> | null): string {
  if (!value) return "";
  return Object.entries(value)
    .map(([k, v]) => `${k}: ${shorten(v)}`)
    .join(" · ");
}

function shorten(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = String(v);
  // UUID: 8-4-4-4-12. Faqat boshini koʻrsatamiz.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return s.slice(0, 8) + "…";
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}
