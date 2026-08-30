"use client";

/**
 * Parolni almashtirish (AUT-08).
 *
 * Alohida fayl, `session.ts` da emas: sessiya moduli faqat token va uni
 * yangilash bilan shugʻullanadi. Parol — foydalanuvchi amali, sessiya
 * mexanikasi emas.
 */

import { authChangePassword } from "@/lib/api/sdk.gen";
import { restore, SessionError } from "@/lib/session";

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const call = () =>
    authChangePassword({
      body: { current_password: currentPassword, new_password: newPassword },
    });

  let result = await call();

  // Access token muddati oʻtgan boʻlsa bir marta yangilab qayta uramiz.
  if (result.response?.status === 401 && (await restore())) {
    result = await call();
  }

  if (result.error) {
    const message =
      typeof result.error === "object" &&
      result.error !== null &&
      "message" in result.error &&
      typeof (result.error as { message: unknown }).message === "string"
        ? (result.error as { message: string }).message
        : "Parolni almashtirib boʻlmadi.";
    throw new SessionError(message, result.response?.status ?? 0);
  }

  // Parol almashgandan keyin `must_change_password` bayrogʻi bazada
  // oʻchdi, lekin xotiradagi foydalanuvchi eski holatda. Sessiyani
  // yangilaymiz — aks holda AuthGuard yana `/parol` ga qaytarardi.
  await restore();
}
