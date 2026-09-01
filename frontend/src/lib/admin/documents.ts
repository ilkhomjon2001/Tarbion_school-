/**
 * Maʼlumotnoma matnlari.
 *
 * Har bir tur uchun alohida shablon — maydonlar bazadan avtomatik
 * toʻladi, admin faqat "kimga taqdim etiladi" va qoʻshimcha matnni
 * kiritadi. Backend ulanganda shablonlar `document_templates`
 * jadvalidan olinadi, shunda matn oʻzgarganda kod qayta yigʻilmaydi.
 */

import type { DocumentType } from "@/lib/admin/types";

export const SCHOOL_NAME = "«Tarbion» xususiy umumtaʼlim maktabi";

export interface DocumentContext {
  student: { fullName: string; birthYear: number | string; className: string };
  academicYear: string;
  recipient: string;
  extraText: string;
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export function fullDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}-${MONTHS[Number(m) - 1] ?? m} ${y}-yil`;
}

/** Turga xos ikkinchi xatboshi. */
function typeParagraph(type: DocumentType): string {
  switch (type) {
    case "oquv_joyi":
      return "Oʻquvchi ushbu taʼlim muassasasida oʻqishni davom ettirmoqda.";
    case "daromad":
      return "Oʻquvchining taʼlimi shartnoma asosida amalga oshiriladi. Oylik shartnoma summasi belgilangan tartibda toʻlanadi.";
    case "harbiy":
      return "Maʼlumotnoma harbiy hisobga olish maqsadida, oʻquvchining taʼlim muassasasida oʻqiyotganini tasdiqlash uchun berildi.";
    case "baho_kochirmasi":
      return "Oʻquvchining joriy oʻquv yilidagi fanlar boʻyicha baholari ilova qilingan koʻchirmada keltirilgan.";
    case "tibbiy":
      return "Maʼlumotnoma tibbiy koʻrikdan oʻtish va 086-U shaklini rasmiylashtirish uchun berildi.";
  }
}

/** Hujjat matni — xatboshilar roʻyxati sifatida. */
export function buildDocumentText(type: DocumentType, context: DocumentContext): string[] {
  const { student, academicYear, recipient, extraText } = context;

  const intro = `Ushbu maʼlumotnoma ${student.fullName} (tugʻilgan yili: ${student.birthYear}) ga berildi. U haqiqatdan ham ${SCHOOL_NAME}ning ${student.className} sinfida ${academicYear} oʻquv yili dasturi asosida taʼlim olmoqda.`;

  const lines = [intro, typeParagraph(type)];
  lines.push(
    `Maʼlumotnoma ${recipient.trim() || "talab qilingan joyga"} taqdim etish uchun berildi.`,
  );
  if (extraText.trim()) lines.push(extraText.trim());
  return lines;
}
