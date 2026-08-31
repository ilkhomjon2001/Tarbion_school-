"use client";

/**
 * Murojaatlar — backend bilan ishlash qatlami.
 *
 * Bu fayl bitta ish qiladi: generatsiya qilingan API javobini (`AppealOut`)
 * kabinetlardagi komponentlar allaqachon tushunadigan `Appeal` shakliga
 * oʻgiradi. Shu sabab `AppealThread` qayta yozilmadi — u mock bilan ham,
 * API bilan ham bir xil ishlaydi.
 *
 * Kirish nazorati BU YERDA EMAS. Ota-ona nimani koʻrishini server hal
 * qiladi (`appeals_service._scope()`); frontendda filtrlash — qulaylik,
 * himoya emas (CLAUDE.md 7-qoida).
 */

import {
  appealsAddMessage,
  appealsAppealsSummary,
  appealsComposeOptions,
  appealsCreateAppeal,
  appealsCreateNote,
  appealsGetAppeal,
  appealsListAppeals,
  appealsListNotes,
  appealsSearchStudents,
  appealsStatsClasses,
  appealsUpdateAssignee,
  appealsUpdateStatus,
  directorTeachers,
} from "@/lib/api/sdk.gen";
import type {
  AppealNoteOut,
  AppealOptionsOut,
  AppealOut,
  AppealSummaryOut,
  ClassAppealStatOut,
  ContactKind,
  StudentSearchOut,
  TeacherRowOut,
} from "@/lib/api/types.gen";
import type { AppealStatus, AppealTarget } from "@/lib/contracts";
import type { Appeal, AppealMessage } from "@/lib/school/appeals";
import { withAuth } from "@/lib/session";

export type { AppealNoteOut, AppealOptionsOut, AppealSummaryOut, ClassAppealStatOut };

/**
 * ISO vaqtni «2026-08-27 09:20» koʻrinishiga keltiradi.
 *
 * Bazada UTC, koʻrsatishda Asia/Tashkent (CLAUDE.md 3-qoida). Brauzer
 * mahalliy zonasiga tashlab qoʻyish notoʻgʻri boʻlardi: chet eldagi
 * ota-ona darsni notoʻgʻri soatda koʻrardi.
 */
