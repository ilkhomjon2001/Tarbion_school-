"use client";

/**
 * Dars rejasi — metodik baza (ustoz kabineti).
 *
 * Fanlar ikki manbadan: Robototexnika (statik baza, rasmli
 * instruksiyalar bilan) + oʻquv boʻlimi JORIY qilgan rejalar (server).
 * Koʻrinish umumiy `CurriculumView` — oʻquv boʻlimi bilan bir xil.
 */

import { useEffect, useMemo, useState } from "react";

import { CurriculumSearch } from "@/components/shared/CurriculumSearch";
import { CurriculumView } from "@/components/shared/CurriculumView";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  fetchPublishedCatalog,
  fetchPublishedPlan,
  fetchRejaIndex,
  fetchSinfReja,
  type PublishedCatalog,
  type RejaIndex,
  type SinfReja,
} from "@/lib/curriculum/data";

const ROBO = "Robototexnika";

export default function RejaPage() {
  const [index, setIndex] = useState<RejaIndex | null>(null);
  const [katalog, setKatalog] = useState<PublishedCatalog>({});
  const [fan, setFan] = useState(ROBO);
  const [yil, setYil] = useState("1-yil");
  const [sinf, setSinf] = useState("");
  const [reja, setReja] = useState<SinfReja | null>(null);
  const [xato, setXato] = useState(false);

  // Fanlar roʻyxati: statik Robototexnika + serverdagi joriy rejalar.
  const fanlar = useMemo(() => {
    const dbFanlar = Object.keys(katalog).filter((f) => f !== ROBO);
    return [ROBO, ...dbFanlar.sort()];
  }, [katalog]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchRejaIndex(), fetchPublishedCatalog()]).then(
      ([i, k]) => {
        if (!alive) return;
        if (i.status === "fulfilled") setIndex(i.value);
        if (k.status === "fulfilled") setKatalog(k.value);
        if (i.status === "rejected" && k.status === "rejected") setXato(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  /** Tanlangan fan uchun yil → sinf → dars soni tuzilmasi. */
  const tuzilma = useMemo(() => {
    if (fan === ROBO) {
      const out: Record<string, Record<string, number>> = {};
      for (const [y, ss] of Object.entries(index?.yillar ?? {})) {
        out[y] = Object.fromEntries(
          Object.entries(ss).map(([s, st]) => [s, st.darslar]),
        );
      }
      return out;
    }
    return katalog[fan] ?? {};
  }, [fan, index, katalog]);

  const yillar = useMemo(() => Object.keys(tuzilma), [tuzilma]);
  const sinflar = useMemo(() => Object.keys(tuzilma[yil] ?? {}), [tuzilma, yil]);

  // Fan almashganda yaroqli yil/sinfga tushamiz.
  useEffect(() => {
    if (yillar.length > 0 && !yillar.includes(yil)) setYil(yillar[0]);
  }, [yillar, yil]);
  useEffect(() => {
    if (sinflar.length > 0 && !sinflar.includes(sinf)) setSinf(sinflar[0]);
  }, [sinflar, sinf]);

  useEffect(() => {
    if (!sinf || !sinflar.includes(sinf)) return;
    let alive = true;
    setReja(null);
    const yukla =
      fan === ROBO
        ? fetchSinfReja(yil, sinf)
        : fetchPublishedPlan(fan, yil, sinf);
    yukla
      .then((r) => alive && setReja(r))
      .catch(() => alive && setXato(true));
    return () => {
      alive = false;
    };
  }, [fan, yil, sinf, sinflar]);

  const stat = fan === ROBO ? index?.yillar[yil]?.[sinf] : null;
  const jamiDars =
    fan === ROBO ? stat?.darslar : (katalog[fan]?.[yil]?.[sinf] ?? 0);

  return (
    <TeacherShell title="Dars rejasi" subtitle="Metodik baza">
      {xato ? (
        <ErrorState description="Dars rejasini olib boʻlmadi. Sahifani yangilab koʻring." />
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            MET-05: qidiruv butun bazani kesib oʻtadi — fan/sinf
            tanlashdan oldin turadi, chunki «qaysi darsda multimetr
            kerak?» degan savolda ustoz fanni ham bilmaydi.
          */}
          <section className="rounded-xl border border-border bg-surface p-3">
            <CurriculumSearch
              onOpen={(hit) => {
                setFan(hit.fan);
                setYil(hit.yil);
                setSinf(hit.sinf);
              }}
            />
          </section>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* ── Chap panel: fan + yil + sinflar ── */}
          <aside className="shrink-0 lg:sticky lg:top-20 lg:w-52">
            {fanlar.length > 1 && (
              <label className="mb-3 block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Fan
                </span>
                <select
                  value={fan}
                  onChange={(e) => setFan(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                >
                  {fanlar.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div
              role="tablist"
              aria-label="Oʻquv yili"
              className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1"
            >
              {(yillar.length > 0 ? yillar : ["1-yil", "2-yil"]).map((y) => (
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
              <ul className="scroll-x flex gap-1.5 lg:flex-col lg:gap-1">
                {sinflar.map((s) => {
                  const faol = s === sinf;
                  return (
                    <li key={s} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setSinf(s)}
                        aria-current={faol ? "true" : undefined}
                        className={`focus-ring flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          faol
                            ? "border-brand bg-brand-tint text-brand-dark"
                            : "border-transparent text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {index === null && sinflar.length === 0 && <ListSkeleton count={6} />}
            </nav>
          </aside>

          {/* ── Asosiy qism ── */}
          <div className="min-w-0 flex-1">
            <header className="mb-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                {fan} · {yil}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-foreground">
                {sinf} — yillik reja
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {reja?.choraklar.length ?? 4} chorak
                {jamiDars ? <>, {jamiDars} dars</> : null}
                {stat && stat.modellar > 0 && <>, {stat.modellar} ta model</>}
                {stat && stat.rasmli > 0 && (
                  <>, {stat.rasmli} darsda rasmli instruksiya</>
                )}
                . Darsni ochish uchun kartochkani bosing.
              </p>
            </header>

            {reja === null ? (
              <ListSkeleton count={8} />
            ) : (
              <CurriculumView reja={reja} />
            )}
          </div>
        </div>
        </div>
      )}
    </TeacherShell>
  );
}
