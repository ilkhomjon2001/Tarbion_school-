"use client";

/**
 * Backend sessiyasi: access token va uni yangilash.
 *
 * Token XOTIRADA saqlanadi, `localStorage` da emas (DECISIONS.md).
 * Sahifadagi har qanday JavaScript `localStorage` ni oʻqiy oladi —
 * bitta XSS butun hisobni berardi. Xotiradagi qiymat sahifa
 * yangilanganda yoʻqoladi, lekin bu muammo emas: refresh token
 * httpOnly cookie'da qoladi va `restore()` yangi access token oladi.
 *
 * Tiplar `lib/api/` da — ular backend OpenAPI sxemasidan generatsiya
 * qilinadi (`pnpm gen:api`), qoʻlda yozilmaydi.
 */

import { client } from "@/lib/api/client.gen";
import {
  authLogin,
  authLogout,
  authRefresh,
  authTwoFactorVerify,
} from "@/lib/api/sdk.gen";
import type { UserOut } from "@/lib/api/types.gen";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let accessToken: string | null = null;
let currentUser: UserOut | null = null;
let configured = false;

/** Bir vaqtda bitta yangilash — parallel 401 lar bitta soʻrovni kutadi. */
let refreshing: Promise<boolean> | null = null;

/**
 * Klientni bir marta sozlaydi. Ochiq: parolni tiklash sahifasi
 * autentifikatsiyasiz chaqiradi, lekin `baseUrl` va cookie sozlamasi
 * unga ham kerak.
 */
export function configureClient(): void {
  if (configured) return;
  configured = true;

  client.setConfig({
    baseUrl: BASE_URL,
    // Refresh token cookie'si soʻrov bilan birga ketishi uchun.
    credentials: "include",
  });

  client.interceptors.request.use((request) => {
    if (accessToken) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return request;
  });
}

export function getToken(): string | null {
  return accessToken;
}

export function getUser(): UserOut | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

/**
 * Kirish natijasi.
 *
 * 2FA yoqilgan boʻlsa TOKEN BERILMAYDI — faqat `challenge` qaytadi va
 * ikkinchi bosqich (`verifyTwoFactor`) kerak boʻladi. Parolni bilgan,
 * kodi yoʻq odam hech qanday token olmaydi (X-14).
 */
export type LoginResult =
  | { kind: "ok"; user: UserOut }
  | { kind: "2fa"; challenge: string; recoveryAvailable: boolean };

export async function login(login: string, password: string): Promise<LoginResult> {
  configureClient();
  const { data, error } = await authLogin({ body: { login, password } });
  if (error || !data) {
    throw new SessionError(messageOf(error), statusOf(error));
  }

  // Diskriminator maydonini tekshirib turni ajratamiz. `in` bilan
  // toraytirish yetmaydi: OpenAPI'dan kelgan ikkala tip ham
  // ixtiyoriy maydonlarga ega emas va TS ularni birlashtira olmaydi.
  if ((data as { two_factor_required?: boolean }).two_factor_required) {
    const challenge = data as unknown as {
      challenge_token: string;
      recovery_available: boolean;
    };
    return {
      kind: "2fa",
      challenge: challenge.challenge_token,
      recoveryAvailable: challenge.recovery_available,
    };
  }

  const token = data as unknown as { access_token: string; user: UserOut };
  accessToken = token.access_token;
  currentUser = token.user;
  return { kind: "ok", user: token.user };
}

/** Kirishning ikkinchi bosqichi: TOTP kodi yoki tiklash kodi. */
export async function verifyTwoFactor(
  challenge: string,
  code: string,
): Promise<UserOut> {
  configureClient();
  const { data, error } = await authTwoFactorVerify({
    body: { challenge_token: challenge, code },
  });
  if (error || !data) {
    throw new SessionError(messageOf(error), statusOf(error));
  }
  accessToken = data.access_token;
  currentUser = data.user;
  return data.user;
}

/**
 * Sahifa yangilangandan keyin sessiyani tiklaydi.
 *
 * Cookie boʻlmasa yoki muddati oʻtgan boʻlsa — `false`. Bu XATO emas:
 * oddiy «kirilmagan» holat, chaqiruvchi login sahifasiga yoʻnaltiradi.
 */
export async function restore(): Promise<boolean> {
  configureClient();
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const { data } = await authRefresh();
      if (!data) return false;
      accessToken = data.access_token;
      currentUser = data.user;
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function logout(): Promise<void> {
  configureClient();

  // Mahalliy holat AVVAL tozalanadi. Chaqiruv joylari `logout()` ni
  // kutmasdan `/login` ga oʻtadi — server javobini kutib tursak, oʻsha
  // qisqa vaqtda token hali amal qilib turardi.
  accessToken = null;
  currentUser = null;

  try {
    // Server refresh cookie'ni bekor qiladi. Bu MUHIM: aks holda cookie
    // qolib, keyingi `restore()` chiqib ketgan odamni qaytarib kiritardi.
    await authLogout();
  } catch {
    // Server javob bermasa ham foydalanuvchi chiqib ketgan boʻlishi kerak.
  }
}

/**
 * Soʻrovni bajaradi; 401 kelsa bir marta yangilab qayta uradi.
 *
 * Nega interceptor emas: generatsiya qilingan klientning javob
 * interceptori soʻrovni QAYTA yubora olmaydi. Shu sabab qayta urinish
 * shu yerda, chaqiruv joyida.
 */
export async function withAuth<T>(
  call: () => Promise<{ data?: T; error?: unknown; response?: Response }>,
): Promise<T> {
  configureClient();

  let result = await call();
  if (result.response?.status === 401 && (await restore())) {
    result = await call();
  }

  if (result.error || result.data === undefined) {
    throw new SessionError(messageOf(result.error), result.response?.status ?? 0);
  }
  return result.data;
}

export class SessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SessionError";
    this.status = status;
  }
}

/** Backend xatosi `{code, message}` koʻrinishida keladi (core/exceptions.py). */
function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Serverga ulanib boʻlmadi";
}

function statusOf(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return 0;
}
