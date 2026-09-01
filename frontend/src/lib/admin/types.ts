/**
 * Administrator kabinetidagi umumiy tiplar.
 *
 * Eski mock doʻkon (`store.tsx` / `seed.ts`) tiplari olib tashlangan —
 * ekranlar endi generatsiya qilingan API tiplarida ishlaydi. Bu yerda
 * faqat hujjat shablonlariga kerak boʻlgan mahalliy tip qoldi.
 */

/** Maʼlumotnoma turi — `lib/admin/documents.ts` shablonlari kaliti. */
export type DocumentType =
  | "oquv_joyi"
  | "daromad"
  | "harbiy"
  | "baho_kochirmasi"
  | "tibbiy";
