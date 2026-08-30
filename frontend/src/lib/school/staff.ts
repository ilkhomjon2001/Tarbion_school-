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

export type StaffStatus = "active" | "archived";

export interface Staff {
  id: string;
  fullName: string;
  shortName: string;
  role: StaffRole;
  /** Faqat `teacher` uchun — oʻqitadigan fanlari. */
  subjects: string[];
  initials: string;
  phone: string;
  email: string;
  status: StaffStatus;
}

export const STAFF: Staff[] = [
  { id: "s-dir", fullName: "Nortojiyeva Malika Aʼzamovna", shortName: "M. Nortojiyeva", role: "director", subjects: [], initials: "MN", phone: "+998 90 100 00 01", email: "malika.n@tarbion.uz", status: "active" },
  { id: "s-adm", fullName: "Qodirov Bahodir Toʻlqinovich", shortName: "B. Qodirov", role: "admin", subjects: [], initials: "BQ", phone: "+998 90 100 00 02", email: "bahodir.q@tarbion.uz", status: "active" },
  { id: "s-psy", fullName: "Ismoilova Dilnoza Faridovna", shortName: "D. Ismoilova", role: "psychologist", subjects: [], initials: "DI", phone: "+998 90 100 00 03", email: "dilnoza.i@tarbion.uz", status: "active" },

  { id: "t-1", fullName: "Anvarov Jamshid Odilovich", shortName: "J. Anvarov", role: "teacher", subjects: ["Matematika", "Algebra", "Geometriya"], initials: "JA", phone: "+998 90 111 22 33", email: "jamshid@tarbion.uz", status: "active" },
  { id: "t-2", fullName: "Karimova Nargiza Yusupovna", shortName: "N. Karimova", role: "teacher", subjects: ["Ona tili", "Adabiyot"], initials: "NK", phone: "+998 91 222 33 44", email: "nargiza@tarbion.uz", status: "active" },
  { id: "t-3", fullName: "Toshmatov Botir Rahimovich", shortName: "B. Toshmatov", role: "teacher", subjects: ["Fizika"], initials: "BT", phone: "+998 93 333 44 55", email: "botir@tarbion.uz", status: "active" },
  { id: "t-4", fullName: "Aliyeva Nigora Sobirovna", shortName: "N. Aliyeva", role: "teacher", subjects: ["Ingliz tili"], initials: "NA", phone: "+998 94 444 55 66", email: "nigora@tarbion.uz", status: "active" },
  { id: "t-5", fullName: "Rahimov Dilshod Ergashevich", shortName: "D. Rahimov", role: "teacher", subjects: ["Tarix"], initials: "DR", phone: "+998 97 555 66 77", email: "dilshod@tarbion.uz", status: "active" },
  { id: "t-6", fullName: "Karimova Aziza Baxtiyorovna", shortName: "A. Karimova", role: "teacher", subjects: ["Matematika", "Informatika"], initials: "AK", phone: "+998 90 666 77 88", email: "aziza@tarbion.uz", status: "active" },
  { id: "t-7", fullName: "Sobirov Jasur Nabiyevich", shortName: "J. Sobirov", role: "teacher", subjects: ["Jismoniy tarbiya"], initials: "JS", phone: "+998 99 777 88 99", email: "jasur@tarbion.uz", status: "active" },
  { id: "t-8", fullName: "Yusupova Malika Farxodovna", shortName: "M. Yusupova", role: "teacher", subjects: ["Kimyo", "Biologiya"], initials: "MY", phone: "+998 88 888 99 00", email: "malika.y@tarbion.uz", status: "active" },
  { id: "t-9", fullName: "Ergashev Sanjar Alisherovich", shortName: "S. Ergashev", role: "teacher", subjects: ["Robototexnika", "Informatika"], initials: "SE", phone: "+998 93 999 00 11", email: "sanjar@tarbion.uz", status: "active" },
  { id: "t-10", fullName: "Nazarova Feruza Ilhomovna", shortName: "F. Nazarova", role: "teacher", subjects: ["Ona tili", "Adabiyot"], initials: "FN", phone: "+998 90 121 22 33", email: "feruza@tarbion.uz", status: "active" },
  { id: "t-11", fullName: "Xolmatov Ulugʻbek Zafarovich", shortName: "U. Xolmatov", role: "teacher", subjects: ["Matematika", "Algebra"], initials: "UX", phone: "+998 91 232 33 44", email: "ulugbek@tarbion.uz", status: "active" },
  { id: "t-12", fullName: "Saidova Gulnora Baxodirovna", shortName: "G. Saidova", role: "teacher", subjects: ["Ingliz tili"], initials: "GS", phone: "+998 93 343 44 55", email: "gulnora@tarbion.uz", status: "active" },
  { id: "t-13", fullName: "Umarov Sherzod Qodirovich", shortName: "S. Umarov", role: "teacher", subjects: ["Tarix", "Geografiya"], initials: "SU", phone: "+998 94 454 55 66", email: "sherzod@tarbion.uz", status: "active" },
  { id: "t-14", fullName: "Islomova Kamola Rustamovna", shortName: "K. Islomova", role: "teacher", subjects: ["Biologiya", "Kimyo"], initials: "KI", phone: "+998 97 565 66 77", email: "kamola@tarbion.uz", status: "active" },
  { id: "t-15", fullName: "Rashidov Javlon Anvarovich", shortName: "J. Rashidov", role: "teacher", subjects: ["Fizika", "Astronomiya"], initials: "JR", phone: "+998 99 676 77 88", email: "javlon@tarbion.uz", status: "active" },
  { id: "t-16", fullName: "Toshpoʻlatova Zilola Akmalovna", shortName: "Z. Toshpoʻlatova", role: "teacher", subjects: ["Boshlangʻich taʼlim"], initials: "ZT", phone: "+998 88 787 88 99", email: "zilola@tarbion.uz", status: "active" },
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

  // Qolgan parallel sinflar
  { className: "5-B", subject: "Matematika", teacherId: "t-11", hoursPerWeek: 5 },
  { className: "5-B", subject: "Ona tili", teacherId: "t-10", hoursPerWeek: 4 },
  { className: "5-B", subject: "Ingliz tili", teacherId: "t-12", hoursPerWeek: 3 },

  { className: "6-A", subject: "Matematika", teacherId: "t-11", hoursPerWeek: 5 },
  { className: "6-A", subject: "Ona tili", teacherId: "t-10", hoursPerWeek: 4 },
  { className: "6-A", subject: "Tarix", teacherId: "t-13", hoursPerWeek: 2 },

  { className: "7-A", subject: "Matematika", teacherId: "t-6", hoursPerWeek: 5 },
  { className: "7-A", subject: "Robototexnika", teacherId: "t-9", hoursPerWeek: 2 },
  { className: "7-A", subject: "Biologiya", teacherId: "t-14", hoursPerWeek: 2 },

  { className: "7-B", subject: "Matematika", teacherId: "t-11", hoursPerWeek: 5 },
  { className: "7-B", subject: "Ingliz tili", teacherId: "t-12", hoursPerWeek: 3 },
  { className: "7-B", subject: "Geografiya", teacherId: "t-13", hoursPerWeek: 2 },

  { className: "8-B", subject: "Matematika", teacherId: "t-11", hoursPerWeek: 5 },
  { className: "8-B", subject: "Fizika", teacherId: "t-15", hoursPerWeek: 3 },
  { className: "8-B", subject: "Ona tili", teacherId: "t-10", hoursPerWeek: 3 },
  { className: "8-B", subject: "Kimyo", teacherId: "t-14", hoursPerWeek: 2 },

  { className: "9-A", subject: "Algebra", teacherId: "t-11", hoursPerWeek: 4 },
  { className: "9-A", subject: "Fizika", teacherId: "t-15", hoursPerWeek: 3 },
  { className: "9-A", subject: "Ingliz tili", teacherId: "t-12", hoursPerWeek: 3 },
  { className: "9-A", subject: "Tarix", teacherId: "t-13", hoursPerWeek: 2 },

  { className: "10-B", subject: "Algebra", teacherId: "t-11", hoursPerWeek: 3 },
  { className: "10-B", subject: "Astronomiya", teacherId: "t-15", hoursPerWeek: 2 },
  { className: "10-B", subject: "Biologiya", teacherId: "t-14", hoursPerWeek: 3 },
  { className: "10-B", subject: "Ona tili", teacherId: "t-10", hoursPerWeek: 3 },
];

/** Sinf → sinf rahbari (xodim id). Bir ustoz faqat bitta sinfga rahbar. */
export const HOMEROOM: Record<string, string> = {
  "5-A": "t-6",
  "5-B": "t-16",
  "6-A": "t-10",
  "6-B": "t-9",
  "6-G": "t-4",
  "7-A": "t-14",
  "7-B": "t-12",
  "8-A": "t-2",
  "8-B": "t-15",
  "9-A": "t-11",
  "9-B": "t-5",
  "10-A": "t-1",
  "10-B": "t-13",
  "11-A": "t-8",
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

/** Haftalik yuklama — haqiqiy biriktirilgan darslardan hisoblanadi. */
export function weeklyLoadOf(teacherId: string): number {
  return assignmentsOfTeacher(teacherId).reduce((sum, a) => sum + a.hoursPerWeek, 0);
}

/** Ustoz rahbarlik qiladigan sinf (yoki yoʻq). */
export function homeroomClassOf(teacherId: string): string | null {
  return Object.entries(HOMEROOM).find(([, id]) => id === teacherId)?.[0] ?? null;
}
