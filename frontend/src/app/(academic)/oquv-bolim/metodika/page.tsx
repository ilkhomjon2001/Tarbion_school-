"use client";

/**
 * Metodik baza boshqaruvi (oʻquv boʻlimi) — reja ishlab chiqish oqimi:
 *
 *   1. «Shablonni yuklab olish» — Excel shablon
 *   2. Toʻldirilgan faylni yuklash → QORALAMA reja (ogohlantirishlar bilan)
 *   3. Kartochkalarda koʻrib chiqish (ustoz koʻradigan koʻrinishning oʻzi)
 *   4. «Joriy qilish» — shu ondan ustozlar kabinetida chiqadi
 *
 * Eski joriy reja avtomatik arxivga oʻtadi; eksport istalgan holatda.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CurriculumSearch } from "@/components/shared/CurriculumSearch";
import { CurriculumView } from "@/components/shared/CurriculumView";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { lessonsToChoraklar, type Dars } from "@/lib/curriculum/data";
import {
  STATUS_LABELS,
  STATUS_TONE,
  archivePlan,
  downloadExport,
  downloadTemplate,
  fetchPlanLessons,
  fetchPlans,
  importPlan,
  publishPlan,
  type PlanRowOut,
} from "@/lib/curriculum/manage";
import { apiXato } from "@/lib/school/api";

const SINFLAR = ["0-sinf", "1-A", "1-B", "2-A", "2-B", "3-A", "3-B", "4-A"];

export default function MetodikaPage() {
  const [plans, setPlans] = useState<PlanRowOut[] | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [ochiq, setOchiq] = useState<PlanRowOut | null>(null);

  const yukla = useCallback(async () => {
    try {
      setPlans(await fetchPlans());
      setXato(null);
    } catch (err) {
      setXato(apiXato(err, "Rejalarni olib boʻlmadi."));
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Metodik baza</h1>
          <p className="text-sm text-foreground-muted">
            Shablon → toʻldirish → yuklash → koʻrib chiqish → joriy qilish
          </p>
        </div>
        <button
          type="button"
          onClick={() => void downloadTemplate().catch(() => undefined)}
          className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          ⬇ Shablonni yuklab olish
        </button>
      </div>

      {xato && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}

      {/*
        MET-05: qidiruv joriy rejalar boʻyicha. Oʻquv boʻlimiga ham
        kerak — «bu atama qaysi darsda bor?» degan savol reja
        tuzayotganda tez-tez chiqadi.
      */}
      <section className="rounded-xl border border-border bg-surface p-3">
        <CurriculumSearch />
      </section>

      <ImportForm onDone={() => void yukla()} />

      {plans === null ? (
        <ListSkeleton count={4} />
      ) : plans.length === 0 ? (
        <EmptyState
          title="Hali reja yuklanmagan"
          description="Shablonni yuklab olib toʻldiring va shu yerga yuklang — reja avval qoralama boʻladi."
        />
      ) : (
        <PlansTable
          plans={plans}
          onPreview={setOchiq}
          onChanged={() => void yukla()}
        />
      )}

      {ochiq && (
        <PreviewPanel plan={ochiq} onClose={() => setOchiq(null)} onChanged={() => void yukla()} />
      )}
    </div>
  );
}

// ─────────────────────────── Import formasi ───────────────────────────

