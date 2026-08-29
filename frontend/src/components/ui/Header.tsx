import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";

export function Header({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Orqaga"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
      ) : null}
      <h1 className="truncate text-base font-semibold text-foreground">
        {title}
      </h1>
    </header>
  );
}
