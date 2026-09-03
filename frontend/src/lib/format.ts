const dayFormatter = new Intl.DateTimeFormat("uz-Latn", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Tashkent",
});

const weekdayFormatter = new Intl.DateTimeFormat("uz-Latn", {
  weekday: "long",
  timeZone: "Asia/Tashkent",
});

export const WEEKDAY_LABELS = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

const dateTimeFormatter = new Intl.DateTimeFormat("uz-Latn", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tashkent",
});

/**
 * Kun (`2026-09-04`) ham, toʻliq ISO (`2026-09-04T12:00:00Z`) ham keladi —
 * backendda TIMESTAMPTZ maydonlar toʻliq shaklda qaytadi. Toʻliq shaklga
 * kun chegarasi qoʻshilsa `Invalid Date` boʻlib, Intl.format RangeError
 * otadi va butun sahifa yiqiladi.
 */
const toDate = (iso: string): Date =>
  new Date(iso.includes("T") ? iso : `${iso}T00:00:00+05:00`);

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Bugungi sana — `2026-09-03`, Asia/Tashkent boʻyicha (CLAUDE.md 3-qoida).
 *
 * Brauzer soati boshqa mintaqada boʻlishi mumkin, kun chegarasi esa
 * maktabniki boʻlishi kerak. `en-CA` ataylab: u ISO shaklida beradi.
 */
export function todayIso(): string {
  return isoDayFormatter.format(new Date());
}

export function formatDate(iso: string): string {
  return dayFormatter.format(toDate(iso));
}

/** «4-sentabr 17:00» — muddatlar uchun, Toshkent vaqtida. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(toDate(iso));
}

export function formatWeekday(iso: string): string {
  return weekdayFormatter.format(toDate(iso));
}

export function daysUntil(iso: string): number {
  const today = new Date();
  const diffMs = toDate(iso).getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

const somFormatter = new Intl.NumberFormat("uz-Latn", { maximumFractionDigits: 0 });

/** Pul — har doim butun so'mda (CLAUDE.md: BIGINT, tiyin yo'q). */
export function formatSom(amount: number): string {
  return `${somFormatter.format(amount)} soʻm`;
}