function ImportForm({ onDone }: { onDone: () => void }) {
  const [fan, setFan] = useState("");
  const [yil, setYil] = useState("1-yil");
  const [sinf, setSinf] = useState(SINFLAR[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const tayyor = fan.trim().length >= 2 && file !== null;

  async function yubor(e: React.FormEvent) {
    e.preventDefault();
    if (!tayyor || busy || !file) return;
    setBusy(true);
    setXato(null);
    setWarnings([]);
    try {
      const r = await importPlan({ fan: fan.trim(), yil, sinf, file });
      setWarnings(r.warnings);
      setFan("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onDone();
    } catch (err) {
      setXato(apiXato(err, "Faylni yuklab boʻlmadi. Shablon formatini tekshiring."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={yubor}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-foreground">Yangi reja yuklash</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Fan</span>
          <input
            value={fan}
            onChange={(e) => setFan(e.target.value)}
            placeholder="Masalan: Matematika"
            required
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-base outline-none transition-colors placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 sm:text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Dastur yili
          </span>
          <select
            value={yil}
            onChange={(e) => setYil(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option value="1-yil">1-yil</option>
            <option value="2-yil">2-yil</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
          <select
            value={sinf}
            onChange={(e) => setSinf(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            {SINFLAR.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Shablon fayli (.xlsx)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block h-10 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-surface-muted file:px-2.5 file:py-1 file:text-sm file:text-foreground"
          />
        </label>
      </div>

      {xato && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-warning-tint/50 px-3 py-2 text-sm text-foreground">
          <p className="font-medium">Yuklandi, lekin ogohlantirishlar bor:</p>
          <ul className="mt-1 list-inside list-disc text-foreground-muted">
            {warnings.slice(0, 6).map((w) => (
              <li key={w}>{w}</li>
            ))}
            {warnings.length > 6 && <li>… yana {warnings.length - 6} ta</li>}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!tayyor || busy}
          className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Yuklanmoqda…" : "Rejani yuklash"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────── Rejalar jadvali ───────────────────────────

function PlansTable({
  plans,
  onPreview,
  onChanged,
}: {
  plans: PlanRowOut[];
  onPreview: (p: PlanRowOut) => void;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function amal(id: string, f: () => Promise<unknown>) {
    setBusyId(id);
    setXato(null);
    try {
      await f();
      onChanged();
    } catch (err) {
      setXato(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {xato && (
        <p role="alert" className="border-b border-border bg-danger-tint px-4 py-2 text-sm text-danger">
          {xato}
        </p>
      )}
      <div className="scroll-x">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <th className="px-3 py-3">Fan</th>
              <th className="px-3 py-3">Yil</th>
              <th className="px-3 py-3">Sinf</th>
              <th className="px-3 py-3">Darslar</th>
              <th className="px-3 py-3">Holat</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 hover:bg-surface-muted/50"
              >
                <td className="px-3 py-2.5 font-medium text-foreground">{p.fan}</td>
                <td className="px-3 py-2.5 text-foreground-muted">{p.yil}</td>
                <td className="px-3 py-2.5 text-foreground-muted">{p.sinf}</td>
                <td className="num px-3 py-2.5 text-foreground-muted">
                  {p.darslar_soni}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPreview(p)}
                      className="focus-ring rounded px-1.5 py-1 text-xs font-medium text-brand-dark hover:underline"
                    >
                      Koʻrish
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadExport(p).catch(() => undefined)}
                      className="focus-ring rounded px-1.5 py-1 text-xs font-medium text-foreground-muted hover:text-foreground"
                    >
                      Eksport
                    </button>
                    {/*
                      MET-07: arxivdagi versiya ham joriy qilinadi —
                      «oldingi versiyaga qaytarish» aynan shu. Eski
                      reja oʻchirilmagan, faqat holati arxiv.
                    */}
                    {p.status !== "joriy" && (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void amal(p.id, () => publishPlan(p.id))}
                        className="focus-ring rounded bg-brand px-2 py-1 text-xs font-semibold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
                      >
                        {p.status === "arxiv" ? "Qayta joriy qilish" : "Joriy qilish"}
                      </button>
                    )}
                    {p.status !== "joriy" && (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void amal(p.id, () => archivePlan(p.id))}
                        className="focus-ring rounded px-1.5 py-1 text-xs font-medium text-foreground-muted hover:text-danger"
                      >
                        Oʻchirish
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2.5 text-xs text-foreground-muted">
        «Joriy qilish» — reja shu ondan ustozlar kabinetida koʻrinadi; shu
        fan/sinfning eski joriy rejasi avtomatik arxivga oʻtadi.
      </p>
    </div>
  );
}

// ─────────────────────── Koʻrib chiqish paneli ───────────────────────

function PreviewPanel({
  plan,
  onClose,
  onChanged,
}: {
  plan: PlanRowOut;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lessons, setLessons] = useState<Dars[] | null>(null);
  const [xato, setXato] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLessons(null);
    fetchPlanLessons(plan.id)
      .then((r) => alive && setLessons(r.lessons as unknown as Dars[]))
      .catch(() => alive && setXato(true));
    return () => {
      alive = false;
    };
  }, [plan.id]);

  const reja = useMemo(
    () =>
      lessons
        ? lessonsToChoraklar(plan.yil, plan.sinf, lessons as (Dars & { chorak?: number })[])
        : null,
    [lessons, plan],
  );

  return (
    <section className="rounded-xl border border-brand/40 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {plan.fan} · {plan.yil} · {plan.sinf}
          </h2>
          <p className="text-xs text-foreground-muted">
            {STATUS_LABELS[plan.status]} — ustozlar kabinetida qanday
            koʻrinsa, shu holatda.
          </p>
        </div>
        <div className="flex gap-2">
          {plan.status !== "joriy" && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await publishPlan(plan.id);
                  onChanged();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
              className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
            >
              {busy
                ? "Joriy qilinmoqda…"
                : plan.status === "arxiv"
                  ? "Qayta joriy qilish"
                  : "Joriy qilish"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="focus-ring inline-flex h-10 items-center rounded-lg border border-border px-3.5 text-sm font-medium text-foreground-muted hover:bg-surface-muted"
          >
            Yopish
          </button>
        </div>
      </div>

      {xato ? (
        <ErrorState description="Rejani ochib boʻlmadi." />
      ) : reja === null ? (
        <ListSkeleton count={4} />
      ) : (
        <CurriculumView reja={reja} />
      )}
    </section>
  );
}
