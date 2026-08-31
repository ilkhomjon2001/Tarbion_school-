"use client";

/**
 * Maʼlumotnoma va xodimlar — backend qatlami (T-008, T-009, T-011).
 *
 * Bu yerda mock yoʻq: sinf, fan, xodim va dars jadvali serverdan keladi.
 *
 * Kirish nazorati bu qatlamda EMAS. Xodim yaratish `users.create`,
 * fan biriktirish `users.manage`, jadval `schedule.manage` huquqini
 * talab qiladi va hammasini server tekshiradi (CLAUDE.md 7-qoida).
 */

import { useCallback, useEffect, useState } from "react";

import {
  scheduleAddEntry,
  scheduleArchiveEntry,
  scheduleEntries,
  scheduleTeacherLoad,
  scheduleUpdateEntry,
  schoolArchiveStaff,
  schoolClasses,
  schoolCreateStaff,
  schoolResetStaffPassword,
  schoolSetStaffSubjects,
  schoolStaff,
  schoolStudents,
  schoolSubjects,
} from "@/lib/api/sdk.gen";
import type {
  ClassOut,
  PasswordResetOut,
  ScheduleEntryOut,
  StaffCreatedOut,
  StaffOut,
  StudentListRowOut,
  SubjectOut,
  TeacherLoadOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type {
  ClassOut,
  PasswordResetOut,
  ScheduleEntryOut,
  StaffCreatedOut,
  StaffOut,
  StudentListRowOut,
  SubjectOut,
  TeacherLoadOut,
};

/** 1 = dushanba … 7 = yakshanba (ISO — backend bilan bir xil). */
export const WEEKDAYS_UZ: { id: number; short: string; long: string }[] = [
  { id: 1, short: "Du", long: "Dushanba" },
  { id: 2, short: "Se", long: "Seshanba" },
  { id: 3, short: "Ch", long: "Chorshanba" },
  { id: 4, short: "Pa", long: "Payshanba" },
  { id: 5, short: "Ju", long: "Juma" },
  { id: 6, short: "Sh", long: "Shanba" },
];

/** Xodim rollari — backend `RoleName` ning xodimlarga tegishli qismi. */
export const STAFF_ROLES: { id: string; label: string; hint: string }[] = [
  { id: "teacher", label: "Ustoz", hint: "Davomat, baho, uy vazifasi" },
  {
    id: "homeroom_teacher",
    label: "Sinf rahbari",
    hint: "Ustoz huquqlari + oʻz sinfi boʻyicha kengaytirilgan",
  },
  { id: "academic", label: "Oʻquv boʻlimi", hint: "Jadval, imtihon, sifat nazorati" },
  { id: "admin", label: "Administrator", hint: "Maʼlumotnoma, qabul, toʻlov" },
  { id: "director", label: "Rahbar", hint: "Faqat hisobot va analitika" },
];

// ─────────────────────────── Maʼlumotnomalar ───────────────────────────

export async function fetchSubjects(): Promise<SubjectOut[]> {
  return withAuth<SubjectOut[]>(() => schoolSubjects());
}

export async function fetchClasses(): Promise<ClassOut[]> {
  return withAuth<ClassOut[]>(() => schoolClasses());
}

export async function fetchStaff(): Promise<StaffOut[]> {
  return withAuth<StaffOut[]>(() => schoolStaff());
}

/**
 * Oʻquvchilar roʻyxati.
 *
 * Kesim SOʻROV darajasida serverda: ustoz oʻz sinfini, ota-ona faqat
 * oʻz farzandini oladi (X-1). Roʻyxatda tugʻilgan sana va telefon YOʻQ
 * — ular kartochkada (X-6).
 */
export async function fetchStudents(filter?: {
  classId?: string;
  query?: string;
}): Promise<StudentListRowOut[]> {
  return withAuth<StudentListRowOut[]>(() =>
    schoolStudents({ query: { class_id: filter?.classId, q: filter?.query } }),
  );
}

// ─────────────────────────── Xodimlar ───────────────────────────

export type StaffCreateInput = {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  roles: string[];
  phone?: string | null;
  email?: string | null;
  subject_ids: string[];
};

/**
 * Yangi xodim hisobi.
 *
 * Javobdagi `initial_password` BIR MARTA koʻrsatiladi — bazada faqat
 * xeshi qoladi. Uni ekranda saqlab qoʻyish yoki logga yozish mumkin
 * emas (X-10), administrator oʻsha zahoti egasiga yetkazadi.
 */
export async function createStaff(input: StaffCreateInput): Promise<StaffCreatedOut> {
  return withAuth<StaffCreatedOut>(() => schoolCreateStaff({ body: input }));
}

/** Toʻliq roʻyxat yuboriladi — qoʻshish/olib tashlash emas. */
export async function setStaffSubjects(
  userId: string,
  subjectIds: string[],
): Promise<void> {
  await withAuth<void>(() =>
    schoolSetStaffSubjects({
      path: { user_id: userId },
      body: { subject_ids: subjectIds },
    }),
  );
}

export async function resetStaffPassword(userId: string): Promise<PasswordResetOut> {
  return withAuth<PasswordResetOut>(() =>
    schoolResetStaffPassword({ path: { user_id: userId } }),
  );
}

/** Arxivlaydi — oʻchirmaydi (CLAUDE.md 1-qoida). */
export async function archiveStaff(userId: string): Promise<void> {
  await withAuth<void>(() => schoolArchiveStaff({ path: { user_id: userId } }));
}

// ─────────────────────────── Dars jadvali ───────────────────────────

export async function fetchSchedule(filter?: {
  classId?: string;
  teacherId?: string;
}): Promise<ScheduleEntryOut[]> {
  return withAuth<ScheduleEntryOut[]>(() =>
    scheduleEntries({
      query: {
        class_id: filter?.classId,
        teacher_id: filter?.teacherId,
      },
    }),
  );
}

export type ScheduleInput = {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  weekday: number;
  period: number;
  room?: string | null;
};

/** Toʻqnashuv boʻlsa `409` — xato matnida kim/nima band qilgani yozilgan. */
export async function addScheduleEntry(
  input: ScheduleInput,
): Promise<ScheduleEntryOut> {
  return withAuth<ScheduleEntryOut>(() => scheduleAddEntry({ body: input }));
}

export async function updateScheduleEntry(
  entryId: string,
  patch: { teacher_id?: string; room?: string | null },
): Promise<ScheduleEntryOut> {
  return withAuth<ScheduleEntryOut>(() =>
    scheduleUpdateEntry({ path: { entry_id: entryId }, body: patch }),
  );
}

export async function archiveScheduleEntry(entryId: string): Promise<void> {
  await withAuth<void>(() => scheduleArchiveEntry({ path: { entry_id: entryId } }));
}

export async function fetchTeacherLoad(): Promise<TeacherLoadOut[]> {
  return withAuth<TeacherLoadOut[]>(() => scheduleTeacherLoad());
}

// ─────────────────────────── Hooklar ───────────────────────────

/** Serverdan kelgan xato matni — foydalanuvchiga koʻrsatiladi. */
export function apiXato(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

export type SchoolDirectory = {
  subjects: SubjectOut[];
  classes: ClassOut[];
  staff: StaffOut[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Sinf, fan va xodim roʻyxati birga.
 *
 * Uchalasi bitta hookda, chunki xodim yaratish va jadval tuzish
 * ekranlarida uchalasi ham bir vaqtda kerak — alohida hooklar uchta
 * mustaqil yuklanish holatini boshqarishga majbur qilardi.
 */
export function useSchoolDirectory(): SchoolDirectory {
  const [subjects, setSubjects] = useState<SubjectOut[]>([]);
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [staff, setStaff] = useState<StaffOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchSubjects(), fetchClasses(), fetchStaff()])
      .then(([s, c, x]) => {
        if (!alive) return;
        setSubjects(s);
        setClasses(c);
        setStaff(x);
      })
      .catch(() => alive && setError("Maʼlumotnomani olib boʻlmadi."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [tick]);

  return { subjects, classes, staff, loading, error, reload };
}
