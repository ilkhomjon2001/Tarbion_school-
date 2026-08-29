/**
 * Tarbiyaviy va psixologik holat.
 *
 * DIQQAT — TZ'da bu boʻlim YOʻQ (docs/DECISIONS.md ga qara). Loyiha
 * egasining soʻroviga koʻra qoʻshildi.
 *
 * Kim nima yozadi:
 *   TARBIYAVIY   — sinf rahbari va fan oʻqituvchilari yozadi.
 *   PSIXOLOGIK   — faqat maktab psixologi yozadi.
 *
 * Bu maʼlumot oʻta nozik: faqat vasiy, sinf rahbari, psixolog va
 * rahbariyat koʻrishi kerak. Backendda tekshiruv soʻrov darajasida
 * boʻlishi SHART (CLAUDE.md 6-qoida) — frontendda yashirish yetarli emas.
 * Boshqa oʻquvchining ota-onasi yoki begona ustoz koʻra olmasligi uchun
 * har bir endpointga alohida test yozilsin.
 */

import { staffById, type Staff } from "@/lib/school/staff";

export type WellbeingKind = "behavior" | "psychology";

/** Umumiy kayfiyat/baho — rangli belgilash uchun. */
export type WellbeingTone = "positive" | "neutral" | "attention";

export const TONE_LABELS: Record<WellbeingTone, string> = {
  positive: "Ijobiy",
  neutral: "Odatiy",
  attention: "Eʼtibor talab qiladi",
};

export interface WellbeingNote {
  id: string;
  childId: string;
  kind: WellbeingKind;
  /** Yozuvni kim kiritgan. */
  authorId: string;
  /** Fan oʻqituvchisi yozgan boʻlsa — qaysi fandan. */
  subject?: string;
  tone: WellbeingTone;
  text: string;
  createdAt: string;
}

export const WELLBEING_NOTES: WellbeingNote[] = [
  // ── 11-A, Alisher (c-1) ──
  {
    id: "wb-1",
    childId: "c-1",
    kind: "behavior",
    authorId: "t-1",
    tone: "positive",
    text: "Sinf rahbari sifatida: Alisher sinf tadbirlarida faol, kichik sinflarga yordam beradi. Intizomi yaxshi.",
    createdAt: "2026-08-28",
  },
  {
    id: "wb-2",
    childId: "c-1",
    kind: "behavior",
    authorId: "t-3",
    subject: "Fizika",
    tone: "attention",
    text: "Darsda telefonga tez-tez chalgʻiydi. Ogohlantirildi, oʻzi tan oldi va tuzatishga vaʼda berdi.",
    createdAt: "2026-08-26",
  },
  {
    id: "wb-3",
    childId: "c-1",
    kind: "behavior",
    authorId: "t-2",
    subject: "Ona tili",
    tone: "positive",
    text: "Munozarada oʻz fikrini hurmat bilan bayon qiladi, boshqalarni tinglaydi.",
    createdAt: "2026-08-24",
  },
  {
    id: "wb-4",
    childId: "c-1",
    kind: "psychology",
    authorId: "s-psy",
    tone: "neutral",
    text: "Individual suhbat oʻtkazildi. Imtihon davri yaqinlashgani sabab bir oz xavotir bor, bu shu yoshda tabiiy. Uyda dam olish tartibiga eʼtibor berish tavsiya etiladi.",
    createdAt: "2026-08-27",
  },
  // ── 6-B, Zarina (c-2) ──
  {
    id: "wb-5",
    childId: "c-2",
    kind: "behavior",
    authorId: "t-9",
    tone: "positive",
    text: "Sinf rahbari sifatida: Zarina jamoada yaxshi ishlaydi, yangi kelgan oʻquvchiga koʻmaklashdi.",
    createdAt: "2026-08-28",
  },
  {
    id: "wb-6",
    childId: "c-2",
    kind: "behavior",
    authorId: "t-4",
    subject: "Ingliz tili",
    tone: "neutral",
    text: "Darsda tinch, lekin ogʻzaki javob berishdan tortinadi. Koʻproq soʻrab, dadillashtirish kerak.",
    createdAt: "2026-08-25",
  },
  {
    id: "wb-7",
    childId: "c-2",
    kind: "psychology",
    authorId: "s-psy",
    tone: "positive",
    text: "Guruh mashgʻulotida ishtirok etdi. Tengdoshlari bilan muloqoti yaxshi, oʻz-oʻziga ishonchi ortib bormoqda.",
    createdAt: "2026-08-26",
  },
];

export function notesFor(childId: string, kind: WellbeingKind): WellbeingNote[] {
  return WELLBEING_NOTES.filter((n) => n.childId === childId && n.kind === kind).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function noteAuthor(note: WellbeingNote): Staff | null {
  return staffById(note.authorId);
}

/** Yozuv muallifining koʻrsatiladigan roli: "Sinf rahbari" / "Fizika oʻqituvchisi" / "Psixolog". */
export function authorRoleLabel(note: WellbeingNote, homeroomTeacherId: string | null): string {
  if (note.kind === "psychology") return "Maktab psixologi";
  if (note.subject) return `${note.subject} oʻqituvchisi`;
  if (homeroomTeacherId && note.authorId === homeroomTeacherId) return "Sinf rahbari";
  return "Oʻqituvchi";
}
