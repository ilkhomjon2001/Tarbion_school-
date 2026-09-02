"use client";

/**
 * Dars rejasi — metodik baza (hozircha Robototexnika).
 *
 * Koʻrinish akademiya bazasi bilan bir xil: chapda yil/sinf, asosiy
 * qismda choraklar boʻyicha KARTOCHKALAR toʻri — har kartada model
 * rasmi (instruksiyaning 1-qadami), tur belgisi, model nomi va qadam
 * soni. Kartochka bosilganda toʻliq dars kartasi modal oynada ochiladi.
 *
 * Kontent statik JSON + webp thumbnaillar (lib/teacher/reja.ts) —
 * sinf bitta soʻrov, rasmlar lazy, hammasi keshda qoladi.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  TYPE_META,
  fetchRejaIndex,
  fetchSinfReja,
  rasmUrl,
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
  const [qidiruv, setQidiruv] = useState("");
  const [xato, setXato] = useState(false);

  // Modal: tanlangan dars + fokusni qaytarish uchun trigger elementi.
  const [tanlangan, setTanlangan] = useState<{ dars: Dars; raqam: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

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
    setQidiruv("");
    fetchSinfReja(yil, sinf)
      .then((r) => alive && setReja(r))
      .catch(() => alive && setXato(true));
    return () => {
      alive = false;
    };
  }, [yil, sinf]);

  const sinflar = useMemo(() => Object.keys(index?.yillar[yil] ?? {}), [index, yil]);
  const stat = index?.yillar[yil]?.[sinf];

  function ochish(dars: Dars, raqam: number, el: HTMLElement) {
    triggerRef.current = el;
    setTanlangan({ dars, raqam });
  }
  function yopish() {
    setTanlangan(null);
    triggerRef.current?.focus();
  }

  return (
    <TeacherShell title="Dars rejasi" subtitle="Robototexnika — metodik baza">
      {xato ? (
        <ErrorState description="Dars rejasini olib boʻlmadi. Sahifani yangilab koʻring." />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* ── Chap panel: yil + sinflar ── */}
          <aside className="shrink-0 lg:sticky lg:top-20 lg:w-48">
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
              {index === null && <ListSkeleton count={6} />}
            </nav>
          </aside>

          {/* ── Asosiy qism ── */}
          <div className="min-w-0 flex-1">
            {/* Sarlavha kartasi — akademiya bazasidagi kabi jamlanma */}
            <header className="rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Robototexnika · {yil}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-foreground">
                {sinf} — yillik reja
              </h2>
              {stat && (
                <p className="mt-1 text-sm text-foreground-muted">
                  {reja?.choraklar.length ?? 4} chorak, {stat.darslar} dars
                  {stat.modellar > 0 && <>, {stat.modellar} ta model</>}
                  {stat.rasmli > 0 && <>, {stat.rasmli} darsda rasmli instruksiya</>}
                  . Darsni ochish uchun kartochkani bosing.
                </p>
              )}
            </header>

            <div className="mt-3">
              <input
                type="search"
                value={qidiruv}
                onChange={(e) => setQidiruv(e.target.value)}
                placeholder="Mavzu yoki model boʻyicha qidirish"
                aria-label="Mavzu qidirish"
                className="h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 sm:max-w-md"
              />
            </div>

            {reja === null ? (
              <div className="mt-4">
                <ListSkeleton count={8} />
              </div>
            ) : (
              <ChorakBoliklari reja={reja} qidiruv={qidiruv} onOchish={ochish} />
            )}
          </div>
        </div>
      )}

      {tanlangan && (
        <DarsModal dars={tanlangan.dars} raqam={tanlangan.raqam} onClose={yopish} />
      )}
    </TeacherShell>
  );
}

// ─────────────────────── Choraklar va kartochkalar ───────────────────────

