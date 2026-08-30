/**
 * Boʻlimlar reyestri va kirish huquqlari.
 *
 * Tizimdagi HAR BIR boʻlim shu yerda roʻyxatga olinadi. Super administrator
 * foydalanuvchiga qaysi boʻlim koʻrinishini shu roʻyxatdan belgilaydi.
 *
 * Model ikki qavatli:
 *   1) rol boʻyicha standart (`ROLE_DEFAULT_SECTIONS`) — yangi foydalanuvchi
 *      shuni oladi;
 *   2) foydalanuvchi darajasidagi istisno (`UserAccount.sections`) — super
 *      admin bitta odam uchun boʻlimni yoqadi yoki oʻchiradi.
 *
 * MUHIM: bu koʻrinishni boshqarish, HIMOYA EMAS (CLAUDE.md 7-qoida).
 * Backend ulanganda har bir endpoint huquqni serverda tekshiradi —
 * frontendda boʻlimni yashirish faqat qulaylik.
 */

import { ROLE_CABINET, type Cabinet, type UserRole } from "@/lib/roles";

export type { Cabinet };

export const CABINET_LABELS: Record<Cabinet, string> = {
  student: "Oʻquvchi kabineti",
  teacher: "Ustoz kabineti",
  parent: "Ota-ona kabineti",
  director: "Rahbariyat kabineti",
  admin: "Administrator kabineti",
  academic: "Oʻquv boʻlimi kabineti",
};

export interface Section {
  /** Manzilning oʻzi — barqaror va takrorlanmas. */
  id: string;
  label: string;
  cabinet: Cabinet;
  /** Kabinet boshi yoki huquq boshqaruvining oʻzi — oʻchirib boʻlmaydi. */
  locked?: boolean;
  /** Faqat super administrator koʻradi. */
  superadminOnly?: boolean;
}

export const SECTIONS: Section[] = [
  // ── Oʻquvchi ──
  { id: "/student", label: "Bosh sahifa", cabinet: "student", locked: true },
  { id: "/student/schedule", label: "Jadval", cabinet: "student" },
  { id: "/student/homework", label: "Uy vazifasi", cabinet: "student" },
  { id: "/student/tests", label: "Testlar", cabinet: "student" },
  { id: "/student/grades", label: "Baholar", cabinet: "student" },
  { id: "/student/ustozlar", label: "Ustozlar", cabinet: "student" },
  { id: "/student/reyting", label: "Reyting", cabinet: "student" },
  { id: "/student/announcements", label: "Eʼlonlar", cabinet: "student" },

  // ── Ustoz ──
  { id: "/teacher", label: "Bugungi darslar", cabinet: "teacher", locked: true },
  { id: "/teacher/jadval", label: "Dars jadvali", cabinet: "teacher" },
  { id: "/teacher/vazifa", label: "Uy vazifasi", cabinet: "teacher" },
  { id: "/teacher/jurnal", label: "Sinf jurnali", cabinet: "teacher" },
  { id: "/teacher/test", label: "Testlar", cabinet: "teacher" },
  { id: "/teacher/elon", label: "Eʼlonlar", cabinet: "teacher" },
  { id: "/teacher/murojaat", label: "Murojaatlar", cabinet: "teacher" },
  { id: "/teacher/tarbiya", label: "Tarbiyaviy izoh", cabinet: "teacher" },

  // ── Ota-ona ──
  { id: "/ota-ona", label: "Bosh sahifa", cabinet: "parent", locked: true },
  { id: "/ota-ona/davomat", label: "Davomat", cabinet: "parent" },
  { id: "/ota-ona/baholar", label: "Baholar", cabinet: "parent" },
  { id: "/ota-ona/tolov", label: "Toʻlov", cabinet: "parent" },
  { id: "/ota-ona/murojaat", label: "Murojaat", cabinet: "parent" },
  { id: "/ota-ona/tarbiya", label: "Tarbiya va psixologiya", cabinet: "parent" },
  { id: "/ota-ona/oshxona", label: "Oshxona menyusi", cabinet: "parent" },
  { id: "/ota-ona/elonlar", label: "Eʼlonlar", cabinet: "parent" },

  // ── Rahbariyat ──
  { id: "/rahbar", label: "Bosh sahifa", cabinet: "director", locked: true },
  { id: "/rahbar/jadval", label: "Dars jadvali", cabinet: "director" },
  { id: "/rahbar/sinflar", label: "Sinflar", cabinet: "director" },
  { id: "/rahbar/murojaatlar", label: "Murojaatlar", cabinet: "director" },
  { id: "/rahbar/ustozlar", label: "Ustozlar", cabinet: "director" },
  { id: "/rahbar/tolovlar", label: "Toʻlovlar", cabinet: "director" },
  { id: "/rahbar/hisobotlar", label: "Hisobotlar", cabinet: "director" },

  // ── Oʻquv boʻlimi ──
  { id: "/oquv-bolim", label: "Bosh sahifa", cabinet: "academic", locked: true },
  { id: "/oquv-bolim/imtihonlar", label: "Imtihonlar", cabinet: "academic" },
  { id: "/oquv-bolim/natijalar", label: "Natijalar", cabinet: "academic" },
  { id: "/oquv-bolim/rejalar", label: "Dars rejalari", cabinet: "academic" },
  { id: "/oquv-bolim/ustozlar", label: "Ustozlar faoliyati", cabinet: "academic" },

  // ── Administrator ──
  { id: "/admin", label: "Bosh sahifa", cabinet: "admin", locked: true },
  { id: "/admin/oquvchilar", label: "Oʻquvchilar", cabinet: "admin" },
  { id: "/admin/lidlar", label: "Lidlar", cabinet: "admin" },
  { id: "/admin/qabul", label: "Qabul", cabinet: "admin" },
  { id: "/admin/shartnomalar", label: "Shartnomalar", cabinet: "admin" },
  { id: "/admin/qongiroqlar", label: "Qoʻngʻiroqlar", cabinet: "admin" },
  { id: "/admin/tolovlar", label: "Toʻlovlar", cabinet: "admin" },
  { id: "/admin/malumotnomalar", label: "Maʼlumotnomalar", cabinet: "admin" },
  { id: "/admin/murojaatlar", label: "Murojaatlar", cabinet: "admin" },
  { id: "/admin/sorovnomalar", label: "Soʻrovnomalar", cabinet: "admin" },
  { id: "/admin/baza", label: "Maʼlumot bazasi", cabinet: "admin" },
  { id: "/admin/audit", label: "Audit jurnali", cabinet: "admin" },
  {
    id: "/admin/sozlamalar",
    label: "Sozlamalar",
    cabinet: "admin",
    locked: true,
    superadminOnly: true,
  },
];

