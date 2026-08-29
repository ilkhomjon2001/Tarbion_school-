/**
 * Murojaatlar va yozishmalar — ota-ona, ustoz va rahbariyat uchun YAGONA manba.
 *
 * TZ: MUR-01…MUR-06. TZ'da murojaat "mavzuga qarab masʼulga yoʻnaltiriladi"
 * deyilgan; loyiha egasining soʻroviga koʻra ota-ona endi mavzuni emas,
 * TOʻGʻRIDAN-TOʻGʻRI KIMGA yozishini tanlaydi (rahbariyat / sinf rahbari /
 * fan oʻqituvchisi → keyin fan). Har bir murojaat ochiq yozishma (chat)
 * shaklida davom etadi.
 *
 * Backend ulanganda: `appeals` + `appeal_messages` jadvallari. Kirish
 * nazorati soʻrov darajasida boʻlishi shart (CLAUDE.md 6/7-qoida) — ota-ona
 * faqat oʻz murojaatlarini, ustoz faqat oʻziga kelganini koʻradi.
 */

import { staffById, type Staff } from "@/lib/school/staff";

/** Murojaat kimga yoʻnaltirilgan. */
export type AppealTarget = "rahbariyat" | "sinf_rahbari" | "fan_oqituvchisi";

export const APPEAL_TARGET_LABELS: Record<AppealTarget, string> = {
  rahbariyat: "Rahbariyat",
  sinf_rahbari: "Sinf rahbari",
  fan_oqituvchisi: "Fan oʻqituvchisi",
};

export type AppealStatus = "new" | "in_review" | "answered" | "closed";

export const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  new: "Yangi",
  in_review: "Koʻrib chiqilmoqda",
  answered: "Javob berildi",
  closed: "Yopilgan",
};

export type MessageAuthor = "parent" | "staff";

export interface AppealMessage {
  id: string;
  author: MessageAuthor;
  /** Xodim yozgan boʻlsa — uning id'si. */
  staffId?: string;
  text: string;
  createdAt: string;
}

