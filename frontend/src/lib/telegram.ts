/**
 * Telegram bogʻlash klienti (T-017, BOT-01).
 *
 * Kod FAQAT `issueTelegramCode()` javobida keladi va hech qayerda
 * saqlanmaydi — sahifa yangilansa yoʻqoladi va yangisi olinadi (X-10).
 */

import { authTelegramCode, authTelegramStatus, authTelegramUnlink } from "@/lib/api/sdk.gen";
import type { TelegramCodeOut, TelegramStatusOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { TelegramCodeOut, TelegramStatusOut };

export async function fetchTelegramStatus(): Promise<TelegramStatusOut> {
  return withAuth<TelegramStatusOut>(() => authTelegramStatus({}));
}

export async function issueTelegramCode(): Promise<TelegramCodeOut> {
  return withAuth<TelegramCodeOut>(() => authTelegramCode({}));
}

export async function unlinkTelegram(): Promise<void> {
  await withAuth<void>(() => authTelegramUnlink({}));
}
