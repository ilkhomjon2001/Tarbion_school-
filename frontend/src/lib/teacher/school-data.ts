/**
 * Oʻquvchi, vasiy, eʼlon va test maʼlumotlari (demo).
 *
 * TZ: ADM-06, ADM-11 (vasiylar), ADM-12/BOT-04 (eʼlonlar),
 * TST-01..TST-06 (testlar).
 *
 * Backend ulanganda faqat shu fayl almashtiriladi.
 */

// ─────────────────────────── Vasiylar ───────────────────────────

export type GuardianRelation = "father" | "mother" | "guardian";

export const RELATION_LABELS: Record<GuardianRelation, string> = {
  father: "Otasi",
  mother: "Onasi",
  guardian: "Vasiysi",
};

export interface Guardian {
  fullName: string;
  relation: GuardianRelation;
  phone: string;
  /** Telegram bot ulanganmi (BOT-01) — xabar yetib boradimi. */
  telegramLinked: boolean;
  /** Asosiy vasiy — xabar birinchi navbatda shunga ketadi. */
  isPrimary: boolean;
  workplace?: string;
}

export interface StudentProfile {
  studentId: string;
  fullName: string;
  className: string;
  birthDate: string;
  address: string;
  guardians: Guardian[];
}

/**
 * Vasiy maʼlumotlari — FAQAT sinf rahbariga koʻrinadi.
 *
 * CLAUDE.md 6-qoida: bu shaxsiy maʼlumot. Backendda soʻrov darajasida
 * cheklanadi (`WHERE class_id IN (sinf rahbari sinflari)`), frontendda
 * yashirish yetarli emas.
 */
const GUARDIAN_POOL: Omit<Guardian, "isPrimary">[][] = [
  [
    { fullName: "Abdullayev Rustam Baxtiyorovich", relation: "father", phone: "+998 90 123 45 67", telegramLinked: true, workplace: "Tadbirkor" },
    { fullName: "Abdullayeva Nodira Alisherovna", relation: "mother", phone: "+998 93 214 56 78", telegramLinked: true, workplace: "Shifokor" },
  ],
  [
    { fullName: "Azizov Shuhrat Tolibovich", relation: "father", phone: "+998 91 345 67 89", telegramLinked: false, workplace: "Quruvchi" },
    { fullName: "Azizova Gulnora Rahimovna", relation: "mother", phone: "+998 94 456 78 90", telegramLinked: true, workplace: "Oʻqituvchi" },
  ],
  [
    { fullName: "Bekmurodova Zulfiya Karimovna", relation: "mother", phone: "+998 99 567 89 01", telegramLinked: true, workplace: "Buxgalter" },
  ],
  [
    { fullName: "Botirov Jahongir Sobirovich", relation: "father", phone: "+998 97 678 90 12", telegramLinked: true, workplace: "Haydovchi" },
    { fullName: "Botirova Malika Anvarovna", relation: "mother", phone: "+998 90 789 01 23", telegramLinked: false },
  ],
  [
    { fullName: "Choriyeva Dilbar Ergashevna", relation: "guardian", phone: "+998 88 890 12 34", telegramLinked: true, workplace: "Nafaqada" },
  ],
];

const ADDRESSES = [
  "Namangan sh., Navoiy koʻchasi 12-uy",
  "Namangan sh., Uychi koʻchasi 45-uy",
  "Namangan sh., Boburshoh MFY, 8-uy",
  "Namangan sh., Chust yoʻli 103-uy",
  "Namangan sh., Islom Karimov koʻchasi 27-uy",
];

const BIRTH_YEARS = ["2009", "2010"];

/** Oʻquvchining toʻliq kartochkasi — vasiylari bilan. */
export function studentProfile(
  studentId: string,
  fullName: string,
  className: string,
): StudentProfile {
  // Demo uchun barqaror tanlov: bir xil oʻquvchi har safar bir xil maʼlumot.
  const seed = studentId
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0);

  const pool = GUARDIAN_POOL[seed % GUARDIAN_POOL.length];
  const guardians: Guardian[] = pool.map((g, i) => ({ ...g, isPrimary: i === 0 }));

  const day = String((seed % 27) + 1).padStart(2, "0");
  const month = String((seed % 12) + 1).padStart(2, "0");

  return {
    studentId,
    fullName,
    className,
    birthDate: `${day}.${month}.${BIRTH_YEARS[seed % BIRTH_YEARS.length]}`,
    address: ADDRESSES[seed % ADDRESSES.length],
    guardians,
  };
}

// ─────────────────────────── Eʼlonlar ───────────────────────────

/** ADM-12: auditoriya — sinf yoki fan boʻyicha. */
export type AudienceKind = "class" | "subject";

