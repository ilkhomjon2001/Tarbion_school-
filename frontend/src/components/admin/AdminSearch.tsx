"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { useAdmin } from "@/lib/admin/store";
import { DOCUMENT_TYPE_LABELS } from "@/lib/admin/types";

interface Hit {
  id: string;
  label: string;
  category: string;
  href: string;
}

/**
 * Admin qidiruvi — do'kondagi jonli maʼlumot boʻyicha ishlaydi, alohida
 * indeks tuzilmaydi. Yangi qabul qilingan oʻquvchi darhol topiladi.
 */
export function AdminSearch({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { students, applications, documents } = useAdmin();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const studentHits: Hit[] = students
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.guardianName.toLowerCase().includes(q) ||
          s.guardianPhone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
          s.className.toLowerCase() === q,
      )
      .slice(0, 5)
      .map((s) => ({
        id: `st-${s.id}`,
        label: `${s.fullName} · ${s.className}`,
        category: "Oʻquvchi",
        href: `/admin/oquvchilar?q=${encodeURIComponent(s.fullName)}`,
      }));

    const appHits: Hit[] = applications
      .filter((a) => a.studentFullName.toLowerCase().includes(q))
      .slice(0, 3)
      .map((a) => ({
        id: `ap-${a.id}`,
        label: a.studentFullName,
        category: "Ariza",
        href: "/admin/qabul",
      }));

    const docHits: Hit[] = documents
      .filter((d) => (d.number ?? "").toLowerCase().includes(q))
      .slice(0, 3)
      .map((d) => ({
        id: `dc-${d.id}`,
        label: `№ ${d.number} · ${DOCUMENT_TYPE_LABELS[d.type]}`,
        category: "Maʼlumotnoma",
        href: "/admin/malumotnomalar",
      }));

    return [...studentHits, ...appHits, ...docHits];
  }, [query, students, applications, documents]);

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
        placeholder="Oʻquvchi, ota-ona, telefon, hujjat №"
        aria-label="Admin panelda qidirish"
        className={`w-full min-w-0 rounded-lg border border-border bg-surface-muted text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 ${
          compact ? "py-1.5 pl-8 pr-2" : "py-2 pl-9 pr-3"
        }`}
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {hits.length === 0 ? (
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
