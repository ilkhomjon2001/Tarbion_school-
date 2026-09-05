"use client";

/**
 * Ota-ona kabineti — backend bilan ishlash qatlami (T-016).
 *
 * API javobini kabinet allaqachon tushunadigan `Child` /
 * `DayAttendance` shakliga oʻgiradi, shuning uchun sahifalar deyarli
 * qayta yozilmadi.
 *
 * Kirish nazorati BU YERDA EMAS. Ota-ona qaysi bolani koʻrishini server
 * hal qiladi (`services/access.py`, X-1) — bu yerda filtrlash boʻlsa,
 * u qulaylik boʻlardi, himoya emas (CLAUDE.md 7-qoida).
 */

import {
  attendanceStats,
  parentChildAttendance,
  parentMyChildren,
} from "@/lib/api/sdk.gen";
import type {
  AttendanceStatOut,
  ChildOut,
  DayAttendanceOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { AttendanceStatOut };

// ────────────────────── Kabinet shakllari ──────────────────────

export type AttendanceStatus = "present" | "absent" | "excused" | "late";

export interface Child {
  id: string;
  fullName: string;
  shortName: string;
  className: string;
  /** Vasiyning shu bolaga qarindoshligi. */
  relation: string;
  /** Maktabdan ketgan — faqat qarzi qolgani uchun roʻyxatda (O7). */
  isArchived: boolean;
}

export interface DayAttendance {
  date: string;
  /** Kun boʻyicha paralar holati. */
  lessons: { period: number; subject: string; status: AttendanceStatus }[];
}

/** Kun uchun umumiy holat — kalendar katakchasi rangi uchun. */
export function dayStatus(day: DayAttendance): AttendanceStatus {
  if (day.lessons.some((l) => l.status === "absent")) return "absent";
  if (day.lessons.some((l) => l.status === "excused")) return "excused";
  if (day.lessons.some((l) => l.status === "late")) return "late";
  return "present";
}

/** Vasiyning qarindoshligi — bazada kod, ekranda oʻzbekcha. */
const RELATION_UZ: Record<string, string> = {
  father: "Otasi",
  mother: "Onasi",
  guardian: "Qonuniy vakili",
  grandparent: "Bobosi/buvisi",
  other: "Qarindoshi",
};

function toChild(row: ChildOut): Child {
  return {
    id: row.student_id,
    fullName: row.full_name,
    shortName: row.short_name,
    className: row.class_name,
    relation: RELATION_UZ[row.relation] ?? row.relation,
    isArchived: row.is_archived ?? false,
  };
}

export async function fetchChildren(): Promise<Child[]> {
  const data = await withAuth<ChildOut[]>(() => parentMyChildren());
  return data.map(toChild);
}

/**
 * Farzandning kunma-kun davomati (OTA-03).
 *
 * Sana berilmasa server joriy oyni qaytaradi. Faqat davomat
 * BELGILANGAN kunlar keladi — ustoz hali belgilamagan dars kalendarda
 * «kelmadi» boʻlib koʻrinib, ota-onani bekorga xavotirga solmasin.
 */
export async function fetchAttendance(
  studentId: string,
  range?: { from: string; to: string },
): Promise<DayAttendance[]> {
  const data = await withAuth<DayAttendanceOut[]>(() =>
    parentChildAttendance({
      path: { student_id: studentId },
      query: range ? { date_from: range.from, date_to: range.to } : undefined,
    }),
  );

  return data.map((d) => ({
    date: d.date,
    lessons: d.lessons.map((l) => ({
      period: l.period,
      subject: l.subject,
      status: l.status,
    })),
  }));
}

/**
 * Davomat foizi va sanoqlari — BACKEND formulasi bilan (Y10).
 *
 * Foiz clientda qayta hisoblanmaydi: ota-ona, oʻquvchi va direktor
 * kabinetlari bitta `GET /attendance/stats` javobini koʻrsatadi —
 * yagona haqiqat manbai serverda.
 */
export async function fetchAttendanceStats(
  studentId: string,
  range: { from: string; to: string },
): Promise<AttendanceStatOut> {
  return withAuth<AttendanceStatOut>(() =>
    attendanceStats({
      query: { student_id: studentId, date_from: range.from, date_to: range.to },
    }),
  );
}

/** Oyning birinchi va oxirgi kuni — kalendar soʻrovi uchun. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