export interface Announcement {
  id: string;
  kind: AudienceKind;
  /** Sinf nomi yoki fan nomi. */
  target: string;
  title: string;
  body: string;
  createdAt: string;
  /** Nechta vasiy/oʻquvchiga yetkazildi. */
  recipients: number;
  important: boolean;
}

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a-1",
    kind: "class",
    target: "11-A",
    title: "Ota-onalar majlisi — 5-sentabr, soat 15:00",
    body:
      "Hurmatli ota-onalar! 5-sentabr kuni soat 15:00 da 204-xonada sinf "
      + "majlisi boʻlib oʻtadi. Chorak yakunlari va imtihonga tayyorgarlik "
      + "muhokama qilinadi. Ishtirokingiz muhim.",
    createdAt: "2026-08-28 14:30",
    recipients: 21,
    important: true,
  },
  {
    id: "a-2",
    kind: "subject",
    target: "Matematika",
    title: "Nazorat ishi — 8-sentabr",
    body:
      "8-sentabr kuni kvadrat tenglamalar boʻyicha nazorat ishi boʻladi. "
      + "Darslikning 38–46-betlaridagi mavzular kiradi. Kalkulyator ruxsat etilmaydi.",
    createdAt: "2026-08-27 09:15",
    recipients: 33,
    important: false,
  },
  {
    id: "a-3",
    kind: "class",
    target: "11-A",
    title: "Dars jadvalida oʻzgarish",
    body:
      "Payshanba kuni 4-para algebra oʻrniga geometriya boʻladi. Kerakli "
      + "jihozlarni olib kelishni unutmang.",
    createdAt: "2026-08-26 17:40",
    recipients: 21,
    important: false,
  },
];

// ─────────────────────────── Testlar ───────────────────────────

export type TestStatus = "draft" | "published" | "closed";

export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  draft: "Qoralama",
  published: "Faol",
  closed: "Yakunlangan",
};

export type QuestionType = "single" | "multiple";

export interface TestQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  /** Toʻgʻri javob indekslari. */
  correct: number[];
  points: number;
}

export interface TestItem {
  id: string;
  title: string;
  subject: string;
  className: string;
  status: TestStatus;
  durationMinutes: number;
  /** TST-03: har oʻquvchiga nechta urinish beriladi. */
  attempts: number;
  /** TST-03: savollar tasodifiy tartibda chiqsinmi. */
  shuffle: boolean;
  opensAt: string;
  closesAt: string;
  questions: TestQuestion[];
  /** Natijalar (TST-05). */
  submitted: number;
  totalStudents: number;
  averagePercent: number | null;
}

export const DEMO_TESTS: TestItem[] = [
  {
    id: "t-1",
    title: "Kvadrat tenglamalar — nazorat testi",
    subject: "Algebra",
    className: "11-A",
    status: "published",
    durationMinutes: 30,
    attempts: 1,
    shuffle: true,
    opensAt: "2026-08-30 09:00",
    closesAt: "2026-09-02 18:00",
    submitted: 14,
    totalStudents: 21,
    averagePercent: 78,
    questions: [
      {
        id: "q-1",
        text: "x² − 5x + 6 = 0 tenglamaning ildizlari qaysi?",
        type: "single",
        options: ["x = 2 va x = 3", "x = 1 va x = 6", "x = −2 va x = −3", "Ildizi yoʻq"],
        correct: [0],
        points: 1,
      },
      {
        id: "q-2",
        text: "Diskriminant manfiy boʻlsa, tenglama haqida nima deyish mumkin?",
        type: "single",
        options: [
          "Ikkita haqiqiy ildizi bor",
          "Bitta haqiqiy ildizi bor",
          "Haqiqiy ildizi yoʻq",
          "Cheksiz koʻp ildizi bor",
        ],
        correct: [2],
        points: 1,
      },
      {
        id: "q-3",
        text: "Quyidagilardan qaysilari kvadrat tenglama? (bir nechta javob)",
        type: "multiple",
        options: ["2x² + 3x − 1 = 0", "x + 5 = 0", "x² − 9 = 0", "x³ + x = 0"],
        correct: [0, 2],
        points: 2,
      },
    ],
  },
  {
    id: "t-2",
    title: "Kasrlar — joriy nazorat",
    subject: "Matematika",
    className: "9-B",
    status: "draft",
    durationMinutes: 20,
    attempts: 2,
    shuffle: false,
    opensAt: "2026-09-03 08:30",
    closesAt: "2026-09-05 18:00",
    submitted: 0,
    totalStudents: 18,
    averagePercent: null,
    questions: [
      {
        id: "q-1",
        text: "1/2 + 1/3 nechaga teng?",
        type: "single",
        options: ["2/5", "5/6", "1/6", "2/6"],
        correct: [1],
        points: 1,
      },
    ],
  },
  {
    id: "t-3",
    title: "Uchburchaklar tengligi",
    subject: "Geometriya",
    className: "10-A",
    status: "closed",
    durationMinutes: 25,
    attempts: 1,
    shuffle: true,
    opensAt: "2026-08-24 09:00",
    closesAt: "2026-08-27 18:00",
    submitted: 19,
    totalStudents: 19,
    averagePercent: 86,
    questions: [],
  },
];
