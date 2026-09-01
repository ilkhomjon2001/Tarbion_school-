"use client";

/**
 * Sessiya qatlami — endi HAQIQIY backend bilan ishlaydi.
 *
 * Bu fayl avval demo edi: `localStorage` ga soxta token yozardi va rol
 * login sahifasida qoʻlda tanlanardi. Endi u `lib/session.ts` ustidagi
 * yupqa qatlam. Nega alohida fayl qoldi: `logout`, `currentRole` va
 * `isRemembered` toʻqqizta komponentda ishlatiladi — hammasini birdan
 * qayta yozish oʻrniga shu yerda moslashtirildi.
 *
 * Token XOTIRADA (`lib/session.ts`), `localStorage` da EMAS — bitta XSS
 * butun hisobni bermasin (docs/XAVFSIZLIK.md, X-4). Refresh token esa
 * httpOnly cookie'da: JavaScript uni koʻrmaydi.
 *
 * `localStorage` da faqat ikkita zararsiz narsa qoladi: "eslab qolish"
 * bayrogʻi va oxirgi rol — sahifa yangilanganda kabinetni darhol
 * koʻrsatish uchun. Ikkalasi ham HIMOYA EMAS, faqat qulaylik: haqiqiy
 * tekshiruv serverda (CLAUDE.md 7-qoida).
 */

import * as session from "@/lib/session";
import { isRole, type UserRole } from "@/lib/roles";

const REMEMBER_KEY = "tarbion.auth.remember";
const ROLE_HINT_KEY = "tarbion.auth.role";

/** Kirish. Rol serverdan keladi — tanlanmaydi. */
/**
 * Kirish natijasi.
 *
 * `needsTwoFactor` — parol toʻgʻri, lekin kod kerak (X-14). Bu holatda
 * token BERILMAGAN va sahifa ikkinchi bosqichni koʻrsatishi kerak.
 */
export type SignInResult =
  | { needsTwoFactor: false; role: UserRole; mustChangePassword: boolean }
  | { needsTwoFactor: true; challenge: string; recoveryAvailable: boolean };

function rememberRole(role: UserRole, remember: boolean): void {
  try {
    if (remember) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.setItem(ROLE_HINT_KEY, role);
    if (remember) localStorage.setItem(ROLE_HINT_KEY, role);
  } catch {
    /* xotira bloklangan — kirish baribir ishlaydi */
  }
}

export async function signIn(
  login: string,
  password: string,
  remember: boolean,
): Promise<SignInResult> {
  const natija = await session.login(login, password);

  if (natija.kind === "2fa") {
    return {
      needsTwoFactor: true,
      challenge: natija.challenge,
      recoveryAvailable: natija.recoveryAvailable,
    };
  }

  const role = primaryRole(natija.user.roles);
  rememberRole(role, remember);
  return {
    needsTwoFactor: false,
    role,
    mustChangePassword: natija.user.must_change_password,
  };
}

/** Kirishning ikkinchi bosqichi. */
export async function completeTwoFactor(
  challenge: string,
  code: string,
  remember: boolean,
): Promise<{ role: UserRole; mustChangePassword: boolean }> {
  const user = await session.verifyTwoFactor(challenge, code);
  const role = primaryRole(user.roles);
  rememberRole(role, remember);
  return { role, mustChangePassword: user.must_change_password };
}

/**
 * Chiqish: sessiyani bekor qiladi va kirish sahifasiga oʻtkazadi.
 *
 * Yoʻnaltirish SHU YERDA, chaqiruvchida emas. Sabab: har bir qobiqda
 * `logout(); router.push("/login")` yozilgan edi va ikkita nuqson bor
 * edi — biri `logout()` ni KUTMASDAN oʻtardi (server refresh
 * cookie'ni bekor qilishga ulgurmasligi mumkin), ikkinchisida esa
 * yoʻnaltirish umuman yoʻq edi.
 *
 * `window.location.replace` ataylab, `router.push` emas:
 *
 *   · toʻliq qayta yuklash xotiradagi BARCHA holatni tashlaydi —
 *     komponentlarda qolgan foydalanuvchi maʼlumoti, keshlangan
 *     javoblar. `router.push` da ilova tirik qoladi va oldingi
 *     ekrandagi maʼlumot xotirada turaverardi.
 *   · `replace` — «orqaga» tugmasi kabinetga qaytarmaydi.
 */
export async function logout(): Promise<void> {
  // Serverga yetib borishini kutamiz: `session.logout()` avval
  // mahalliy tokenni tozalaydi, keyin cookie'ni bekor qiladi va
  // xatoni oʻzi yutadi. Kutmasak sahifa yopilib, cookie qolib
  // ketishi mumkin.
  await session.logout();

  try {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(ROLE_HINT_KEY);
    sessionStorage.removeItem(ROLE_HINT_KEY);
  } catch {
    /* xotira bloklangan */
  }

  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}

export function isAuthenticated(): boolean {
  return session.isAuthenticated();
}

/** Sahifa yangilangandan keyin sessiyani tiklaydi (refresh cookie orqali). */
export async function restore(): Promise<boolean> {
  return session.restore();
}

/** Joriy sessiya "eslab qolingan" holatdami. */
export function isRemembered(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Joriy rol. Avval jonli sessiyadan, boʻlmasa oxirgi maʼlum roldan.
 *
 * Saqlangan qiymat faqat kabinetni darhol koʻrsatish uchun — u bilan
 * hech qanday maʼlumot ochilmaydi, har soʻrovni server tekshiradi.
 */
export function currentRole(): UserRole | null {
  const user = session.getUser();
  if (user) return primaryRole(user.roles);

  if (typeof window === "undefined") return null;
  try {
    const saqlangan =
      sessionStorage.getItem(ROLE_HINT_KEY) ?? localStorage.getItem(ROLE_HINT_KEY);
    return isRole(saqlangan) ? saqlangan : null;
  } catch {
    return null;
  }
}

export function mustChangePassword(): boolean {
  return session.getUser()?.must_change_password ?? false;
}

/**
 * Bir nechta roldan qaysi kabinet ochilishini tanlaydi.
 *
 * Tartib ataylab: sinf rahbari ham ustoz, super administrator ham
 * administrator kabinetida ishlaydi. Eng keng huquqli rol birinchi
 * tekshiriladi, shunda superadmin oʻquvchi kabinetiga tushib qolmaydi.
 */
const ROLE_PRIORITY: UserRole[] = [
  "superadmin",
  "admin",
  "director",
  "academic",
  "teacher",
  "parent",
  "student",
];

export function primaryRole(roles: readonly string[]): UserRole {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  // `homeroom_teacher` — ustozning ustiga qoʻshiladigan rol, oʻz
  // kabineti yoʻq. Boshqa rol topilmasa ustoz kabineti ochiladi.
  if (roles.includes("homeroom_teacher")) return "teacher";
  return "student";
}
