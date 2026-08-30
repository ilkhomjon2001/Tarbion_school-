"use client";

/**
 * DEMO autentifikatsiya qatlami.
 *
 * Backend hali yoʻq (T-004 "Login, JWT, sessiya" bajarilmagan). Haqiqiy
 * loyihada bu yerda access/refresh JWT va serverdagi sessiya jadvali
 * ishlaydi (AUT-05, AUT-09). Hozircha faqat login sahifasidagi "ushbu
 * qurilmada eslab qolish" xatti-harakatini frontendda toʻgʻri koʻrsatish
 * uchun brauzer xotirasi ishlatiladi:
 *
 * - "Eslab qolish" YOQILGAN  → `localStorage` (brauzer yopilsa ham qoladi).
 * - "Eslab qolish" OʻCHIRILGAN → `sessionStorage` (tab/brauzer yopilsa
 *   yoki "Chiqish" bosilsa yoʻqoladi — umumiy maktab kompyuterlari uchun
 *   muhim: keyingi oʻquvchi login sahifasini koʻradi, avtomatik kirmaydi).
 *
 * Rol ham shu yerda saqlanadi — faqat kerakli kabinetga yoʻnaltirish
 * uchun. Bu himoya EMAS: rol tekshiruvi serverda boʻlishi shart
 * (CLAUDE.md 7-qoida).
 */

import { isRole, type UserRole } from "@/lib/roles";

const TOKEN_KEY = "tarbion.auth.token";
const ROLE_KEY = "tarbion.auth.role";

export function login(remember: boolean, role: UserRole): void {
  const token = `demo-${Date.now()}`;
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(ROLE_KEY, role);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY));
}

/** Joriy sessiya "eslab qolingan" holatdami (localStorage'da saqlanganmi). */
export function isRemembered(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

/** Joriy sessiyadagi rol — yoʻq boʻlsa `null`. */
export function currentRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(ROLE_KEY) ?? sessionStorage.getItem(ROLE_KEY);
  return isRole(value) ? value : null;
}
