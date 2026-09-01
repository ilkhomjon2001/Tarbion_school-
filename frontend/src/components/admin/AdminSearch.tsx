"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { fetchStudents } from "@/lib/school/api";

interface Hit {
  id: string;
  label: string;
  category: string;
  href: string;
}

/**
 * Admin qidiruvi — BAZADAN (`school/students?q=`).
 *
 * Kesim serverda: qidiruv soʻrovi API ga ketadi, u esa faqat huquq
 * doirasidagi oʻquvchilarni qaytaradi (X-1). Soʻrov 300 ms
 * kechiktiriladi — har bosilgan harfga alohida soʻrov ketmasin.
 */
export function AdminSearch({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const timer = setTimeout(() => {
      fetchStudents({ query: q })
        .then((rows) => {
          if (!alive) return;
          setHits(
            rows.slice(0, 8).map((s) => ({
              id: s.id,
              label: `${s.full_name}${s.class_name ? ` · ${s.class_name}` : ""}`,
              category: s.is_archived ? "Arxivda" : "Oʻquvchi",
              href: `/admin/oquvchilar?q=${encodeURIComponent(s.full_name)}`,
            })),
          );
        })
        .catch(() => {
          if (alive) setHits([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <SearchIcon
        className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted ${
          compact ? "left-2.5" : "left-3"
        }`}
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Oʻquvchini qidirish…"
        aria-label="Oʻquvchini qidirish"
        className={`w-full min-w-0 rounded-lg border border-border bg-surface-muted text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 ${
          compact ? "py-1.5 pl-8 pr-2" : "py-2 pl-9 pr-3"
        }`}
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-foreground-muted">Qidirilmoqda…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-2 text-sm text-foreground-muted">Hech narsa topilmadi</p>
          ) : (
            hits.map((hit) => (
              <Link
                key={hit.id}
                href={hit.href}
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="truncate text-foreground">{hit.label}</span>
                <span className="shrink-0 text-xs text-foreground-muted">{hit.category}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