export function sectionsOfCabinet(cabinet: Cabinet): Section[] {
  return SECTIONS.filter((s) => s.cabinet === cabinet);
}

export function sectionById(id: string): Section | null {
  return SECTIONS.find((s) => s.id === id) ?? null;
}

/**
 * Rol boʻyicha standart boʻlimlar — oʻz kabinetidagi hamma narsa,
 * super adminnikidan tashqari. Super administrator hammasini koʻradi.
 */
export const ROLE_DEFAULT_SECTIONS: Record<UserRole, string[]> = {
  student: sectionsOfCabinet("student").map((s) => s.id),
  teacher: sectionsOfCabinet("teacher").map((s) => s.id),
  parent: sectionsOfCabinet("parent").map((s) => s.id),
  director: sectionsOfCabinet("director").map((s) => s.id),
  academic: sectionsOfCabinet("academic").map((s) => s.id),
  admin: sectionsOfCabinet("admin")
    .filter((s) => !s.superadminOnly)
    .map((s) => s.id),
  superadmin: SECTIONS.map((s) => s.id),
};

/**
 * Foydalanuvchi haqiqatda koʻradigan boʻlimlar.
 *
 * `overrides === null` boʻlsa rol standarti ishlaydi. Qulflangan boʻlimlar
 * (kabinet boshi) har doim qoʻshiladi — aks holda odam oʻz kabinetiga kira
 * olmay qoladi.
 */
export function effectiveSections(
  role: UserRole,
  overrides: string[] | null,
  roleDefaults: Record<UserRole, string[]> = ROLE_DEFAULT_SECTIONS,
): string[] {
  const base = overrides ?? roleDefaults[role] ?? ROLE_DEFAULT_SECTIONS[role];
  const cabinet = ROLE_CABINET[role];
  const locked = sectionsOfCabinet(cabinet)
    .filter((s) => s.locked && (!s.superadminOnly || role === "superadmin"))
    .map((s) => s.id);
  const allowed = new Set([...base, ...locked]);
  // Super adminga atalgan boʻlim boshqa rolga oʻtib ketmasin.
  if (role !== "superadmin") {
    for (const s of SECTIONS) if (s.superadminOnly) allowed.delete(s.id);
  }
  return SECTIONS.filter((s) => allowed.has(s.id)).map((s) => s.id);
}

export function canSee(
  role: UserRole,
  overrides: string[] | null,
  sectionId: string,
  roleDefaults?: Record<UserRole, string[]>,
): boolean {
  return effectiveSections(role, overrides, roleDefaults).includes(sectionId);
}
