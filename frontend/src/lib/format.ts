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

export function formatDate(iso: string): string {
  return dayFormatter.format(new Date(`${iso}T00:00:00+05:00`));
}

export function formatWeekday(iso: string): string {
  return weekdayFormatter.format(new Date(`${iso}T00:00:00+05:00`));
}

export function daysUntil(iso: string): number {
  const today = new Date();
  const target = new Date(`${iso}T00:00:00+05:00`);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
