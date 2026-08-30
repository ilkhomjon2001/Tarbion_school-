/**
 * Rollar va ularning kabinetlari.
 *
 * DEMO: login sahifasida rol qoʻlda tanlanadi. Backend ulanganda rol
 * JWT ichidan keladi va bu yerdagi `ROLE_HOME` faqat yoʻnaltirish uchun
 * ishlatiladi — kirish huquqi baribir SERVERDA tekshiriladi
 * (CLAUDE.md 7-qoida).
 */

export type UserRole =
  | "student"
  | "teacher"
  | "parent"
  | "director"
  | "admin"
  | "academic"
  | "superadmin";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Oʻquvchi",
  teacher: "Ustoz",
  parent: "Ota-ona",
  director: "Rahbariyat",
  admin: "Administrator",
  academic: "Oʻquv boʻlimi",
  superadmin: "Super administrator",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  student: "Jadval, uy vazifasi, baholar",
  teacher: "Davomat, jurnal, vazifa",
  parent: "Farzand natijalari, toʻlov",
  director: "Hisobot va analitika",
  admin: "Qabul, toʻlov, hujjatlar",
  academic: "Imtihonlar, dars rejasi, sifat",
  superadmin: "Foydalanuvchilar, huquqlar, sozlamalar",
};

/** Rol tanlangandan keyin ochiladigan kabinet. */
export const ROLE_HOME: Record<UserRole, string> = {
  student: "/student",
  teacher: "/teacher",
  parent: "/ota-ona",
  director: "/rahbar",
  admin: "/admin",
  academic: "/oquv-bolim",
  // Super administrator ham admin kabinetida ishlaydi — farqi huquqlarda.
  superadmin: "/admin",
};

/** Kabinetga ega rollar — super admin adminnikida ishlaydi. */
export type Cabinet = Exclude<UserRole, "superadmin">;

/** Qaysi kabinetni ochadi — AuthGuard shu boʻyicha tekshiradi. */
export const ROLE_CABINET: Record<UserRole, Cabinet> = {
  student: "student",
  teacher: "teacher",
  parent: "parent",
  director: "director",
  admin: "admin",
  academic: "academic",
  superadmin: "admin",
};

export const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

export function isRole(value: string | null): value is UserRole {
  return value !== null && value in ROLE_LABELS;
}
