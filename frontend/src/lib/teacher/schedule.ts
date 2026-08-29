/**
 * Ustozning umumiy dars jadvali (ADM-08).
 *
 * Haftalik shablon asosida istalgan sana oraligʻiga darslar hosil qilinadi —
 * xuddi backend `lessons` jadvalini `schedule_entries` dan generatsiya
 * qilgani kabi (T-012). Shanbadagi darslar `data.ts` dagi bugungi darslar
 * bilan bir xil, shunda ikkala ekran bir-biriga zid koʻrsatmaydi.
 */

import { DEMO_DATE } from "@/lib/teacher/data";

export interface ScheduleLesson {
  id: string;
  date: string; // "2026-08-29"
  weekday: number; // 1 = dushanba … 7 = yakshanba
  period: number;
  startTime: string;
  endTime: string;
  className: string;
  subject: string;
  room: string;
}

/** Qoʻngʻiroqlar jadvali (ADM-07). */
export const BELL_SCHEDULE: Record<number, { start: string; end: string }> = {
  1: { start: "08:30", end: "09:15" },
  2: { start: "09:25", end: "10:10" },
  3: { start: "10:20", end: "11:05" },
  4: { start: "11:20", end: "12:05" },
  5: { start: "12:15", end: "13:00" },
  6: { start: "13:15", end: "14:00" },
  7: { start: "14:10", end: "14:55" },
};

interface PatternEntry {
  weekday: number;
  period: number;
  className: string;
  subject: string;
  room: string;
}

/** Ustozning haftalik yuklamasi (MET-09). */
const WEEKLY_PATTERN: PatternEntry[] = [
  // Dushanba
  { weekday: 1, period: 1, className: "11-A", subject: "Algebra", room: "204-xona" },
  { weekday: 1, period: 2, className: "9-B", subject: "Matematika", room: "204-xona" },
  { weekday: 1, period: 4, className: "10-A", subject: "Geometriya", room: "301-xona" },
  // Seshanba
  { weekday: 2, period: 1, className: "10-A", subject: "Algebra", room: "301-xona" },
  { weekday: 2, period: 3, className: "11-A", subject: "Geometriya", room: "204-xona" },
  { weekday: 2, period: 5, className: "9-B", subject: "Algebra", room: "204-xona" },
  // Chorshanba
  { weekday: 3, period: 1, className: "11-A", subject: "Matematika", room: "204-xona" },
  { weekday: 3, period: 2, className: "9-B", subject: "Algebra", room: "204-xona" },
  { weekday: 3, period: 5, className: "10-A", subject: "Matematika", room: "301-xona" },
  // Payshanba
  { weekday: 4, period: 2, className: "9-B", subject: "Geometriya", room: "204-xona" },
  { weekday: 4, period: 4, className: "11-A", subject: "Algebra", room: "204-xona" },
  // Juma
  { weekday: 5, period: 1, className: "11-A", subject: "Matematika", room: "204-xona" },
  { weekday: 5, period: 3, className: "10-A", subject: "Algebra", room: "301-xona" },
  { weekday: 5, period: 6, className: "9-B", subject: "Matematika", room: "204-xona" },
  // Shanba — bugungi darslar bilan bir xil (data.ts dagi DEMO_LESSONS)
  { weekday: 6, period: 1, className: "11-A", subject: "Matematika", room: "204-xona" },
  { weekday: 6, period: 2, className: "9-B", subject: "Matematika", room: "204-xona" },
  { weekday: 6, period: 4, className: "10-A", subject: "Geometriya", room: "301-xona" },
  { weekday: 6, period: 6, className: "11-A", subject: "Algebra", room: "204-xona" },
];

/** Taʼtil kunlari — bu sanalarda dars boʻlmaydi (T-012). */
const HOLIDAYS = new Set(["2026-09-01"]);

export const HOLIDAY_TITLES: Record<string, string> = {
  "2026-09-01": "Mustaqillik kuni",
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JS `getDay()` (0=yakshanba) → ISO (1=dushanba … 7=yakshanba). */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Berilgan sana oraligʻidagi barcha darslar. */
export function buildLessons(from: Date, to: Date): ScheduleLesson[] {
  const out: ScheduleLesson[] = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    const date = isoDate(cursor);
    const weekday = isoWeekday(cursor);

    if (!HOLIDAYS.has(date)) {
      for (const entry of WEEKLY_PATTERN) {
        if (entry.weekday !== weekday) continue;
        const bell = BELL_SCHEDULE[entry.period];
        out.push({
          id: `${date}-p${entry.period}-${entry.className}`,
          date,
          weekday,
          period: entry.period,
          startTime: bell.start,
          endTime: bell.end,
          className: entry.className,
          subject: entry.subject,
          room: entry.room,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return out.sort((a, b) =>
    a.date === b.date ? a.period - b.period : a.date < b.date ? -1 : 1,
  );
}

export function isHoliday(date: string): boolean {
  return HOLIDAYS.has(date);
}

/**
 * Sinf boʻyicha rang. Har bir sinf — bitta rang, shunda jadvalda qaysi sinf
 * qayerda ekani bir qarashda koʻrinadi.
 *
 * Rang yolgʻiz maʼno tashimaydi — blok ichida sinf nomi ham yozilgan
 * (rang koʻrmaydigan foydalanuvchilar uchun).
 */
export const CLASS_COLORS: Record<string, { block: string; dot: string }> = {
  "11-A": { block: "bg-brand text-brand-foreground", dot: "bg-brand" },
  "9-B": { block: "bg-info text-brand-foreground", dot: "bg-info" },
  "10-A": { block: "bg-warning text-brand-foreground", dot: "bg-warning" },
};

export const FALLBACK_COLOR = {
  block: "bg-foreground-muted text-brand-foreground",
  dot: "bg-foreground-muted",
};

export function classColor(className: string) {
  return CLASS_COLORS[className] ?? FALLBACK_COLOR;
}

export const ALL_CLASSES = Object.keys(CLASS_COLORS);

export const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
export const WEEKDAY_LONG = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];
export const MONTHS_UZ = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

/** Demo "bugun" — taqdimot har safar bir xil chiqishi uchun qatʼiy sana. */
export const TODAY = DEMO_DATE;

export function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()].toLowerCase()}, ${
    WEEKDAY_LONG[isoWeekday(d) - 1].toLowerCase()
  }`;
}