function ChorakBoliklari({
  reja,
  qidiruv,
  onOchish,
}: {
  reja: SinfReja;
  qidiruv: string;
  onOchish: (dars: Dars, raqam: number, el: HTMLElement) => void;
}) {
  const soz = qidiruv.trim().toLowerCase();
  const bloklar = reja.choraklar
    .map((c, ci) => {
      const boshi = reja.choraklar
        .slice(0, ci)
        .reduce((a, x) => a + x.darslar.length, 0);
      const rows = c.darslar
        .map((d, di) => ({ dars: d, raqam: boshi + di + 1 }))
        .filter(
          (r) =>
            soz === "" ||
            r.dars.title.toLowerCase().includes(soz) ||
            (r.dars.model ?? "").toLowerCase().includes(soz),
        );
      return { nom: c.nom, jami: c.darslar.length, rows };
    })
    .filter((b) => b.rows.length > 0);

  if (bloklar.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Hech narsa topilmadi"
          description={`«${qidiruv}» boʻyicha mavzu yoʻq. Boshqa soʻz bilan qidirib koʻring.`}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      {bloklar.map((b) => (
        <section key={b.nom} aria-label={b.nom}>
          <h3 className="mb-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground">{b.nom}</span>
            <span className="num text-xs font-medium text-foreground-muted">
              {soz === "" ? `${b.jami} dars` : `${b.rows.length} ta topildi`}
            </span>
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {b.rows.map((r) => (
              <li key={r.raqam}>
                <DarsKarta
                  dars={r.dars}
                  raqam={r.raqam}
                  onOchish={(el) => onOchish(r.dars, r.raqam, el)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DarsKarta({
  dars,
  raqam,
  onOchish,
}: {
  dars: Dars;
  raqam: number;
  onOchish: (el: HTMLElement) => void;
}) {
  const tur = TYPE_META[dars.type] ?? {
    label: dars.type,
    cls: "bg-surface-muted text-foreground-muted",
  };
  const [sarlavha] = dars.title.split(" — ");
  const nazoratmi = dars.type === "nazorat" || dars.type === "loyiha";

  return (
    <button
      type="button"
      onClick={(e) => onOchish(e.currentTarget)}
      className={`focus-ring group flex h-full w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-shadow hover:shadow-md ${
        nazoratmi
          ? "border-warning/40 bg-warning-tint/30"
          : "border-border bg-surface"
      }`}
    >
      {/* Rasm maydoni — instruksiyaning 1-qadami; rasmsizda tur belgisi */}
      <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border/60 bg-surface">
        {dars.slug ? (
          // eslint-disable-next-line @next/next/no-img-element -- lokal webp, o'lchami kichik, next/image keragi yo'q
          <img
            src={rasmUrl(dars.slug)}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${tur.cls}`}
          >
            {tur.label}
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="flex items-center gap-1.5">
          <span className="num text-xs font-semibold text-foreground-muted">{raqam}</span>
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${tur.cls}`}
          >
            {tur.label}
          </span>
        </span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
          {sarlavha}
        </span>
        {dars.model && (
          <span className="truncate text-[11px] text-foreground-muted">
            › {dars.model}
          </span>
        )}
        {dars.qadam != null && (
          <span className="num text-[11px] text-foreground-muted">
            ▤ {dars.qadam} qadam
          </span>
        )}
      </span>
    </button>
  );
}

// ─────────────────────────── Dars modali ───────────────────────────

function DarsModal({
  dars,
  raqam,
  onClose,
}: {
  dars: Dars;
  raqam: number;
  onClose: () => void;
}) {
  const yopishRef = useRef<HTMLButtonElement>(null);
  const [sarlavha, ...tafsilotQismi] = dars.title.split(" — ");
  const tafsilot = tafsilotQismi.join(" — ") || null;

  // Ochilganda fokus modal ichiga, Esc yopadi, fon skroll qilinmaydi.
  useEffect(() => {
    yopishRef.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = oldOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dars-modal-title"
    >
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl sm:rounded-2xl">
        <header className="flex items-start gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          {dars.slug && (
            // eslint-disable-next-line @next/next/no-img-element -- lokal webp thumbnail
            <img
              src={rasmUrl(dars.slug)}
              alt=""
              className="hidden h-14 w-16 shrink-0 rounded-lg border border-border bg-surface object-contain p-1 sm:block"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="num text-xs font-semibold text-foreground-muted">
              {raqam}-dars{dars.model ? ` · ${dars.model}` : ""}
              {dars.qadam != null ? ` · instruksiya ${dars.qadam} qadam` : ""}
            </p>
            <h2
              id="dars-modal-title"
              className="text-base font-bold leading-snug text-foreground"
            >
              {sarlavha}
            </h2>
            {tafsilot && (
              <p className="mt-0.5 text-xs text-foreground-muted">{tafsilot}</p>
            )}
          </div>
          <button
            ref={yopishRef}
            type="button"
            onClick={onClose}
            className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <span className="sr-only">Yopish</span>
            <svg
              aria-hidden
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto">
          <DarsTafsilot dars={dars} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Dars tafsiloti (kontent) ───────────────────────

function DarsTafsilot({ dars }: { dars: Dars }) {
  const meta = dars.meta;
  return (
    <div className="px-4 py-4 sm:px-6">
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
            <pre className="scroll-x rounded-lg bg-foreground px-4 py-3 font-mono text-xs leading-relaxed text-surface">
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
          <Bolim
            title={`Baholash mezoni${dars.mezon.nom ? ` — ${dars.mezon.nom}` : ""}`}
          >
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
