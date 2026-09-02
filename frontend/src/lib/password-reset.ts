/**
 * Parolni tiklash klienti (T-006, AUT-02).
 *
 * Autentifikatsiyasiz chaqiriladi — shuning uchun `withAuth` emas,
 * to'g'ridan-to'g'ri SDK. Token ham, cookie ham talab qilinmaydi.
 */

import {
  authResetConfirm,
  authResetQueue,
  authResetRequest,
  authResetResolve,
} from "@/lib/api/sdk.gen";
import type { ResetQueueRowOut, ResetResolveOut } from "@/lib/api/types.gen";
import { configureClient, withAuth } from "@/lib/session";

export type { ResetQueueRowOut, ResetResolveOut };

/** Server xatosidan oʻzbekcha matn oladi. */
export function resetXato(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

/**
 * Tiklash soʻrovi. Javob HAR DOIM bir xil — raqam bazada bor-yoʻqligi
 * oshkor boʻlmasin. Interfeys ham shuni takrorlaydi: «yubordik» degan
 * xabar telefon topilmaganda ham chiqadi.
 */
export async function requestReset(input: {
  phone?: string;
  login?: string;
}): Promise<string> {
  configureClient();
  const { data, error } = await authResetRequest({
    body: { phone: input.phone ?? null, login: input.login ?? null },
  });
  if (error || !data) throw error ?? new Error("Soʻrov yuborilmadi");
  return data.message;
}

export async function confirmReset(input: {
  phone: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  configureClient();
  const { error } = await authResetConfirm({
    body: { phone: input.phone, code: input.code, new_password: input.newPassword },
  });
  if (error) throw error;
}

/** Administrator navbati. Huquq: `users.reset_password`. */
export async function fetchResetQueue(): Promise<ResetQueueRowOut[]> {
  return withAuth<ResetQueueRowOut[]>(() => authResetQueue({}));
}

/**
 * Administrator yangi parol beradi.
 *
 * Parol FAQAT shu javobda keladi va hech qayerda saqlanmaydi —
 * administrator uni darhol odamga yetkazishi kerak.
 */
export async function resolveReset(requestId: string): Promise<ResetResolveOut> {
  return withAuth<ResetResolveOut>(() =>
    authResetResolve({ path: { request_id: requestId } }),
  );
}
