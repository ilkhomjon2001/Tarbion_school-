import Link from "next/link";
import { SearchIcon } from "@/components/ui/icons";

/** Umumiy 404. Kabinet ichidagi maxsus 404 lar bundan ustun turadi. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="animate-enter w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
          <SearchIcon className="h-6 w-6" />
        </span>
        <p className="num text-h1 font-bold text-brand">404</p>
        <h1 className="mt-1 text-h3 font-semibold text-foreground">Sahifa topilmadi</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Bu havola eskirgan yoki notoʻgʻri boʻlishi mumkin.
        </p>
        <Link
          href="/"
          className="focus-ring mt-5 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
