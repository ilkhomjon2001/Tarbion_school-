/**
 * Ilova yangilanganda (deploy yoki dev serverni qayta ishga tushirish)
 * brauzerdagi ochiq sahifa eski JS boʻlaklarini soʻrashda davom etadi.
 * Ular server tomonda allaqachon yoʻq — natijada sahifa xatolik chegarasiga
 * tushadi.
 *
 * Bunday holatda `reset()` foydasiz: eski boʻlak qaytib kelmaydi, sahifani
 * BUTUNLAY qayta yuklash kerak. Shuning uchun oddiy xatodan ajratamiz va
 * foydalanuvchiga toʻgʻri tugmani koʻrsatamiz.
 */
const STALE_PATTERNS = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
];

export function isStaleBundleError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  const haystack = `${err.name ?? ""} ${err.message ?? ""}`;
  return STALE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

/** Keshni chetlab oʻtib qayta yuklash. */
export function hardReload() {
  if (typeof window !== "undefined") window.location.reload();
}
