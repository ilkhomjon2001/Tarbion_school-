/**
 * Maktab xodimlari va dars yuklamasi — BARCHA rollar uchun yagona manba.
 *
 * Ilgari har kabinet (oʻquvchi/ustoz/ota-ona/rahbariyat) oʻz mock faylida
 * ustozlarni alohida saqlar edi va ular bir-biriga mos kelmasdi. Bu fayl
 * shu maʼlumotning yagona manbasi: kim qaysi sinfda qaysi fandan dars
 * beradi, kim sinf rahbari, kim psixolog.
 *
 * Backend ulanganda bu `teachers` + `teaching_assignments` jadvallariga
 * almashtiriladi.
 */

export type StaffRole = "teacher" | "director" | "admin" | "psychologist";

export interface Staff {
  id: string;
  fullName: string;
  shortName: string;
  role: StaffRole;
  /** Faqat `teacher` uchun — oʻqitadigan fanlari. */
  subjects: string[];
  initials: string;
  phone: string;
}

export const STAFF: Staff[] = [
  { id: "s-dir", fullName: "Nortojiyeva Malika Aʼzamovna", shortName: "M. Nortojiyeva", role: "director", subjects: [], initials: "MN", phone: "+998 90 100 00 01" },
  { id: "s-adm", fullName: "Qodirov Bahodir Toʻlqinovich", shortName: "B. Qodirov", role: "admin", subjects: [], initials: "BQ", phone: "+998 90 100 00 02" },
  { id: "s-psy", fullName: "Ismoilova Dilnoza Faridovna", shortName: "D. Ismoilova", role: "psychologist", subjects: [], initials: "DI", phone: "+998 90 100 00 03" },

  { id: "t-1", fullName: "Anvarov Jamshid Odilovich", shortName: "J. Anvarov", role: "teacher", subjects: ["Matematika", "Algebra", "Geometriya"], initials: "JA", phone: "+998 90 111 22 33" },
  { id: "t-2", fullName: "Karimova Nargiza Yusupovna", shortName: "N. Karimova", role: "teacher", subjects: ["Ona tili", "Adabiyot"], initials: "NK", phone: "+998 91 222 33 44" },
  { id: "t-3", fullName: "Toshmatov Botir Rahimovich", shortName: "B. Toshmatov", role: "teacher", subjects: ["Fizika"], initials: "BT", phone: "+998 93 333 44 55" },
  { id: "t-4", fullName: "Aliyeva Nigora Sobirovna", shortName: "N. Aliyeva", role: "teacher", subjects: ["Ingliz tili"], initials: "NA", phone: "+998 94 444 55 66" },
  { id: "t-5", fullName: "Rahimov Dilshod Ergashevich", shortName: "D. Rahimov", role: "teacher", subjects: ["Tarix"], initials: "DR", phone: "+998 97 555 66 77" },
  { id: "t-6", fullName: "Karimova Aziza Baxtiyorovna", shortName: "A. Karimova", role: "teacher", subjects: ["Matematika", "Informatika"], initials: "AK", phone: "+998 90 666 77 88" },
  { id: "t-7", fullName: "Sobirov Jasur Nabiyevich", shortName: "J. Sobirov", role: "teacher", subjects: ["Jismoniy tarbiya"], initials: "JS", phone: "+998 99 777 88 99" },
  { id: "t-8", fullName: "Yusupova Malika Farxodovna", shortName: "M. Yusupova", role: "teacher", subjects: ["Kimyo", "Biologiya"], initials: "MY", phone: "+998 88 888 99 00" },
  { id: "t-9", fullName: "Ergashev Sanjar Alisherovich", shortName: "S. Ergashev", role: "teacher", subjects: ["Robototexnika", "Informatika"], initials: "SE", phone: "+998 93 999 00 11" },
];

export function staffById(id: string): Staff | null {
  return STAFF.find((s) => s.id === id) ?? null;
}

export const PSYCHOLOGIST = STAFF.find((s) => s.role === "psychologist")!;
export const DIRECTOR = STAFF.find((s) => s.role === "director")!;

// ───────────────────────── Dars yuklamasi ─────────────────────────

export interface TeachingAssignment {
  className: string;
  subject: string;
  teacherId: string;
  /** Haftasiga necha soat. */
  hoursPerWeek: number;
}

/**
 * Sinf → fan → ustoz. Yagona manba: oʻquvchi "mening ustozlarim"ni,
 * rahbariyat "qaysi sinfda kim dars beradi"ni, ota-ona esa murojaat
 * yozayotganda "fan oʻqituvchisi"ni shu roʻyxatdan oladi.
 */
