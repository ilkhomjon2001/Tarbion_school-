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
import { authLogin, authLogout, authRefresh } from "@/lib/api/sdk.gen";
import type { UserOut } from "@/lib/api/types.gen";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let accessToken: string | null = null;
let currentUser: UserOut | null = null;
let configured = false;

/** Bir vaqtda bitta yangilash — parallel 401 lar bitta soʻrovni kutadi. */
let refreshing: Promise<boolean> | null = null;

function configure(): void {
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

export async function login(login: string, password: string): Promise<UserOut> {
  configure();
  const { data, error } = await authLogin({ body: { login, password } });
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
  configure();
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
  configure();
  try {
    await authLogout();
  } catch {
    // Chiqish har qanday holatda mahalliy holatni tozalaydi — server
    // javob bermasa ham foydalanuvchi chiqib ketgan boʻlishi kerak.
  }
  accessToken = null;
  currentUser = null;
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
  configure();

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
