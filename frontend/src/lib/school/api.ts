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
  schoolArchiveClass,
  schoolArchiveStaff,
  schoolArchiveStudent,
  schoolArchiveSubject,
  schoolClasses,
  schoolCreateClass,
  schoolCreateGuardian,
  schoolCreateStudent,
  schoolCreateSubject,
  schoolCreateStaff,
  schoolResetStaffPassword,
  schoolSetStaffSubjects,
  schoolMoveStudent,
  schoolRestoreStudent,
  schoolSetClassSubject,
  schoolSetHomeroom,
  schoolStaff,
  schoolLinkGuardian,
  schoolMakePrimary,
  schoolStudentCard,
  schoolStudentGuardians,
  schoolUnlinkGuardian,
  schoolStudents,
  schoolSubjectsOfClass,
  schoolSubjects,
} from "@/lib/api/sdk.gen";
import type {
  ClassOut,
  GuardianCreatedOut,
  GuardianRowOut,
  ClassSubjectOut,
  StudentCardOut,
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
  GuardianCreatedOut,
  GuardianRowOut,
  ClassSubjectOut,
  StudentCardOut,
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
  /** `true` — arxivlangan oʻquvchilar. Sukut boʻyicha faol. */
  archived?: boolean;
}): Promise<StudentListRowOut[]> {
  return withAuth<StudentListRowOut[]>(() =>
    schoolStudents({
      query: {
        class_id: filter?.classId,
        q: filter?.query,
        archived: filter?.archived ?? false,
      },
    }),
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


// ─────────────── Maʼlumotnomani boshqarish (ADM-02, ADM-03) ───────────────

/** Arxivdagi bir xil nomli fan boʻlsa — u qaytadi, yangisi yaratilmaydi. */
export async function createSubject(
  name: string,
  shortName = "",
): Promise<SubjectOut> {
  return withAuth<SubjectOut>(() =>
    schoolCreateSubject({ body: { name, short_name: shortName } }),
  );
}

/** Jadvalda ishlatilayotgan fan → `409`. */
export async function archiveSubject(subjectId: string): Promise<SubjectOut> {
  return withAuth<SubjectOut>(() =>
    schoolArchiveSubject({ path: { subject_id: subjectId } }),
  );
}

export async function createClass(
  name: string,
  homeroomTeacherId?: string | null,
): Promise<ClassOut> {
  return withAuth<ClassOut>(() =>
    schoolCreateClass({
      body: { name, homeroom_teacher_id: homeroomTeacherId ?? null },
    }),
  );
}

/** `null` — sinf rahbarini olib tashlash. */
export async function setHomeroomTeacher(
  classId: string,
  teacherId: string | null,
): Promise<ClassOut> {
  return withAuth<ClassOut>(() =>
    schoolSetHomeroom({ path: { class_id: classId }, body: { teacher_id: teacherId } }),
  );
}

/** Oʻquvchisi bor sinf → `409`. */
export async function archiveClass(classId: string): Promise<void> {
  await withAuth<void>(() => schoolArchiveClass({ path: { class_id: classId } }));
}

export async function fetchClassSubjects(classId: string): Promise<ClassSubjectOut[]> {
  return withAuth<ClassSubjectOut[]>(() =>
    schoolSubjectsOfClass({ path: { class_id: classId } }),
  );
}

/** `weeklyHours = 0` — oʻquv rejasidan chiqaradi (arxivlanadi). */
export async function setClassSubject(
  classId: string,
  subjectId: string,
  weeklyHours: number,
): Promise<void> {
  await withAuth<void>(() =>
    schoolSetClassSubject({
      path: { class_id: classId },
      body: { subject_id: subjectId, weekly_hours: weeklyHours },
    }),
  );
}

// ─────────────────────────── Oʻquvchilar ───────────────────────────

export async function fetchStudentCard(studentId: string): Promise<StudentCardOut> {
  return withAuth<StudentCardOut>(() =>
    schoolStudentCard({ path: { student_id: studentId } }),
  );
}

export type StudentCreateInput = {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  birth_date?: string | null;
  class_id?: string | null;
};

export async function createStudent(input: StudentCreateInput): Promise<StudentCardOut> {
  return withAuth<StudentCardOut>(() => schoolCreateStudent({ body: input }));
}

export async function moveStudent(
  studentId: string,
  classId: string | null,
): Promise<StudentCardOut> {
  return withAuth<StudentCardOut>(() =>
    schoolMoveStudent({ path: { student_id: studentId }, body: { class_id: classId } }),
  );
}

/** Arxivlaydi — oʻchirmaydi. Sabab majburiy (CLAUDE.md 1-qoida). */
export async function archiveStudent(
  studentId: string,
  reason: string,
): Promise<StudentCardOut> {
  return withAuth<StudentCardOut>(() =>
    schoolArchiveStudent({ path: { student_id: studentId }, body: { reason } }),
  );
}

export async function restoreStudent(studentId: string): Promise<StudentCardOut> {
  return withAuth<StudentCardOut>(() =>
    schoolRestoreStudent({ path: { student_id: studentId } }),
  );
}


// ─────────────────────────── Vasiylar (T-009) ───────────────────────────

/**
 * Vasiylar roʻyxati. Telefon SHU YERDA bor — bu bitta oʻquvchi
 * kartochkasi, roʻyxat emas (X-6).
 */
export async function fetchGuardians(
  studentId: string,
  archived = false,
): Promise<GuardianRowOut[]> {
  return withAuth<GuardianRowOut[]>(() =>
    schoolStudentGuardians({ path: { student_id: studentId }, query: { archived } }),
  );
}

export type GuardianCreateInput = {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  phone?: string | null;
  email?: string | null;
  relation: string;
  is_primary?: boolean;
};

/**
 * Yangi ota-ona hisobi ochib bogʻlaydi. Boshlangʻich parol javobda
 * BIR MARTA qaytadi.
 *
 * Telefon boshqa ota-onada boʻlsa `409` — odatda bu ikkinchi farzand,
 * `linkGuardian` bilan mavjud hisobga bogʻlash kerak.
 */
export async function createGuardian(
  studentId: string,
  input: GuardianCreateInput,
): Promise<GuardianCreatedOut> {
  return withAuth<GuardianCreatedOut>(() =>
    schoolCreateGuardian({ path: { student_id: studentId }, body: input }),
  );
}

/** Mavjud hisobni bogʻlash — ikkinchi farzand shu yoʻldan qoʻshiladi. */
export async function linkGuardian(
  studentId: string,
  userId: string,
  relation: string,
  isPrimary = false,
): Promise<GuardianRowOut> {
  return withAuth<GuardianRowOut>(() =>
    schoolLinkGuardian({
      path: { student_id: studentId },
      body: { user_id: userId, relation, is_primary: isPrimary },
    }),
  );
}

/** Asosiy vasiy — xabarnoma birinchi navbatda shunga ketadi. */
export async function makePrimaryGuardian(
  studentId: string,
  guardianId: string,
): Promise<GuardianRowOut> {
  return withAuth<GuardianRowOut>(() =>
    schoolMakePrimary({ path: { student_id: studentId, guardian_id: guardianId } }),
  );
}

/** Arxivlaydi — kirish huquqi shu zahoti yopiladi. Oʻchirish yoʻq. */
export async function unlinkGuardian(
  studentId: string,
  guardianId: string,
  reason: string,
): Promise<GuardianRowOut> {
  return withAuth<GuardianRowOut>(() =>
    schoolUnlinkGuardian({
      path: { student_id: studentId, guardian_id: guardianId },
      body: { reason },
    }),
  );
}
