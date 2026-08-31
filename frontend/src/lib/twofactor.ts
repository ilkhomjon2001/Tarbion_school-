"use client";

/**
 * Ikki bosqichli tasdiqlash — backend qatlami (X-14).
 *
 * Sekret va tiklash kodlari BIR MARTA qaytadi va hech qayerda
 * saqlanmaydi: na `localStorage` da, na state'da uzoq muddat. Ular
 * ekranda koʻrsatiladi va sahifa yopilgach yoʻqoladi.
 */

import {
  authTwoFactorDisable,
  authTwoFactorEnable,
  authTwoFactorRecoveryCodes,
  authTwoFactorSetup,
  authTwoFactorStatus,
} from "@/lib/api/sdk.gen";
import type { TwoFactorSetupOut, TwoFactorStatusOut } from "@/lib/api/types.gen";
import { SessionError, withAuth } from "@/lib/session";

export type { TwoFactorSetupOut, TwoFactorStatusOut };

export async function twoFactorStatus(): Promise<TwoFactorStatusOut> {
  return withAuth<TwoFactorStatusOut>(() => authTwoFactorStatus());
}

/** Sekret yasaydi. 2FA hali YOQILMAYDI — kod tasdiqlangach yoqiladi. */
export async function setupTwoFactor(): Promise<TwoFactorSetupOut> {
  return withAuth<TwoFactorSetupOut>(() => authTwoFactorSetup());
}

/** Kodni tekshirib yoqadi. Tiklash kodlari bir marta qaytadi. */
export async function enableTwoFactor(code: string): Promise<string[]> {
  const data = await withAuth<{ codes: string[] }>(() =>
    authTwoFactorEnable({ body: { code } }),
  );
  return data.codes;
}

/** Oʻchiradi. Majburiy rolda server rad etadi (`422`). */
export async function disableTwoFactor(password: string, code: string): Promise<void> {
  await withAuth<void>(() => authTwoFactorDisable({ body: { password, code } }));
}

/** Yangi tiklash kodlari. Eskilari bekor qilinadi. */
export async function regenerateRecoveryCodes(password: string): Promise<string[]> {
  const data = await withAuth<{ codes: string[] }>(() =>
    authTwoFactorRecoveryCodes({ body: { password } }),
  );
  return data.codes;
}

export { SessionError };
