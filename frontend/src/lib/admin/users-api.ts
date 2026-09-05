"use client";

/**
 * Foydalanuvchi hisoblari — parol almashtirish va arxivlash amallari.
 *
 * Bu endpointlar backend'da parallel yozilmoqda va hali OpenAPI SDK'da
 * yoʻq, shu sabab toʻgʻridan `fetch` bilan (namuna: lib/curriculum/manage.ts).
 * SDK qayta generatsiya qilingach bu qatlam sdk chaqiruvlariga oʻtkaziladi.
 *
 * MUHIM: yangi parol javobdan BIR MARTA koʻrsatiladi va hech qayerga
 * (log, toast, console) yozilmaydi — X-10 qoidasi.
 */

import type { UserAccessOut } from "@/lib/api/types.gen";
import { getToken, restore, SessionError } from "@/lib/session";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Parol almashtirish natijasi — parol faqat shu javobda mavjud. */
export type PasswordResetOut = {
  login: string;
  new_password: string;
};

/**
 * POST soʻrov; 401 kelsa sessiyani bir marta yangilab qayta uradi
 * (lib/session.ts dagi `withAuth` bilan bir xil tartib).
 */
async function post<T>(path: string, body?: unknown): Promise<T> {
  const call = () =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken() ?? ""}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let r = await call();
  if (r.status === 401 && (await restore())) {
    r = await call();
  }

  if (!r.ok) {
    // Backend xatosi {code, message} koʻrinishida (core/exceptions.py).
    let message = "Amalni bajarib boʻlmadi.";
    try {
      const err = (await r.json()) as { message?: unknown };
      if (typeof err.message === "string") message = err.message;
    } catch {
      // JSON boʻlmasa umumiy xabar qoladi.
    }
    throw new SessionError(message, r.status);
  }
  return (await r.json()) as T;
}

/**
 * Foydalanuvchi parolini almashtiradi.
 *
 * `newPassword: null` — tizim oʻzi kuchli parol yaratadi (standart yoʻl).
 * Qoʻlda kiritilganda kamida 8 belgi — server ham tekshiradi.
 */
export function resetPassword(
  userId: string,
  newPassword: string | null,
): Promise<PasswordResetOut> {
  return post<PasswordResetOut>(`/api/v1/access/users/${userId}/password`, {
    new_password: newPassword,
  });
}

/** Hisobni arxivlaydi — foydalanuvchi tizimga kira olmaydi (1-domen qoidasi: oʻchirish yoʻq). */
export function archiveUser(userId: string): Promise<UserAccessOut> {
  return post<UserAccessOut>(`/api/v1/access/users/${userId}/archive`);
}

/** Hisobni arxivdan qaytaradi — kirish tiklanadi. */
export function unarchiveUser(userId: string): Promise<UserAccessOut> {
  return post<UserAccessOut>(`/api/v1/access/users/${userId}/unarchive`);
}
