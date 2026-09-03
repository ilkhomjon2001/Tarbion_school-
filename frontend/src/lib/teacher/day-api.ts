/**
 * Kunlik davomat klienti (T-015, DAV-02).
 *
 * Butun kun BITTA soʻrovda yuklanadi va BITTA soʻrovda saqlanadi.
 * Sabab ikkalasi uchun bir xil: ustoz 8 ta darsni 8 marta kutib
 * oʻtirmasin, va yarmi saqlanib yarmi saqlanmasligi mumkin boʻlmasin.
 */

import { attendanceClassDay, attendanceMarkClassDay } from "@/lib/api/sdk.gen";
import type { AttendanceMarkOut, ClassDayOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { ClassDayOut };
export type DayLesson = ClassDayOut["lessons"][number];
export type DayStudent = ClassDayOut["students"][number];
export type DayMark = ClassDayOut["marks"][number];

export async function fetchClassDay(classId: string, on: string): Promise<ClassDayOut> {
  return withAuth<ClassDayOut>(() =>
    attendanceClassDay({ path: { class_id: classId }, query: { on } }),
  );
}

export type DayEntry = {
  lesson_id: string;
  rows: { student_id: string; status: string; note?: string | null }[];
};

export async function saveClassDay(
  classId: string,
  lessonDate: string,
  entries: DayEntry[],
): Promise<AttendanceMarkOut> {
  return withAuth<AttendanceMarkOut>(() =>
    attendanceMarkClassDay({
      path: { class_id: classId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: { lesson_date: lessonDate, entries } as any,
    }),
  );
}
