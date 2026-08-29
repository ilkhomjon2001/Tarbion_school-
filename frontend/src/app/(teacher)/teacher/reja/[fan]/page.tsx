"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { planFor } from "@/lib/teacher/plan";
import type { PlanCard } from "@/lib/teacher/plan-data";
import { buildLessons, TODAY } from "@/lib/teacher/schedule";
import { CLASS_PROGRAM_YEAR } from "@/lib/teacher/terms";

/**
 * Dars rejalar bazasi — yil → sinf → chorak → dars.
 *
 * Ustozning kundalik ehtiyoji "bugun nima oʻtaman?" — shuning uchun
 * bazaning oʻzidan OLDIN yuqorida bugungi darslar turadi, bir bosishda
 * ochiladi. Butun daraxtni titkilash faqat kerak boʻlganda.
 */

interface RawLesson {
  t: string;
  m: string | null;
  y: string | null;
}
type Tree = Record<string, Record<string, Record<string, RawLesson[]>>>;

function cardFileName(yil: string, sinf: string, chorak: string): string {
  const safe = chorak.replace(/ /g, "_").replace(/[()]/g, "");
  return `${yil}__${sinf}__${safe}.json`;
}

export default function PlanBrowserPage() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [year, setYear] = useState("2-yil");
  const [openClass, setOpenClass] = useState<string | null>("7-sinf");
  const [openTerm, setOpenTerm] = useState<string | null>("1-chorak");
  const [selected, setSelected] = useState<{ sinf: string; chorak: string; i: number } | null>(null);
  const [cards, setCards] = useState<Record<string, PlanCard>>({});
  const [loadingCard, setLoadingCard] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/reja/daraxt.json")
      .then((r) => r.json())
      .then(setTree)
      .catch(() => setTree({}));
  }, []);

  // Kartochkalar chorak boʻyicha, faqat kerak boʻlganda yuklanadi (~76 KB).
  const loadCards = useCallback(
    async (sinf: string, chorak: string) => {
      const key = cardFileName(year, sinf, chorak);
      if (cards[key]) return;
      setLoadingCard(true);
      try {
        const res = await fetch(`/reja/kartochka/${key}`);
        if (res.ok) {
          const data = (await res.json()) as Record<string, PlanCard>;
          setCards((prev) => ({ ...prev, [key]: data as unknown as PlanCard }));
        }
      } catch {
        /* kartochka yoʻq — sarlavha baribir koʻrinadi */
      } finally {
        setLoadingCard(false);
      }
    },
    [cards, year],
  );

  // Bugungi darslar — kundalik yorliq.
  const todayLessons = useMemo(() => {
    const day = new Date(`${TODAY}T00:00:00`);
    return buildLessons(day, day)
      .filter((l) => l.subject === "Robototexnika")
      .map((l) => ({ lesson: l, plan: planFor(l) }))
      .filter((x) => x.plan?.title);
  }, []);

  const classes = tree?.[year] ? Object.keys(tree[year]) : [];

  const selectedCard = useMemo(() => {
    if (!selected) return null;
    const bundle = cards[cardFileName(year, selected.sinf, selected.chorak)] as
      | Record<string, PlanCard>
      | undefined;
    return bundle?.[String(selected.i)] ?? null;
  }, [cards, selected, year]);

  const selectedTitle = useMemo(() => {
    if (!selected || !tree) return null;
    return tree[year]?.[selected.sinf]?.[selected.chorak]?.[selected.i] ?? null;
  }, [selected, tree, year]);

  // Qidiruv — butun yil boʻyicha.
  const results = useMemo(() => {
    if (!tree || query.trim().length < 2) return null;
    const q = query.toLowerCase();
    const out: { sinf: string; chorak: string; i: number; lesson: RawLesson }[] = [];
    for (const [sinf, terms] of Object.entries(tree[year] ?? {})) {
      for (const [chorak, lessons] of Object.entries(terms)) {
        lessons.forEach((l, i) => {
          if (
            l.t.toLowerCase().includes(q) ||
            (l.m ?? "").toLowerCase().includes(q)
          ) {
            out.push({ sinf, chorak, i, lesson: l });
          }
        });
      }
    }
    return out.slice(0, 40);
  }, [query, tree, year]);

  async function select(sinf: string, chorak: string, i: number) {
    setSelected({ sinf, chorak, i });
    await loadCards(sinf, chorak);
  }

  return (
    <TeacherShell
      title="Robototexnika va IT"
      subtitle="Dars rejalar bazasi · 0–8-sinf"
      actions={
        <Link
          href="/teacher/reja"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ← Fanlar
        </Link>
      }
    >
      {/* ═══ Kundalik yorliq: bugun nima oʻtaman ═══ */}
      {todayLessons.length > 0 && (
        <section className="mb-5 rounded-xl border border-brand/30 bg-brand-tint/40 p-4">
          <h2 className="mb-2.5 text-sm font-semibold text-brand-dark">
            Bugungi darslaringiz
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {todayLessons.map(({ lesson, plan }) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => {
                    const sinf = `${lesson.className.split("-")[0]}-sinf`;
                    const yil = `${CLASS_PROGRAM_YEAR[lesson.className] ?? 1}-yil`;
                    setYear(yil);
                    setOpenClass(sinf);
                    setOpenTerm("1-chorak");
                    void select(sinf, "1-chorak", plan!.index);
                  }}
                  className="w-full rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-foreground-muted">
                    <span>
                      {lesson.className} · {lesson.period}-para · {lesson.startTime}
                    </span>
                    <span>{plan!.human}-dars</span>
                  </span>
                  <span className="mt-1 block text-sm font-medium">
                    {plan!.title!.title}
                  </span>
                  {plan!.title!.model && (
                    <span className="mt-0.5 block truncate text-xs text-foreground-muted">
                      {plan!.title!.model}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ Baza brauzeri ═══ */}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* --- Chap panel --- */}
        <aside className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-3">
            <label htmlFor="plan-search" className="sr-only">
              Dars nomi yoki model boʻyicha qidirish
            </label>
            <input
              id="plan-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dars nomi yoki model…"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />

            <div role="tablist" aria-label="Dastur yili" className="mt-2.5 flex gap-2">
              {["1-yil", "2-yil"].map((y) => (
                <button
                  key={y}
                  type="button"
                  role="tab"
                  aria-selected={year === y}
                  onClick={() => {
                    setYear(y);
                    setSelected(null);
                  }}
                  className={`h-9 flex-1 rounded-lg text-sm font-semibold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    year === y
                      ? "bg-brand text-brand-foreground"
                      : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[640px] overflow-y-auto p-2">
            {tree === null ? (
              <p className="px-2 py-4 text-sm text-foreground-muted">Yuklanmoqda…</p>
            ) : results ? (
              <SearchResults results={results} onPick={select} />
            ) : (
              classes.map((sinf) => {
                const terms = tree[year][sinf];
                const total = Object.values(terms).reduce((s, l) => s + l.length, 0);
                const isOpen = openClass === sinf;

                return (
                  <div key={sinf}>
                    <button
                      type="button"
                      onClick={() => setOpenClass(isOpen ? null : sinf)}
                      aria-expanded={isOpen}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        isOpen ? "bg-surface-muted" : "hover:bg-surface-muted/60"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`text-foreground-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                        {sinf.toUpperCase()}
                      </span>
                      <span className="text-xs text-foreground-muted">{total}</span>
                    </button>

                    {isOpen && (
                      <div className="ml-3 border-l border-border pl-2">
                        {Object.entries(terms).map(([chorak, lessons]) => {
                          const termOpen = openTerm === chorak && openClass === sinf;
                          return (
                            <div key={chorak}>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenTerm(termOpen ? null : chorak);
                                  if (!termOpen) void loadCards(sinf, chorak);
                                }}
                                aria-expanded={termOpen}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                              >
                                <span className="text-foreground-muted">{chorak}</span>
                                <span className="text-xs text-foreground-muted">
                                  {lessons.length}
                                </span>
                              </button>

                              {termOpen && (
                                <ol className="mb-1 space-y-0.5">
                                  {lessons.map((l, i) => {
                                    const active =
                                      selected?.sinf === sinf &&
                                      selected?.chorak === chorak &&
                                      selected?.i === i;
                                    return (
                                      <li key={i}>
                                        <button
                                          type="button"
                                          onClick={() => select(sinf, chorak, i)}
                                          className={`flex w-full gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                                            active
                                              ? "bg-brand-tint font-medium text-brand-dark"
                                              : "text-foreground-muted hover:bg-surface-muted/60"
                                          }`}
                                        >
                                          <span className="w-5 shrink-0 tabular-nums">
                                            {i + 1}.
                                          </span>
                                          <span className="min-w-0">{l.t}</span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ol>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* --- Oʻng panel: dars kartochkasi --- */}
        <section className="rounded-xl border border-border bg-surface">
          {!selected ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <span aria-hidden className="text-5xl">🤖</span>
              <p className="mt-4 text-lg font-semibold">Dars tanlang</p>
              <p className="mt-1 max-w-sm text-sm text-foreground-muted">
                Chapdagi roʻyxatdan yil → sinf → chorak → dars boʻyicha tanlang.
                Yoki yuqoridagi bugungi darsingizni bosing.
              </p>
            </div>
          ) : (
            <article className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-foreground-muted">
                    {year} · {selected.sinf} · {selected.chorak} · {selected.i + 1}-dars
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">{selectedTitle?.t}</h2>
                  {selectedTitle?.m && (
                    <p className="mt-1 text-sm text-foreground-muted">
                      Model / amaliyot: {selectedTitle.m}
                    </p>
                  )}
                </div>
                {selectedTitle?.y && (
                  <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
                    {selectedTitle.y}
                  </span>
                )}
              </div>

              {loadingCard ? (
                <p className="py-8 text-sm text-foreground-muted">Kartochka yuklanmoqda…</p>
              ) : selectedCard ? (
                <CardBody card={selectedCard} />
              ) : (
                <p className="py-8 text-sm text-foreground-muted">
                  Bu dars uchun toʻliq kartochka hali tayyorlanmagan.
                </p>
              )}
            </article>
          )}
        </section>
      </div>
    </TeacherShell>
  );
}

function SearchResults({
  results,
  onPick,
}: {
  results: { sinf: string; chorak: string; i: number; lesson: RawLesson }[];
  onPick: (sinf: string, chorak: string, i: number) => void;
}) {
  if (results.length === 0) {
    return <p className="px-2 py-4 text-sm text-foreground-muted">Hech narsa topilmadi.</p>;
  }
  return (
    <ul className="space-y-0.5">
      {results.map((r, k) => (
        <li key={k}>
          <button
            type="button"
            onClick={() => onPick(r.sinf, r.chorak, r.i)}
            className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="block text-[13px] leading-snug">{r.lesson.t}</span>
            <span className="mt-0.5 block text-[11px] text-foreground-muted">
              {r.sinf} · {r.chorak} · {r.i + 1}-dars
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Dars kartochkasi (MET-02). */
function CardBody({ card }: { card: PlanCard }) {
  return (
    <div className="pt-4">
      <div className="grid gap-5 lg:grid-cols-2">
        {card.maqsad && <Block title="Maqsad" items={card.maqsad} />}
        {card.resurslar && <Block title="Kerakli jihozlar" items={card.resurslar} />}
        {card.lugat && <Block title="Lugʻat" items={card.lugat} />}
        {card.softSkill && <Block title="Yumshoq koʻnikma" items={[card.softSkill]} />}
      </div>

      {card.nazariya && <Steps title="Nazariy qism" steps={card.nazariya} />}
      {card.amaliy && <Steps title="Amaliy qism" steps={card.amaliy} />}

      {card.uyga && (
        <Block
          title="Uyga vazifa"
          items={Array.isArray(card.uyga) ? card.uyga : [card.uyga]}
        />
      )}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Steps({
  title,
  steps,
}: {
  title: string;
  steps: { title: string; points: string[] }[];
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i}>
            <p className="text-sm font-medium">{step.title}</p>
            <ul className="mt-1 space-y-1 text-sm text-foreground-muted">
              {step.points.map((p, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
