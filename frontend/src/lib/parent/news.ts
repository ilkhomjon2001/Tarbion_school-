"use client";

/**
 * Eʼlonlar, yangiliklar, musobaqa va tadbirlar (OTA-08).
 *
 * TZ: "Maktab eʼlonlari va tadbirlar taqvimi". Amalda ota-onaga toʻrt xil
 * xabar keladi va ular bir-biridan farq qiladi:
 *
 *   yangilik  — maktab hayotidan xabar, amal talab qilmaydi
 *   ustoz     — sinf ustozidan kelgan xabar, koʻpincha aniq sinfga
 *   musobaqa  — farzand qatnasha oladigan tanlov, muddati bor
 *   tadbir    — sana, vaqt va joyi bor, ota-ona borishi mumkin
 *
 * Shuning uchun ular bitta roʻyxatda emas, turi boʻyicha filtrlanadi:
 * tadbirda "qachon va qayerda" muhim, yangilikda esa yoʻq.
 */

export type NewsKind = "news" | "teacher" | "contest" | "event";

export const NEWS_KIND_LABELS: Record<NewsKind, string> = {
  news: "Yangilik",
  teacher: "Ustozdan",
  contest: "Musobaqa",
  event: "Tadbir",
};

export const NEWS_KIND_TONE: Record<NewsKind, string> = {
  news: "bg-surface-muted text-foreground-muted",
  teacher: "bg-brand-tint text-brand-dark",
  contest: "bg-warning-tint text-warning",
  event: "bg-info-tint text-info",
};

export interface NewsItem {
  id: string;
  kind: NewsKind;
  title: string;
  body: string;
  from: string;
  createdAt: string;
  important: boolean;
  /** Qaysi sinfga tegishli. Boʻsh boʻlsa — butun maktabga. */
  className?: string;
  /** Tadbir va musobaqa uchun: qachon, qayerda, muddat. */
  eventDate?: string;
  eventTime?: string;
  place?: string;
  /** Musobaqa uchun roʻyxatdan oʻtish muddati. */
  deadline?: string;
}

