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
 */

const TOKEN_KEY = "tarbion.auth.token";

export function login(remember: boolean): void {
  const token = `demo-${Date.now()}`;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
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
