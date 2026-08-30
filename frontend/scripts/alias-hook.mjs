/**
 * `@/…` aliasini Node uchun ochadi.
 *
 * tsconfig'da `@/* → src/*` bor, lekin Node uni bilmaydi: u faqat
 * bundler'ga tegishli. Skriptlar (`export-seed.ts`) ilova modullarini
 * toʻgʻridan-toʻgʻri import qilgani uchun shu hook kerak.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = resolvePath(SRC, specifier.slice(2));
    // Kengaytmasiz yozilgan import: `.ts`, `.tsx`, keyin `index.*`.
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      resolvePath(base, "index.ts"),
      resolvePath(base, "index.tsx"),
    ]) {
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        return next(pathToFileURL(candidate).href, context);
      }
    }
  }
  return next(specifier, context);
}
