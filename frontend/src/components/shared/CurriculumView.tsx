"use client";

/**
 * Metodik baza kartochka koʻrinishi — USTOZ va OʻQUV BOʻLIMI uchun umumiy.
 *
 * Bitta sinf rejasini oladi va chorak tablari + qidiruv + rasmli
 * kartochkalar toʻri + modal dars kartasini oʻzi boshqaradi.
 * Maʼlumot manbasi (statik JSON yoki serverdagi joriy reja) — sahifaniki.
 */

import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import {
  TYPE_META,
  rasmUrl,
  type Dars,
  type SinfReja,
} from "@/lib/curriculum/data";

export function CurriculumView({ reja }: { reja: SinfReja }) {
  const [qidiruv, setQidiruv] = useState("");
  const [chorakF, setChorakF] = useState<number | null>(null);
  const [tanlangan, setTanlangan] = useState<{ dars: Dars; raqam: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLElement | null>(null);

  // Sinf/reja almashganda filtrlar tozalanadi.
  useEffect(() => {
    setQidiruv("");
    setChorakF(null);
    setTanlangan(null);
  }, [reja]);

  function ochish(dars: Dars, raqam: number, el: HTMLElement) {
    triggerRef.current = el;
    setTanlangan({ dars, raqam });
  }
  function yopish() {
    setTanlangan(null);
    triggerRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Chorak boʻyicha saralash"
          className="scroll-x flex gap-1 rounded-xl bg-surface-muted p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={chorakF === null}
            onClick={() => setChorakF(null)}
            className={`focus-ring h-9 shrink-0 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
              chorakF === null
                ? "bg-surface text-brand-dark shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Hammasi
          </button>
          {reja.choraklar.map((c, ci) => (
            <button
              key={c.nom}
              type="button"
              role="tab"
              aria-selected={chorakF === ci}
              onClick={() => setChorakF(ci)}
              className={`focus-ring h-9 shrink-0 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                chorakF === ci
                  ? "bg-surface text-brand-dark shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {c.nom}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Mavzu yoki model boʻyicha qidirish"
          aria-label="Mavzu qidirish"
          className="h-10 min-w-[13rem] flex-1 rounded-xl border border-border bg-surface px-3.5 text-base outline-none transition-colors placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 sm:max-w-md sm:text-sm"
        />
      </div>

      <ChorakBoliklari
        reja={reja}
        qidiruv={qidiruv}
        chorakF={chorakF}
        onOchish={ochish}
      />

      {tanlangan && (
        <DarsModal dars={tanlangan.dars} raqam={tanlangan.raqam} onClose={yopish} />
      )}
    </div>
  );
}

// ─────────────────────── Choraklar va kartochkalar ───────────────────────

function ChorakBoliklari({
  reja,
  qidiruv,
  chorakF,
  onOchish,
}: {
  reja: SinfReja;
  qidiruv: string;
  chorakF: number | null;
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
      return { nom: c.nom, indeks: ci, jami: c.darslar.length, rows };
    })
    .filter((b) => (chorakF === null ? true : b.indeks === chorakF))
    .filter((b) => b.rows.length > 0);

  if (bloklar.length === 0) {
    return (
      <EmptyState
        title="Hech narsa topilmadi"
        description={
          soz
            ? `«${qidiruv}» boʻyicha mavzu yoʻq. Boshqa soʻz bilan qidirib koʻring.`
            : "Bu boʻlimda dars yoʻq."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
      className={`focus-ring group flex h-full w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-shadow hover:shadow-md active:shadow-sm ${
        nazoratmi
          ? "border-warning/40 bg-warning-tint/30"
          : "border-border bg-surface"
      }`}
    >
      <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border/60 bg-surface">
        {dars.slug ? (
          // eslint-disable-next-line @next/next/no-img-element -- lokal webp, kichik
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
          <span className="num text-xs font-semibold text-foreground-muted">
            {raqam}
          </span>
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
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-background pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl sm:pb-0">
        <header className="flex items-start gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          {dars.slug && (
            // eslint-disable-next-line @next/next/no-img-element -- lokal webp
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
            className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground sm:size-9"
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

        {/* MET-02: kutilayotgan natija, jihozlar, baholash mezoni. */}
        {dars.natija && (
          <Bolim title="Kutilayotgan natija">
            <p className="text-sm text-foreground">{dars.natija}</p>
          </Bolim>
        )}

        {dars.jihoz && dars.jihoz.length > 0 && (
          <Bolim title="Kerakli jihozlar">
            <Royxat items={dars.jihoz} belgi="🔧" />
          </Bolim>
        )}

        {dars.baholash && dars.baholash.length > 0 && (
          <Bolim title="Baholash mezoni">
            <Royxat items={dars.baholash} belgi="◆" />
          </Bolim>
        )}

        {/*
          MET-04: tashqi video. `rel` majburiy — `noopener` boʻlmasa
          ochilgan sahifa `window.opener` orqali bizni boshqara oladi.
        */}
        {dars.video && (
          <Bolim title="Video">
            <a
              href={dars.video}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-dark underline underline-offset-2"
            >
              Videoni yangi oynada ochish
            </a>
          </Bolim>
        )}

        {/*
          MET-03: ilovalar. Havola SHU YERDA yasalmaydi — u imzolangan
          va 15 daqiqa yashaydi (X-7), shuning uchun bosilganda
          serverdan soʻraladi.
        */}
        {dars.files && dars.files.length > 0 && (
          <Bolim title="Ilovalar">
            <ul className="flex flex-col gap-1.5">
              {dars.files.map((f) => (
                <li key={f.id} className="text-sm text-foreground">
                  📎 {f.name}
                </li>
              ))}
            </ul>
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

function Bosqichlar({
  bloklar,
}: {
  bloklar: { title: string; points: string[] }[];
}) {
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
