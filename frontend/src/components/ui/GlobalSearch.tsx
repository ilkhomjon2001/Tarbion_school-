"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import type { SearchIndexItem } from "@/lib/search";

export function GlobalSearch({
  index,
  className = "",
  inputClassName = "",
}: {
  index: SearchIndexItem[];
  className?: string;
  inputClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, index]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Qidirish..."
        aria-label="Platformada qidirish"
        className={inputClassName}
      />

      {open && query.trim() ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-foreground-muted">Hech narsa topilmadi</p>
          ) : (
            results.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="truncate text-foreground">{item.label}</span>
                <span className="shrink-0 text-xs text-foreground-muted">{item.category}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
