/**
 * Rollar va ularning kabinetlari.
 *
 * DEMO: login sahifasida rol qoʻlda tanlanadi. Backend ulanganda rol
 * JWT ichidan keladi va bu yerdagi `ROLE_HOME` faqat yoʻnaltirish uchun
 * ishlatiladi — kirish huquqi baribir SERVERDA tekshiriladi
 * (CLAUDE.md 7-qoida).
 */

export type UserRole = "student" | "teacher" | "parent" | "director" | "admin";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Oʻquvchi",
  teacher: "Ustoz",
  parent: "Ota-ona",
  director: "Rahbariyat",
  admin: "Administrator",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  student: "Jadval, uy vazifasi, baholar",
  teacher: "Davomat, jurnal, vazifa",
  parent: "Farzand natijalari, toʻlov",
  director: "Hisobot va analitika",
  admin: "Qabul, toʻlov, hujjatlar",
};

/** Rol tanlangandan keyin ochiladigan kabinet. */
export const ROLE_HOME: Record<UserRole, string> = {
  student: "/student",
  teacher: "/teacher",
  parent: "/ota-ona",
  director: "/rahbar",
  admin: "/admin",
};

export const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

export function isRole(value: string | null): value is UserRole {
  return value !== null && value in ROLE_LABELS;
}
