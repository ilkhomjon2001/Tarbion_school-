/**
 * Murojaatlar va yozishmalar — ota-ona, ustoz va rahbariyat uchun YAGONA manba.
 *
 * TZ: MUR-01…MUR-06. TZ'da murojaat "mavzuga qarab masʼulga yoʻnaltiriladi"
 * deyilgan; loyiha egasining soʻroviga koʻra ota-ona endi mavzuni emas,
 * TOʻGʻRIDAN-TOʻGʻRI KIMGA yozishini tanlaydi (rahbariyat / sinf rahbari /
 * fan oʻqituvchisi → keyin fan). Har bir murojaat ochiq yozishma (chat)
 * shaklida davom etadi.
 *
 * Bu fayl endi faqat TIP va yorliq qatlami — maʼlumot `lib/appeals/api.ts`
 * orqali backenddan keladi. Kirish nazorati serverda, soʻrov darajasida.
 */

import {
  APPEAL_STATUS_LABELS,
  APPEAL_TARGET_LABELS,
  type AppealStatus,
  type AppealTarget,
} from "@/lib/contracts";

// Kod va yorliqlar backend enum'ining aksi — `lib/contracts.ts` da.
// Bu yerda qayta eʼlon qilinmaydi (CLAUDE.md: «frontendda yangi kod
// oʻylab topilmaydi»). Qayta eksport — eski importlar buzilmasin uchun.
export { APPEAL_STATUS_LABELS, APPEAL_TARGET_LABELS };
export type { AppealStatus, AppealTarget };

export type MessageAuthor = "parent" | "staff";

export interface AppealMessage {
  id: string;
  author: MessageAuthor;
  /** Muallif ismi — backenddan javob bilan birga keladi. */
  authorName?: string;
  text: string;
  createdAt: string;
}

export interface Appeal {
  id: string;
  target: AppealTarget;
  /** Murojaat yoʻnaltirilgan xodim. Rahbariyat uchun boʻsh boʻlishi mumkin. */
  assigneeId: string;
  /** Masʼul ismi — backenddan. */
  assigneeName?: string;
  /**
   * Yozishmani MAKTAB boshlagan boʻlsa — kim boshlagani. Ota-ona oʻzi
   * yozgan murojaatda boʻsh: «kim ochgan» savoli tugʻilmaydi.
   */
  openedByName?: string;
  /** Faqat `subject_teacher` uchun. */
  subject?: string;
  className: string;
  studentFullName: string;
  parentName: string;
  title: string;
  status: AppealStatus;
  createdAt: string;
  /** MUR-04: javob berish muddati. */
  dueAt: string;
  messages: AppealMessage[];
}

/** Murojaat "ochiq" (hali yopilmagan) holatdami. */
export function isOpen(appeal: Appeal): boolean {
  return appeal.status !== "closed";
}

