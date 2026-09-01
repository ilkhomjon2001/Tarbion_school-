"use client";

import { useCallback, useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { formatSom } from "@/lib/format";
import { useChild } from "@/lib/parent/useChild";
import {
  completeSinov,
  createIntent,
  fetchLedger,
  METHOD_LABELS,
  type IntentOut,
  type StudentLedgerOut,
} from "@/lib/payments/api";

/**
 * Toʻlov (OTA-06) — BAZADAN.
 *
 * Balans, oylik qarzlar va toʻlovlar tarixi. Server faqat OʻZ
 * farzandining maʼlumotini beradi (X-1).
 *
 * «Toʻlash» hozircha SINOV provayderi orqali: haqiqiy pul harakati
 * YOʻQ, oqim esa haqiqiy — niyat ochiladi, imzolangan callback keladi,
 * balans yopiladi. Payme/Click ulanganda shu tugma haqiqiy toʻlovga
 * aylanadi.
 */
export default function ParentPaymentsPage() {
  const [child, selectChild] = useChild();
  const [ledger, setLedger] = useState<StudentLedgerOut | null>(null);
  const [error, setError] = useState(false);
  const [intent, setIntent] = useState<IntentOut | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const yukla = useCallback(async () => {
    if (!child.id) return;
    setLedger(null);
    try {
      const l = await fetchLedger(child.id);
      setLedger(l);
      setError(false);
      // Standart taklif — joriy qarz.
      setAmount(l.finance.balance < 0 ? String(-l.finance.balance) : "");
    } catch {
      setError(true);
    }
  }, [child.id]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function tolashniBoshla() {
    if (!child.id || Number(amount) <= 0) return;
    setBusy(true);
    try {
      setIntent(await createIntent(child.id, Number(amount)));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function yakunla(outcome: "paid" | "cancelled") {
    if (!intent) return;
    setBusy(true);
    try {
      const r = await completeSinov(intent.id, outcome);
      setIntent(null);
      if (r.status === "paid") await yukla();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const fin = ledger?.finance;

  return (
    <ParentShell title="Toʻlov" child={child} onChildChange={selectChild}>
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            Maʼlumotni olib boʻlmadi. Sahifani yangilab koʻring.
          </p>
        )}

        {fin && (
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Joriy balans
            </p>
            <p
              className={`num mt-1 text-2xl font-bold ${
                fin.balance < 0 ? "text-danger" : "text-success"
              }`}
            >
              {formatSom(fin.balance)}
            </p>
            {fin.monthly_fee !== null && (
              <p className="num mt-1 text-sm text-foreground-muted">
                Oylik shartnoma: {formatSom(fin.monthly_fee)}
              </p>
            )}

            {fin.balance < 0 && !intent && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-foreground">
                    Toʻlov summasi (soʻm)
                  </span>
                  <input
                    type="number"
                    min={1000}
                    step={50000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="num h-10 w-44 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || Number(amount) <= 0}
                  onClick={() => void tolashniBoshla()}
                  className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
                >
                  Toʻlash (SINOV)
                </button>
              </div>
            )}
          </div>
        )}

        {intent && (
          <div className="rounded-xl border-2 border-dashed border-warning bg-warning-tint/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-warning">
              SINOV REJIMI — haqiqiy pul yechilmaydi
            </p>
            <p className="mt-2 text-sm text-foreground">
              Bu sahifa haqiqiy toʻlov tizimining oʻrnini bosadi. Summa:{" "}
              <span className="num font-bold">{formatSom(intent.amount)}</span>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void yakunla("paid")}
                className="focus-ring inline-flex h-10 items-center rounded-lg bg-success px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Toʻlovni tasdiqlash
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void yakunla("cancelled")}
                className="focus-ring inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        )}

        <section className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-foreground">Hisob-kitob tarixi</h2>
          {ledger === null ? (
            <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
          ) : ledger.rows.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
              Hali yozuv yoʻq.
            </p>
          ) : (
            [...ledger.rows].reverse().map((r, i) => (
              <div
                key={`${r.kind}-${r.payment_id ?? i}-${r.when}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
              >
                <span className={`min-w-0 ${r.stornod ? "line-through opacity-60" : ""}`}>
                  <span className="block truncate text-foreground">
                    {r.title}
                    {r.method && r.kind === "payment" && ` (${METHOD_LABELS[r.method] ?? r.method})`}
                  </span>
                  <span className="num block text-xs text-foreground-muted">{r.when}</span>
                </span>
                <span
                  className={`num shrink-0 font-medium ${
                    r.amount > 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {r.amount > 0 ? "+" : ""}
                  {formatSom(r.amount)}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </ParentShell>
  );
}
