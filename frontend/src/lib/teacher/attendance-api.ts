"use client";

/**
 * Davomat — backend bilan ishlash qatlami (T-014).
 *
 * Bu fayl bitta ish qiladi: API javobini (`TeacherLessonOut`,
 * `LessonAttendanceOut`) ustoz kabineti allaqachon tushunadigan
 * `TeacherLesson` / `AttendanceRow` shakliga oʻgiradi. Shu sabab
 * davomat ekrani va bosh sahifa deyarli qayta yozilmadi.
 *
 * Funksiya nomlari `lib/teacher/store.ts` dagilar bilan bir xil
 * (`getTodayLessons`, `getAttendance`, `saveAttendance`) — sahifalar
 * faqat importni almashtiradi.
 *
 * Kirish nazorati BU YERDA EMAS. Ustoz qaysi darsni koʻrishini server
 * hal qiladi (`services/access.py`); frontenddagi tekshiruv — qulaylik,
 * himoya emas (CLAUDE.md 7-qoida).
 */

import {
  attendanceLessonAttendance,
  attendanceMark,
  attendanceMyLessons,
} from "@/lib/api/sdk.gen";
import type { LessonAttendanceOut, TeacherLessonOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";
import type { AttendanceRow, AttendanceStatus, TeacherLesson } from "@/lib/teacher/types";

/**
 * ISO vaqtdan «08:30» chiqaradi.
 *
 * Bazada UTC, koʻrsatishda Asia/Tashkent (CLAUDE.md 3-qoida). Brauzer
 * mahalliy zonasiga tashlab qoʻyilsa, chet elda turgan ota-ona yoki
 * boshqa zonaga sozlangan maktab kompyuteri darsni notoʻgʻri soatda
 * koʻrsatardi.
 */
const TIME_FMT = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toTime(iso: string): string {
  return TIME_FMT.format(new Date(iso));
}

const DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** «2026-08-31» — mahalliy sana. `en-CA` ataylab: u ISO shaklida beradi. */
function toDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

function toLesson(row: TeacherLessonOut): TeacherLesson {
  return {
    id: row.id,
    date: toDate(row.starts_at),
    period: row.period,
    startTime: toTime(row.starts_at),
    endTime: toTime(row.ends_at),
    className: row.class_name,
    subject: row.subject_name,
    room: row.room ?? "",
    studentCount: row.student_count,
    // Belgilanmagan dars uchun `null` — «0 kishi keldi» degani EMAS.
    presentCount: row.marked ? row.present_count : null,
    editable: row.editable,
  };
}

export async function getTodayLessons(): Promise<TeacherLesson[]> {
  const data = await withAuth<TeacherLessonOut[]>(() => attendanceMyLessons());
  return data.map(toLesson);
}

/**
 * Dars roʻyxati va mavjud davomat.
 *
 * Backend belgilanmagan oʻquvchini `status: null` bilan qaytaradi, ustoz
 * ekrani esa har doim biror holat kutadi. Sukut — «keldi»: ustoz faqat
 * ISTISNOlarni bosadi, 25 kishilik sinfda bu 25 marta bosishni 2-3 taga
 * tushiradi.
 */
export async function getAttendance(lessonId: string): Promise<{
  lesson: TeacherLesson;
  rows: AttendanceRow[];
  topic: string;
} | null> {
  let data: LessonAttendanceOut;
  try {
    data = await withAuth<LessonAttendanceOut>(() =>
      attendanceLessonAttendance({ path: { lesson_id: lessonId } }),
    );
  } catch {
    // Dars topilmadi yoki ruxsat yoʻq — ekran «topilmadi» holatini
    // koʻrsatadi. Sababni ajratib koʻrsatmaymiz (X-3).
    return null;
  }

  const lesson: TeacherLesson = {
    id: data.lesson_id,
    date: data.lesson_date,
    period: data.period,
    startTime: toTime(data.starts_at),
    endTime: toTime(data.ends_at),
    className: data.class_name,
    subject: data.subject_name,
    room: data.room ?? "",
    studentCount: data.students.length,
    presentCount: data.marked_at
      ? data.students.filter((s) => s.status === "present" || s.status === "late").length
      : null,
    editable: data.editable,
  };

  return {
    lesson,
    rows: data.students.map((s) => ({
      studentId: s.student_id,
      fullName: s.full_name,
      status: (s.status ?? "present") as AttendanceStatus,
      note: s.note ?? "",
    })),
    topic: data.topic ?? "",
  };
}

/**
 * Butun sinf davomatini saqlaydi.
 *
 * `planIndex` backendga yuborilmaydi: reja indeksi frontenddagi hisob
 * (`lib/teacher/plan.ts`), serverda ustuni yoʻq. U hozircha
 * localStorage da qoladi — reja moduli backendga chiqqanda (MET-01)
 * shu yerga qoʻshiladi.
 */
export async function saveAttendance(
  lessonId: string,
  rows: AttendanceRow[],
  meta: { topic: string; planIndex: number | null },
): Promise<void> {
  await withAuth(() =>
    attendanceMark({
      path: { lesson_id: lessonId },
      body: {
        rows: rows.map((r) => ({
          student_id: r.studentId,
          status: r.status,
          note: r.note.trim() || null,
        })),
        topic: meta.topic,
      },
    }),
  );
}