export const NEWS: NewsItem[] = [
  {
    id: "n-1",
    kind: "teacher",
    title: "Ota-onalar majlisi — 5-sentabr, soat 15:00",
    body:
      "Hurmatli ota-onalar! 5-sentabr kuni soat 15:00 da 204-xonada sinf majlisi "
      + "boʻlib oʻtadi. Chorak yakunlari, imtihonga tayyorgarlik va sinf jamgʻarmasi "
      + "muhokama qilinadi. Ishtirokingiz muhim.",
    from: "Aliyev S. — sinf rahbari",
    createdAt: "2026-08-28 14:30",
    important: true,
    className: "11-A",
    eventDate: "2026-09-05",
    eventTime: "15:00",
    place: "204-xona",
  },
  {
    id: "n-2",
    kind: "contest",
    title: "«Yosh matematik» olimpiadasi — roʻyxatdan oʻtish ochiq",
    body:
      "Namangan viloyat bosqichiga saralash 12-sentabr kuni maktabda oʻtkaziladi. "
      + "5–11-sinf oʻquvchilari qatnasha oladi. Gʻoliblar viloyat bosqichiga yoʻllanma "
      + "oladi. Roʻyxatdan oʻtish uchun sinf rahbariga murojaat qiling.",
    from: "Oʻquv boʻlimi",
    createdAt: "2026-08-28 10:05",
    important: false,
    eventDate: "2026-09-12",
    eventTime: "09:00",
    place: "Aktzal",
    deadline: "2026-09-08",
  },
  {
    id: "n-3",
    kind: "teacher",
    title: "Nazorat ishi — 8-sentabr",
    body:
      "8-sentabr kuni kvadrat tenglamalar boʻyicha nazorat ishi boʻladi. "
      + "Darslikning 38–46-betlaridagi mavzular kiradi. Kalkulyator ruxsat etilmaydi.",
    from: "Aliyev S. — matematika",
    createdAt: "2026-08-27 09:15",
    important: false,
    className: "11-A",
  },
  {
    id: "n-4",
    kind: "event",
    title: "Bilimlar kuni — 1-sentabr bayram tadbiri",
    body:
      "1-sentabr kuni soat 09:00 da maktab hovlisida bayram tadbiri boʻlib oʻtadi. "
      + "Oʻquvchilar bayramona kiyimda kelishlari soʻraladi. Ota-onalar taklif "
      + "etiladi. Tadbir taxminan 1,5 soat davom etadi.",
    from: "Maktab administratsiyasi",
    createdAt: "2026-08-26 16:40",
    important: true,
    eventDate: "2026-09-01",
    eventTime: "09:00",
    place: "Maktab hovlisi",
  },
  {
    id: "n-5",
    kind: "contest",
    title: "Robototexnika musobaqasi — «RoboRace 2026»",
    body:
      "6–8-sinf oʻquvchilari uchun robot yigʻish va dasturlash musobaqasi. "
      + "Jamoalar 3 kishidan. Gʻolib jamoa respublika bosqichida qatnashadi. "
      + "Mashgʻulotlar shanba kunlari IT-xonada.",
    from: "Abduqaxxorov I. — robototexnika",
    createdAt: "2026-08-25 12:20",
    important: false,
    eventDate: "2026-10-04",
    eventTime: "10:00",
    place: "IT-xona",
    deadline: "2026-09-20",
  },
  {
    id: "n-6",
    kind: "news",
    title: "Maktab kutubxonasi yangi kitoblar bilan toʻldirildi",
    body:
      "Kutubxonaga 400 dan ortiq yangi kitob keldi: badiiy adabiyot, ilmiy-ommabop "
      + "nashrlar va darsliklar. Oʻquvchilar tanaffuslarda va darsdan keyin "
      + "foydalanishlari mumkin.",
    from: "Maktab administratsiyasi",
    createdAt: "2026-08-25 11:00",
    important: false,
  },
  {
    id: "n-7",
    kind: "news",
    title: "Maktab formasi haqida eslatma",
    body:
      "1-sentabrdan boshlab maktab formasi majburiy. Forma maktab doʻkonidan yoki "
      + "koʻrsatilgan tikuvchilik korxonasidan olinishi mumkin. Savollar boʻlsa "
      + "administratsiyaga murojaat qiling.",
    from: "Maktab administratsiyasi",
    createdAt: "2026-08-24 09:30",
    important: false,
  },
  {
    id: "n-8",
    kind: "event",
    title: "Ochiq eshiklar kuni — 20-sentabr",
    body:
      "Ota-onalar darslarda qatnashishlari, ustozlar bilan suhbatlashishlari mumkin. "
      + "Oldindan yozilish shart emas.",
    from: "Maktab administratsiyasi",
    createdAt: "2026-08-24 09:00",
    important: false,
    eventDate: "2026-09-20",
    eventTime: "08:30",
    place: "Maktab binosi",
  },
];

/** Ota-ona farzandiga tegishli xabarlar: butun maktab + oʻz sinfi. */
export function newsForClass(className: string): NewsItem[] {
  return NEWS.filter((n) => !n.className || n.className === className);
}

// ─────────────────────── Oʻqilganlarni kuzatish ───────────────────────

const READ_KEY = "tarbion.parent.readNews";

export function getReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markRead(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const merged = Array.from(new Set([...getReadIds(), ...ids]));
    window.localStorage.setItem(READ_KEY, JSON.stringify(merged));
  } catch {
    /* xotira bloklangan — belgilash oʻtkazib yuboriladi */
  }
}

export function unreadCount(className: string): number {
  const read = new Set(getReadIds());
  return newsForClass(className).filter((n) => !read.has(n.id)).length;
}