const FORMATTER = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatMoment(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = FORMATTER.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function formatDay(iso: string | null | undefined): string {
  return iso ? formatMoment(iso).slice(0, 10) : "—";
}

/** Backend javobi → kabinetlardagi umumiy `Appeal` shakli. */
export function toAppeal(dto: AppealOut): Appeal {
  return {
    id: dto.id,
    target: dto.target as AppealTarget,
    assigneeId: dto.assignee_id ?? "",
    assigneeName: dto.assignee_name ?? undefined,
    subject: dto.subject_name ?? undefined,
    className: dto.class_name ?? "—",
    studentFullName: dto.student_name,
    parentName: dto.author_name,
    title: dto.title,
    status: dto.status as AppealStatus,
    createdAt: formatMoment(dto.created_at),
    dueAt: formatDay(dto.due_at),
    openedByName: dto.created_by_name ?? undefined,
    messages: (dto.messages ?? []).map(
      (m): AppealMessage => ({
        id: m.id,
        // Xabarni oila tomonimi yoki maktab yozganmi. Yozishmaning oila
        // tomoni — `author_id`; maktab boshlagan yozishmada birinchi
        // xabar xodimniki boʻladi va u shu taqqoslashda "staff" chiqadi.
        author: m.author_id === dto.author_id ? "parent" : "staff",
        authorName: m.author_name,
        text: m.body,
        createdAt: formatMoment(m.created_at),
      }),
    ),
  };
}

export interface AppealFilters {
  status?: AppealStatus;
  target?: AppealTarget;
  limit?: number;
}

export async function fetchAppeals(filters: AppealFilters = {}): Promise<Appeal[]> {
  const data = await withAuth<AppealOut[]>(() =>
    appealsListAppeals({
      query: {
        status: filters.status ?? null,
        target: filters.target ?? null,
        limit: filters.limit ?? 100,
      },
    }),
  );
  return data.map(toAppeal);
}

export async function fetchAppeal(id: string): Promise<Appeal> {
  const data = await withAuth<AppealOut>(() =>
    appealsGetAppeal({ path: { appeal_id: id } }),
  );
  return toAppeal(data);
}

export async function fetchSummary(): Promise<AppealSummaryOut> {
  return withAuth<AppealSummaryOut>(() => appealsAppealsSummary());
}

export async function fetchClassStats(): Promise<ClassAppealStatOut[]> {
  return withAuth<ClassAppealStatOut[]>(() => appealsStatsClasses());
}

/**
 * Forma variantlari.
 *
 * Generatsiya qilingan tipda `children` va `teachers` ixtiyoriy koʻrinadi:
 * Pydantic'da ular `default_factory` bilan eʼlon qilingan, shuning uchun
 * OpenAPI ularni `required` deb belgilamaydi. Javobda esa ular HAR DOIM
 * bor. Shu farqni bir joyda yopamiz — har bir komponentda `?? []` yozish
 * kechroq bittasida unutilardi.
 */
export interface ComposeChild {
  studentId: string;
  fullName: string;
  className: string | null;
  homeroomTeacherName: string | null;
  teachers: { id: string; fullName: string; subjectId: string; subjectName: string }[];
}

export async function fetchOptions(): Promise<ComposeChild[]> {
  const data = await withAuth<AppealOptionsOut>(() => appealsComposeOptions());
  return (data.children ?? []).map((child) => ({
    studentId: child.student_id,
    fullName: child.full_name,
    className: child.class_name ?? null,
    homeroomTeacherName: child.homeroom_teacher_name ?? null,
    teachers: (child.teachers ?? []).map((t) => ({
      id: t.id,
      fullName: t.full_name,
      subjectId: t.subject_id,
      subjectName: t.subject_name,
    })),
  }));
}

export async function createAppeal(input: {
  studentId: string;
  target: AppealTarget;
  title: string;
  body: string;
  subjectId?: string | null;
  assigneeId?: string | null;
}): Promise<Appeal> {
  const data = await withAuth<AppealOut>(() =>
    appealsCreateAppeal({
      body: {
        student_id: input.studentId,
        target: input.target,
        title: input.title,
        body: input.body,
        subject_id: input.subjectId ?? null,
        assignee_id: input.assigneeId ?? null,
      },
    }),
  );
  return toAppeal(data);
}

export async function sendMessage(appealId: string, body: string): Promise<void> {
  await withAuth(() =>
    appealsAddMessage({ path: { appeal_id: appealId }, body: { body } }),
  );
}

export async function setStatus(appealId: string, status: AppealStatus): Promise<Appeal> {
  const data = await withAuth<AppealOut>(() =>
    appealsUpdateStatus({ path: { appeal_id: appealId }, body: { status } }),
  );
  return toAppeal(data);
}

export async function assignAppeal(appealId: string, assigneeId: string): Promise<Appeal> {
  const data = await withAuth<AppealOut>(() =>
    appealsUpdateAssignee({
      path: { appeal_id: appealId },
      body: { assignee_id: assigneeId },
    }),
  );
  return toAppeal(data);
}

export async function fetchNotes(appealId: string): Promise<AppealNoteOut[]> {
  return withAuth<AppealNoteOut[]>(() =>
    appealsListNotes({ path: { appeal_id: appealId } }),
  );
}

export interface NoteInput {
  kind: ContactKind;
  summary: string;
  /** Suhbat muayyan ustoz haqida boʻlsa — kim haqida va qanday baholandi. */
  aboutTeacherId?: string | null;
  teacherRating?: number | null;
  teacherComment?: string | null;
}

export async function addNote(
  appealId: string,
  input: NoteInput,
): Promise<AppealNoteOut> {
  return withAuth<AppealNoteOut>(() =>
    appealsCreateNote({
      path: { appeal_id: appealId },
      body: {
        kind: input.kind,
        summary: input.summary,
        about_teacher_id: input.aboutTeacherId ?? null,
        // Ustoz tanlanmagan boʻlsa reyting yuborilmaydi — server buni
        // rad etadi ("reyting qoʻyish uchun ustozni tanlang").
        teacher_rating: input.aboutTeacherId ? (input.teacherRating ?? null) : null,
        teacher_comment: input.aboutTeacherId ? (input.teacherComment ?? null) : null,
      },
    }),
  );
}

/** Qayd formasidagi ustozlar roʻyxati — rahbariyat endpointidan. */
export async function fetchTeacherOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await withAuth<TeacherRowOut[]>(() => directorTeachers());
  return rows.map((t) => ({ id: t.id, name: t.short_name }));
}


export interface StudentMatch {
  studentId: string;
  fullName: string;
  className: string | null;
  guardians: { id: string; fullName: string; relation: string; isPrimary: boolean }[];
}

/**
 * ADM-16: yozishma boshlash uchun oʻquvchi qidiruvi.
 *
 * Vasiy oʻquvchi orqali topiladi — administrator ota-onalar roʻyxatidan
 * tanlamaydi. Shunda notoʻgʻri oilaga yozib yuborish ehtimoli yoʻqoladi.
 */
export async function searchStudents(query: string): Promise<StudentMatch[]> {
  const rows = await withAuth<StudentSearchOut[]>(() =>
    appealsSearchStudents({ query: { q: query } }),
  );
  return rows.map((row) => ({
    studentId: row.student_id,
    fullName: row.full_name,
    className: row.class_name ?? null,
    guardians: (row.guardians ?? []).map((g) => ({
      id: g.id,
      fullName: g.full_name,
      relation: g.relation,
      isPrimary: g.is_primary,
    })),
  }));
}

/** Maktab ota-ona bilan yozishmani boshlaydi (ADM-16). */
export async function startConversation(input: {
  studentId: string;
  guardianId: string;
  title: string;
  body: string;
}): Promise<Appeal> {
  const data = await withAuth<AppealOut>(() =>
    appealsCreateAppeal({
      body: {
        student_id: input.studentId,
        author_id: input.guardianId,
        // Yoʻnalishni server baribir `management` ga majburlaydi — maktab
        // boshlagan yozishmada oila tomonidan yozgan tomon bitta.
        target: "management",
        title: input.title,
        body: input.body,
      },
    }),
  );
  return toAppeal(data);
}