export interface Appeal {
  id: string;
  target: AppealTarget;
  /** Murojaat yoʻnaltirilgan xodim (rahbariyat uchun ham toʻldiriladi). */
  assigneeId: string;
  /** Faqat `fan_oqituvchisi` uchun. */
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

/** Demo: hozirgi ota-ona (ota-ona kabinetiga kirgan foydalanuvchi). */
export const CURRENT_PARENT = "Abdullayev Rustam";

export const APPEALS: Appeal[] = [
  {
    id: "ap-1",
    target: "fan_oqituvchisi",
    assigneeId: "t-1",
    subject: "Algebra",
    className: "11-A",
    studentFullName: "Abdullayev Alisher",
    parentName: CURRENT_PARENT,
    title: "Algebra boʻyicha qoʻshimcha mashgʻulot",
    status: "answered",
    createdAt: "2026-08-27 09:20",
    dueAt: "2026-08-30",
    messages: [
      {
        id: "ap-1-m1",
        author: "parent",
        text: "Assalomu alaykum. Alisher algebradan bir oz orqada qolyapti. Qoʻshimcha mashgʻulot uyushtirish imkoni bormi?",
        createdAt: "2026-08-27 09:20",
      },
      {
        id: "ap-1-m2",
        author: "staff",
        staffId: "t-1",
        text: "Vaalaykum assalom. Albatta, har seshanba soat 15:00 da qoʻshimcha darsim bor. Alisherni kutaman.",
        createdAt: "2026-08-27 12:40",
      },
      {
        id: "ap-1-m3",
        author: "parent",
        text: "Rahmat, kelib turadi.",
        createdAt: "2026-08-27 13:05",
      },
    ],
  },
  {
    id: "ap-2",
    target: "sinf_rahbari",
    assigneeId: "t-1",
    className: "11-A",
    studentFullName: "Abdullayev Alisher",
    parentName: CURRENT_PARENT,
    title: "Sinfdagi oʻzaro munosabat haqida",
    status: "in_review",
    createdAt: "2026-08-28 16:10",
    dueAt: "2026-08-31",
    messages: [
      {
        id: "ap-2-m1",
        author: "parent",
        text: "Alisher soʻnggi paytda sinfga borishni xohlamayapti. Sinfda biror nizo boʻlganmi?",
        createdAt: "2026-08-28 16:10",
      },
      {
        id: "ap-2-m2",
        author: "staff",
        staffId: "t-1",
        text: "Xabar uchun rahmat. Bugun bolalar bilan gaplashib, sizga aniq javob beraman.",
        createdAt: "2026-08-28 17:30",
      },
    ],
  },
  {
    id: "ap-3",
    target: "rahbariyat",
    assigneeId: "s-dir",
    className: "6-B",
    studentFullName: "Abdullayeva Zarina",
    parentName: CURRENT_PARENT,
    title: "Toʻlov muddatini uzaytirish",
    status: "new",
    createdAt: "2026-08-29 08:05",
    dueAt: "2026-09-01",
    messages: [
      {
        id: "ap-3-m1",
        author: "parent",
        text: "Sentabr toʻlovini 5 kunga kechiktirish imkoni bormi?",
        createdAt: "2026-08-29 08:05",
      },
    ],
  },
  // Boshqa ota-onalardan kelgan murojaatlar — rahbariyat statistikasi uchun.
  {
    id: "ap-4",
    target: "rahbariyat",
    assigneeId: "s-dir",
    className: "11-B",
    studentFullName: "Jaloliddin Mirzayev",
    parentName: "Mirzayev Aziz",
    title: "Dars jadvali juda zich",
    status: "closed",
    createdAt: "2026-08-26 11:20",
    dueAt: "2026-08-29",
    messages: [
      {
        id: "ap-4-m1",
        author: "parent",
        text: "Farzandimning payshanba kungi jadvali juda zich, koʻrib chiqsangiz.",
        createdAt: "2026-08-26 11:20",
      },
      {
        id: "ap-4-m2",
        author: "staff",
        staffId: "s-dir",
        text: "Payshanba kungi jadval qayta koʻrib chiqildi, bir para kamaytirildi.",
        createdAt: "2026-08-26 15:30",
      },
    ],
  },
  {
    id: "ap-5",
    target: "fan_oqituvchisi",
    assigneeId: "t-3",
    subject: "Fizika",
    className: "11-B",
    studentFullName: "Sevinch Qodirova",
    parentName: "Qodirov Ulugʻbek",
    title: "Fizikadan nazorat ishi natijasi",
    status: "new",
    createdAt: "2026-08-29 07:40",
    dueAt: "2026-09-01",
    messages: [
      {
        id: "ap-5-m1",
        author: "parent",
        text: "Nazorat ishi bahosi qanday hisoblangan? Tushuntirib bera olasizmi?",
        createdAt: "2026-08-29 07:40",
      },
    ],
  },
  {
    id: "ap-6",
    target: "sinf_rahbari",
    assigneeId: "t-3",
    className: "11-B",
    studentFullName: "Jaloliddin Mirzayev",
    parentName: "Mirzayev Aziz",
    title: "Davomat boʻyicha savol",
    status: "in_review",
    createdAt: "2026-08-28 09:15",
    dueAt: "2026-08-31",
    messages: [
      {
        id: "ap-6-m1",
        author: "parent",
        text: "Oʻgʻlim kasal boʻlgani uchun 2 kun kelmagandi, sababli deb belgilandimi?",
        createdAt: "2026-08-28 09:15",
      },
    ],
  },
  {
    id: "ap-7",
    target: "rahbariyat",
    assigneeId: "s-dir",
    className: "5-A",
    studentFullName: "Malika Nortojiyeva",
    parentName: "Nortojiyev Sherzod",
    title: "Ovqatlanish narxi haqida",
    status: "new",
    createdAt: "2026-08-29 08:10",
    dueAt: "2026-09-01",
    messages: [
      {
        id: "ap-7-m1",
        author: "parent",
        text: "Oshxona narxlari qachondan oshadi, oldindan xabar berilsinmi?",
        createdAt: "2026-08-29 08:10",
      },
    ],
  },
  {
    id: "ap-8",
    target: "fan_oqituvchisi",
    assigneeId: "t-2",
    subject: "Ona tili",
    className: "9-B",
    studentFullName: "Madina Nazarova",
    parentName: "Nazarova Gulbahor",
    title: "Insho topshirigʻi haqida",
    status: "answered",
    createdAt: "2026-08-27 14:00",
    dueAt: "2026-08-30",
    messages: [
      {
        id: "ap-8-m1",
        author: "parent",
        text: "Insho topshirish muddati uzaytiriladimi?",
        createdAt: "2026-08-27 14:00",
      },
      {
        id: "ap-8-m2",
        author: "staff",
        staffId: "t-2",
        text: "Muddat dushanbagacha uzaytirildi.",
        createdAt: "2026-08-27 16:20",
      },
    ],
  },
  {
    id: "ap-9",
    target: "sinf_rahbari",
    assigneeId: "t-5",
    className: "9-B",
    studentFullName: "Sherzod Rustamov",
    parentName: "Rustamov Olim",
    title: "Sinfdan tashqari mashgʻulotlar",
    status: "new",
    createdAt: "2026-08-29 10:30",
    dueAt: "2026-09-02",
    messages: [
      {
        id: "ap-9-m1",
        author: "parent",
        text: "Toʻgarakka qanday yozilish mumkin?",
        createdAt: "2026-08-29 10:30",
      },
    ],
  },
];

export function appealAssignee(appeal: Appeal): Staff | null {
  return staffById(appeal.assigneeId);
}

/** Murojaat "ochiq" (hali yopilmagan) holatdami. */
export function isOpen(appeal: Appeal): boolean {
  return appeal.status !== "closed";
}

/** Rahbariyatga kelgan murojaatlar. */
export function appealsForManagement(list: Appeal[] = APPEALS): Appeal[] {
  return list.filter((a) => a.target === "rahbariyat");
}

/** Ustozlarga (sinf rahbari yoki fan oʻqituvchisi) kelgan murojaatlar. */
export function appealsForTeachers(list: Appeal[] = APPEALS): Appeal[] {
  return list.filter((a) => a.target !== "rahbariyat");
}

/** Muayyan xodimga kelgan murojaatlar — ustoz kabineti uchun. */
export function appealsAssignedTo(staffId: string, list: Appeal[] = APPEALS): Appeal[] {
  return list.filter((a) => a.assigneeId === staffId);
}

/** Bitta ota-onaning murojaatlari — ota-ona kabineti uchun. */
export function appealsFromParent(parentName: string, list: Appeal[] = APPEALS): Appeal[] {
  return list.filter((a) => a.parentName === parentName);
}

export interface ClassAppealStat {
  className: string;
  total: number;
  open: number;
  toManagement: number;
  toTeachers: number;
}

/**
 * Sinflar kesimida murojaatlar statistikasi — qaysi sinfda muammo koʻp
 * ekanini bir qarashda koʻrish uchun (koʻpdan kamga).
 */
export function appealStatsByClass(list: Appeal[] = APPEALS): ClassAppealStat[] {
  const map = new Map<string, ClassAppealStat>();
  for (const appeal of list) {
    const stat = map.get(appeal.className) ?? {
      className: appeal.className,
      total: 0,
      open: 0,
      toManagement: 0,
      toTeachers: 0,
    };
    stat.total += 1;
    if (isOpen(appeal)) stat.open += 1;
    if (appeal.target === "rahbariyat") stat.toManagement += 1;
    else stat.toTeachers += 1;
    map.set(appeal.className, stat);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/** Yangi xabar qoʻshilgan murojaatni qaytaradi (mutatsiyasiz). */
export function withNewMessage(
  appeal: Appeal,
  message: { author: MessageAuthor; staffId?: string; text: string },
): Appeal {
  const next: AppealMessage = {
    id: `${appeal.id}-m${appeal.messages.length + 1}`,
    author: message.author,
    staffId: message.staffId,
    text: message.text,
    createdAt: "Hozir",
  };
  const status: AppealStatus =
    message.author === "staff"
      ? "answered"
      : appeal.status === "closed"
        ? "in_review"
        : appeal.status;
  return { ...appeal, status, messages: [...appeal.messages, next] };
}
