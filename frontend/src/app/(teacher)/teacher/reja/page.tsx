"use client";

/**
 * Dars rejasi — metodik baza (hozircha Robototexnika).
 *
 * Chapda: oʻquv yili (1-yil / 2-yil) va sinflar roʻyxati. Asosiy
 * qismda: choraklar boʻyicha ketma-ket mavzular; mavzu bosilganda
 * dars kartasi ochiladi — maqsad, lugʻat, nazariya, amaliy qism,
 * kod, baholash mezoni va uyga vazifa.
 *
 * Kontent statik JSON (lib/teacher/reja.ts) — bitta sinf bitta soʻrov,
 * brauzer keshida qoladi.
 */

import { useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  TYPE_META,
  fetchRejaIndex,
  fetchSinfReja,
  type Dars,
  type RejaIndex,
  type SinfReja,
} from "@/lib/teacher/reja";

const YILLAR = ["1-yil", "2-yil"] as const;

export default function RejaPage() {
  const [index, setIndex] = useState<RejaIndex | null>(null);
  const [yil, setYil] = useState<string>("1-yil");
  const [sinf, setSinf] = useState<string>("");
  const [reja, setReja] = useState<SinfReja | null>(null);
  const [ochiq, setOchiq] = useState<string | null>(null);
  const [xato, setXato] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchRejaIndex()
      .then((i) => {
        if (!alive) return;
        setIndex(i);
        const birinchi = Object.keys(i.yillar["1-yil"] ?? {})[0];
        if (birinchi) setSinf(birinchi);
      })
      .catch(() => alive && setXato(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!sinf) return;
    let alive = true;
    setReja(null);
    setOchiq(null);
    fetchSinfReja(yil, sinf)
      .then((r) => alive && setReja(r))
      .catch(() => alive && setXato(true));
    return () => {
      alive = false;
    };
  }, [yil, sinf]);

  const sinflar = useMemo(
    () => Object.keys(index?.yillar[yil] ?? {}),
    [index, yil],
  );

  return (
    <TeacherShell title="Dars rejasi" subtitle="Robototexnika — metodik baza">
      {xato ? (
        <ErrorState description="Dars rejasini olib boʻlmadi. Sahifani yangilab koʻring." />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* ── Chap panel: yil + sinflar ── */}
          <aside className="shrink-0 lg:w-56 lg:sticky lg:top-4">
            <div
              role="tablist"
              aria-label="Oʻquv yili"
              className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1"
            >
              {YILLAR.map((y) => (
                <button
                  key={y}
                  type="button"
                  role="tab"
                  aria-selected={yil === y}
                  onClick={() => setYil(y)}
                  className={`focus-ring h-9 rounded-lg text-sm font-semibold transition-colors ${
                    yil === y
                      ? "bg-surface text-brand-dark shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            <nav aria-label="Sinflar" className="mt-3">
              {/* Mobilda gorizontal chiplar, desktopda vertikal roʻyxat */}
              <ul className="scroll-x flex gap-1.5 lg:flex-col lg:gap-1">
                {(sinflar.length > 0 ? sinflar : index === null ? [] : []).map(
                  (s) => {
                    const faol = s === sinf;
                    return (
                      <li key={s} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setSinf(s)}
                          aria-current={faol ? "true" : undefined}
                          className={`focus-ring flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            faol
                              ? "border-brand bg-brand-tint text-brand-dark"
                              : "border-transparent text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                          }`}
                        >
                          {s}
                          <span className="num text-xs opacity-60">
                            {index?.yillar[yil]?.[s]}
                          </span>
                        </button>
                      </li>
                    );
                  },
                )}
              </ul>
              {index === null && <ListSkeleton count={6} />}
            </nav>
          </aside>

          {/* ── Asosiy: mavzular ketma-ketligi ── */}
          <div className="min-w-0 flex-1">
            {reja === null ? (
              <ListSkeleton count={8} />
            ) : reja.choraklar.length === 0 ? (
              <EmptyState
                title="Reja topilmadi"
                description="Bu sinf uchun dars rejasi hali kiritilmagan."
              />
            ) : (
              <div className="flex flex-col gap-5">
                {reja.choraklar.map((chorak, ci) => {
                  let raqam = reja.choraklar
                    .slice(0, ci)
                    .reduce((a, c) => a + c.darslar.length, 0);
                  return (
                    <section key={chorak.nom}>
                      <h2 className="mb-2 flex items-baseline gap-2 text-sm font-bold uppercase tracking-wide text-foreground-muted">
                        {chorak.nom}
                        <span className="num text-xs font-medium normal-case tracking-normal">
                          {chorak.darslar.length} dars
                        </span>
                      </h2>
                      <ol className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                        {chorak.darslar.map((dars, di) => {
                          raqam += 1;
                          const id = `${chorak.nom}-${di}`;
                          return (
                            <DarsQator
                              key={id}
                              raqam={raqam}
                              dars={dars}
                              ochiq={ochiq === id}
                              onToggle={() =>
                                setOchiq((prev) => (prev === id ? null : id))
                              }
                            />
                          );
                        })}
                      </ol>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </TeacherShell>
  );
}

// ─────────────────────────── Bitta dars ───────────────────────────

function DarsQator({
  raqam,
  dars,
  ochiq,
  onToggle,
}: {
  raqam: number;
  dars: Dars;
  ochiq: boolean;
  onToggle: () => void;
}) {
  const tur = TYPE_META[dars.type] ?? {
    label: dars.type,
    cls: "bg-surface-muted text-foreground-muted",
  };

  return (
    <li className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ochiq}
        className={`focus-ring flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors sm:px-4 ${
          ochiq ? "bg-brand-tint/40" : "hover:bg-surface-muted/60"
        }`}
      >
        <span className="num w-7 shrink-0 text-right text-sm font-semibold text-foreground-muted">
          {raqam}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {dars.title}
          </span>
          {dars.model && (
            <span className="block truncate text-xs text-foreground-muted">
              Model: {dars.model}
            </span>
          )}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tur.cls}`}
        >
          {tur.label}
        </span>
        <ChevronIcon ochiq={ochiq} />
      </button>

      {ochiq && <DarsTafsilot dars={dars} />}
    </li>
  );
}

function DarsTafsilot({ dars }: { dars: Dars }) {
  const meta = dars.meta;
  return (
    <div className="animate-expand border-t border-border/60 bg-surface-muted/30 px-4 py-4 sm:px-6">
      {meta && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[meta.modul, meta.chorak, meta.jihoz, meta.davomiyligi]
            .filter(Boolean)
            .map((m) => (
              <span
                key={m}
                className="rounded-full bg-surface px-2.5 py-1 text-xs text-foreground-muted ring-1 ring-border"
              >
                {m}
              </span>
            ))}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {dars.maqsad && dars.maqsad.length > 0 && (
          <Bolim title="Dars maqsadi">
            <Royxat items={dars.maqsad} belgi="✓" />
          </Bolim>
        )}

        {dars.lugat && dars.lugat.length > 0 && (
          <Bolim title="Lugʻat">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {dars.lugat.map((l) => (
                <li
                  key={l}
                  className="rounded-lg bg-surface px-3 py-1.5 text-sm text-foreground ring-1 ring-border/60"
                >
                  {l}
                </li>
              ))}
            </ul>
          </Bolim>
        )}

        {dars.nazariya && dars.nazariya.length > 0 && (
          <Bolim title="Nazariy qism">
            <Bosqichlar bloklar={dars.nazariya} />
          </Bolim>
        )}

        {dars.amaliy && dars.amaliy.length > 0 && (
          <Bolim title="Amaliy qism">
            <Bosqichlar bloklar={dars.amaliy} />
          </Bolim>
        )}

        {dars.ulanish && dars.ulanish.length > 0 && (
          <Bolim title="Komponentlar va ulanish">
            {dars.ulanish.map((u) => (
              <div key={u.nom} className="mb-2 last:mb-0">
                <p className="text-sm font-semibold text-foreground">{u.nom}</p>
                <Royxat items={u.tasnif} belgi="•" />
              </div>
            ))}
          </Bolim>
        )}

        {dars.kod && (
          <Bolim title={`Kod — ${dars.kod.nom}`}>
            <p className="mb-2 text-sm text-foreground-muted">{dars.kod.izoh}</p>
            <pre className="scroll-x rounded-lg bg-foreground px-4 py-3 font-mono text-xs leading-relaxed text-background">
              {dars.kod.matn}
            </pre>
          </Bolim>
        )}

        {dars.topshiriq && (
          <Bolim
            title={
              dars.topshiriq.sarlavha
                ? `Topshiriq — ${dars.topshiriq.sarlavha}`
                : "Topshiriq"
            }
          >
            {dars.topshiriq.missiyaNomi && (
              <p className="mb-1.5 text-sm text-foreground-muted">
                Missiya {dars.topshiriq.missiya}: {dars.topshiriq.missiyaNomi}
                {dars.topshiriq.kod ? ` · ${dars.topshiriq.kod}` : ""}
              </p>
            )}
            {Array.isArray(dars.topshiriq.talablar) && (
              <Royxat items={dars.topshiriq.talablar} belgi="→" />
            )}
          </Bolim>
        )}

        {dars.mezon && (
          <Bolim title={`Baholash mezoni${dars.mezon.nom ? ` — ${dars.mezon.nom}` : ""}`}>
            <div className="scroll-x overflow-hidden rounded-lg ring-1 ring-border">
              <table className="w-full min-w-[380px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    {dars.mezon.ustunlar.map((u) => (
                      <th key={u} className="px-3 py-2">
                        {u}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dars.mezon.qatorlar.map((q, i) => (
                    <tr key={i} className="border-t border-border/60 bg-surface">
                      {q.map((x, j) => (
                        <td
                          key={j}
                          className={`px-3 py-2 ${j === 0 ? "num font-semibold text-foreground" : "text-foreground-muted"}`}
                        >
                          {x}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bolim>
        )}

        {dars.softSkill && (
          <Bolim title="Soft skill">
            <p className="text-sm text-foreground">{dars.softSkill}</p>
          </Bolim>
        )}

        {dars.resurslar && dars.resurslar.length > 0 && (
          <Bolim title="Kerakli resurslar">
            <Royxat items={dars.resurslar} belgi="•" />
          </Bolim>
        )}

        {dars.qollanma && (
          <p className="rounded-lg bg-warning-tint/50 px-3 py-2 text-sm text-foreground">
            💡 {dars.qollanma.matn}
          </p>
        )}

        {dars.uyga && dars.uyga.length > 0 && (
          <Bolim title="Uyga vazifa">
            <Royxat items={dars.uyga} belgi="✎" />
          </Bolim>
        )}
      </div>
    </div>
  );
}

function Bolim({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-brand-dark">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Royxat({ items, belgi }: { items: string[]; belgi: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-sm text-foreground">
          <span aria-hidden className="shrink-0 text-brand-dark">
            {belgi}
          </span>
          {x}
        </li>
      ))}
    </ul>
  );
}

function Bosqichlar({ bloklar }: { bloklar: { title: string; points: string[] }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {bloklar.map((b) => (
        <div key={b.title}>
          <p className="text-sm font-semibold text-foreground">{b.title}</p>
          <ul className="mt-1 flex flex-col gap-1 border-l-2 border-brand/30 pl-3">
            {b.points.map((pt, i) => (
              <li key={i} className="text-sm text-foreground-muted">
                {pt}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ChevronIcon({ ochiq }: { ochiq: boolean }) {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-foreground-muted transition-transform ${ochiq ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
