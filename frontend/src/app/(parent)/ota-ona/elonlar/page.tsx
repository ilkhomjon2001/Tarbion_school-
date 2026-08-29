"use client";

import { useEffect, useMemo, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import {
  getReadIds,
  markRead,
  newsForClass,
  NEWS_KIND_LABELS,
  NEWS_KIND_TONE,
  type NewsItem,
  type NewsKind,
} from "@/lib/parent/news";
import { useChild } from "@/lib/parent/useChild";

/**
 * Eʼlonlar va tadbirlar taqvimi (OTA-08).
 *
 * Toʻrt xil xabar bir joyda, lekin turi boʻyicha ajratilgan — ota-ona
 * "majlis qachon edi?" deb butun roʻyxatni titkilamasin.
 *
 * Tadbir va musobaqada "qachon, qayerda" alohida ajratib koʻrsatiladi,
 * chunki ota-ona uchun aynan shu maʼlumot kerak. Muddati oʻtganlari
 * sustlashtiriladi.
 */

type Filter = "all" | NewsKind;

const TODAY = "2026-08-29";

export default function ParentNewsPage() {
  const [child, setChild] = useChild();
  const [filter, setFilter] = useState<Filter>("all");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(() => newsForClass(child.className), [child.className]);

  useEffect(() => {
    setRead(new Set(getReadIds()));
  }, []);

  // Sahifa ochilganda hammasi oʻqilgan deb belgilanadi — ota-ona bu
  // yerga aynan shu roʻyxatni koʻrish uchun kiradi.
  useEffect(() => {
    const t = setTimeout(() => markRead(items.map((n) => n.id)), 1200);
    return () => clearTimeout(t);
  }, [items]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: items.length,
      news: 0,
      teacher: 0,
      contest: 0,
      event: 0,
    };
    for (const n of items) base[n.kind] += 1;
    return base;
  }, [items]);

  const visible = filter === "all" ? items : items.filter((n) => n.kind === filter);

  /** Yaqinlashayotgan tadbirlar — sana boʻyicha. */
  const upcoming = useMemo(
    () =>
      items
        .filter((n) => n.eventDate && n.eventDate >= TODAY)
        .sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1))
        .slice(0, 3),
    [items],
  );

  return (
    <ParentShell title="Eʼlonlar" child={child} onChildChange={setChild}>
      {/* Yaqinlashayotgan tadbirlar — taqvim (OTA-08) */}
      {upcoming.length > 0 && filter === "all" && (
        <section className="mb-5">
          <h2 className="mb-2.5 text-sm font-semibold">Yaqin kunlarda</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5"
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-tint text-brand-dark"
                >
                  <span className="text-lg font-bold leading-none">
                    {Number(n.eventDate!.slice(8))}
                  </span>
                  <span className="text-[10px] uppercase leading-none">
                    {MONTHS[Number(n.eventDate!.slice(5, 7)) - 1]}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug">{n.title}</span>
                  <span className="mt-0.5 block text-xs text-foreground-muted">
                    {n.eventTime && `${n.eventTime} · `}
                    {n.place}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Turi boʻyicha filtr */}
      <div
        role="tablist"
        aria-label="Xabar turi"
        className="mb-4 flex flex-wrap gap-2"
      >
        {(
          [
            ["all", "Hammasi"],
            ["teacher", NEWS_KIND_LABELS.teacher],
            ["event", NEWS_KIND_LABELS.event],
            ["contest", NEWS_KIND_LABELS.contest],
            ["news", NEWS_KIND_LABELS.news],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === key
                ? "border-brand bg-brand-tint text-brand-dark"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {label}
            <span className="rounded-full bg-surface-muted px-1.5 text-xs">
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="font-medium">Bu boʻlimda xabar yoʻq</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((n) => (
            <NewsCard
              key={n.id}
              item={n}
              isNew={!read.has(n.id)}
              expanded={open === n.id}
              onToggle={() => setOpen(open === n.id ? null : n.id)}
            />
          ))}
        </ul>
      )}
    </ParentShell>
  );
}

const MONTHS = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avg", "sen", "okt", "noy", "dek",
];

function NewsCard({
  item,
  isNew,
  expanded,
  onToggle,
}: {
  item: NewsItem;
  isNew: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const past = item.eventDate ? item.eventDate < TODAY : false;
  const deadlinePassed = item.deadline ? item.deadline < TODAY : false;

  return (
    <li
      className={`rounded-xl border bg-surface p-4 ${
        item.important ? "border-warning/40" : "border-border"
      } ${past ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${NEWS_KIND_TONE[item.kind]}`}
          >
            {NEWS_KIND_LABELS[item.kind]}
          </span>
          {item.className && (
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-foreground-muted">
              {item.className}
            </span>
          )}
          {item.important && (
            <span className="rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-medium text-warning">
              Muhim
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
              Yangi
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-foreground-muted">{item.createdAt}</span>
      </div>

      <p className="mt-2 font-medium">{item.title}</p>

      {/* Tadbir maʼlumoti — ota-onaga eng kerakli qism, ajratib beriladi */}
      {(item.eventDate || item.deadline) && (
        <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg bg-surface-muted/60 px-3 py-2 text-sm">
          {item.eventDate && (
            <div className="flex items-center gap-1.5">
              <dt className="text-foreground-muted">Qachon:</dt>
              <dd className="font-medium">
                {item.eventDate}
                {item.eventTime && `, ${item.eventTime}`}
                {past && <span className="ml-1 text-foreground-muted">(oʻtgan)</span>}
              </dd>
            </div>
          )}
          {item.place && (
            <div className="flex items-center gap-1.5">
              <dt className="text-foreground-muted">Qayerda:</dt>
              <dd className="font-medium">{item.place}</dd>
            </div>
          )}
          {item.deadline && (
            <div className="flex items-center gap-1.5">
              <dt className="text-foreground-muted">Roʻyxat muddati:</dt>
              <dd className={`font-medium ${deadlinePassed ? "text-danger" : "text-warning"}`}>
                {item.deadline}
                {deadlinePassed && " (tugagan)"}
              </dd>
            </div>
          )}
        </dl>
      )}

      <p className={`mt-2 text-sm text-foreground-muted ${expanded ? "" : "line-clamp-2"}`}>
        {item.body}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="text-xs text-foreground-muted">{item.from}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {expanded ? "Yigʻish" : "Toʻliq oʻqish"}
        </button>
      </div>
    </li>
  );
}