export const TEACHING_ASSIGNMENTS: TeachingAssignment[] = [
  // 8-A — oʻquvchi kabinetidagi sinf
  { className: "8-A", subject: "Matematika", teacherId: "t-1", hoursPerWeek: 5 },
  { className: "8-A", subject: "Ona tili", teacherId: "t-2", hoursPerWeek: 4 },
  { className: "8-A", subject: "Fizika", teacherId: "t-3", hoursPerWeek: 3 },
  { className: "8-A", subject: "Ingliz tili", teacherId: "t-4", hoursPerWeek: 3 },
  { className: "8-A", subject: "Tarix", teacherId: "t-5", hoursPerWeek: 2 },
  { className: "8-A", subject: "Kimyo", teacherId: "t-8", hoursPerWeek: 2 },
  { className: "8-A", subject: "Jismoniy tarbiya", teacherId: "t-7", hoursPerWeek: 2 },

  // 11-A — ota-ona kabinetidagi katta farzand
  { className: "11-A", subject: "Matematika", teacherId: "t-1", hoursPerWeek: 4 },
  { className: "11-A", subject: "Algebra", teacherId: "t-1", hoursPerWeek: 3 },
  { className: "11-A", subject: "Geometriya", teacherId: "t-1", hoursPerWeek: 2 },
  { className: "11-A", subject: "Fizika", teacherId: "t-3", hoursPerWeek: 3 },
  { className: "11-A", subject: "Ona tili", teacherId: "t-2", hoursPerWeek: 3 },

  // 6-B — ota-ona kabinetidagi kichik farzand
  { className: "6-B", subject: "Matematika", teacherId: "t-6", hoursPerWeek: 5 },
  { className: "6-B", subject: "Robototexnika", teacherId: "t-9", hoursPerWeek: 2 },
  { className: "6-B", subject: "Ona tili", teacherId: "t-2", hoursPerWeek: 4 },
  { className: "6-B", subject: "Ingliz tili", teacherId: "t-4", hoursPerWeek: 3 },

  // Rahbariyat kabinetidagi sinflar
  { className: "5-A", subject: "Matematika", teacherId: "t-6", hoursPerWeek: 5 },
  { className: "5-A", subject: "Ona tili", teacherId: "t-2", hoursPerWeek: 4 },
  { className: "5-A", subject: "Ingliz tili", teacherId: "t-4", hoursPerWeek: 3 },

  { className: "6-G", subject: "Matematika", teacherId: "t-6", hoursPerWeek: 5 },
  { className: "6-G", subject: "Ingliz tili", teacherId: "t-4", hoursPerWeek: 3 },
  { className: "6-G", subject: "Informatika", teacherId: "t-9", hoursPerWeek: 2 },

  { className: "9-B", subject: "Matematika", teacherId: "t-1", hoursPerWeek: 5 },
  { className: "9-B", subject: "Ona tili", teacherId: "t-2", hoursPerWeek: 3 },
  { className: "9-B", subject: "Tarix", teacherId: "t-5", hoursPerWeek: 2 },
  { className: "9-B", subject: "Ingliz tili", teacherId: "t-4", hoursPerWeek: 3 },

  { className: "10-A", subject: "Geometriya", teacherId: "t-1", hoursPerWeek: 3 },
  { className: "10-A", subject: "Algebra", teacherId: "t-1", hoursPerWeek: 3 },
  { className: "10-A", subject: "Fizika", teacherId: "t-3", hoursPerWeek: 3 },
  { className: "10-A", subject: "Ona tili", teacherId: "t-2", hoursPerWeek: 3 },

  { className: "11-B", subject: "Fizika", teacherId: "t-3", hoursPerWeek: 4 },
  { className: "11-B", subject: "Kimyo", teacherId: "t-8", hoursPerWeek: 3 },
  { className: "11-B", subject: "Matematika", teacherId: "t-1", hoursPerWeek: 4 },

  { className: "11-V", subject: "Jismoniy tarbiya", teacherId: "t-7", hoursPerWeek: 3 },
  { className: "11-V", subject: "Biologiya", teacherId: "t-8", hoursPerWeek: 3 },
  { className: "11-V", subject: "Tarix", teacherId: "t-5", hoursPerWeek: 2 },
];

/** Sinf → sinf rahbari (xodim id). */
export const HOMEROOM: Record<string, string> = {
  "5-A": "t-6",
  "6-B": "t-9",
  "6-G": "t-4",
  "8-A": "t-2",
  "9-B": "t-5",
  "10-A": "t-1",
  "11-A": "t-1",
  "11-B": "t-3",
  "11-V": "t-7",
};

export interface SubjectTeacher {
  subject: string;
  teacher: Staff;
  hoursPerWeek: number;
  /** Shu ustoz ayni shu sinfning rahbarimi. */
  isHomeroom: boolean;
}

/** Sinfdagi fanlar va ularning ustozlari (fan nomi boʻyicha tartiblangan). */
export function subjectTeachersOf(className: string): SubjectTeacher[] {
  return TEACHING_ASSIGNMENTS.filter((a) => a.className === className)
    .map((a) => {
      const teacher = staffById(a.teacherId);
      return teacher
        ? {
            subject: a.subject,
            teacher,
            hoursPerWeek: a.hoursPerWeek,
            isHomeroom: HOMEROOM[className] === teacher.id,
          }
        : null;
    })
    .filter((x): x is SubjectTeacher => x !== null)
    .sort((a, b) => a.subject.localeCompare(b.subject, "uz"));
}

export function homeroomTeacherOf(className: string): Staff | null {
  const id = HOMEROOM[className];
  return id ? staffById(id) : null;
}

/** Ustoz dars beradigan sinflar va fanlar. */
export function assignmentsOfTeacher(teacherId: string): TeachingAssignment[] {
  return TEACHING_ASSIGNMENTS.filter((a) => a.teacherId === teacherId);
}

/** Barcha sinflar roʻyxati (yuklamada uchraganlari). */
export function allClassNames(): string[] {
  return Array.from(new Set(TEACHING_ASSIGNMENTS.map((a) => a.className))).sort((a, b) =>
    a.localeCompare(b, "uz", { numeric: true }),
  );
}

/** Faqat oʻqituvchilar (direktor/admin/psixologsiz). */
export function allTeachers(): Staff[] {
  return STAFF.filter((s) => s.role === "teacher");
}
