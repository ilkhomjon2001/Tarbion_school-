"use client";

/**
 * Parolni tiklash navbati (T-006, AUT-02) — administrator uchun.
 *
 * TZ talabi: «Bot ulanmagan boʻlsa — administrator qoʻlda tiklaydi».
 * Ustoz va maʼmuriyatda telefon raqami yoʻq, ota-onaning Telegrami
 * ulanmagan boʻlishi mumkin — bunday soʻrovlarning hammasi shu yerga
 * tushadi.
 *
 * Bosh sahifada turadi va **faqat soʻrov borligida koʻrinadi**: boʻsh
 * blok har kuni eʼtiborni oʻgʻirlab, borini esa koʻrinmas qilardi.
 *
 * Yangi parol FAQAT bir marta koʻrsatiladi — u hech qayerda
 * saqlanmaydi (X-10). Administrator uni darhol odamga yetkazadi.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import {
  fetchResetQueue,
  resetXato,
  resolveReset,
  type ResetQueueRowOut,
} from "@/lib/password-reset";

function vaqt(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResetQueue() {
  const [rows, setRows] = useState<ResetQueueRowOut[] | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [berilgan, setBerilgan] = useState<{ login: string; password: string } | null>(null);

  const yukla = useCallback(async () => {
    try {
      setRows(await fetchResetQueue());
    } catch {
      // Huquqi yoʻq administrator uchun `403` keladi — bu xato emas,
      // shunchaki blok koʻrsatilmaydi.
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function hal(row: ResetQueueRowOut) {
    setBand(row.id);
    setXato(null);
    try {
      const javob = await resolveReset(row.id);
      setBerilgan({ login: javob.login, password: javob.password });
      await yukla();
    } catch (err) {
      setXato(resetXato(err, "Tiklab boʻlmadi. Qayta urinib koʻring."));
    } finally {
      setBand(null);
    }
  }

  if (rows === null || (rows.length === 0 && berilgan === null)) return null;

  return (
    <section className="rounded-xl border border-warning-tint bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Parolni tiklash soʻrovlari</h2>
        <span className="text-xs text-foreground-muted">
          Yangi parolni odamning oʻziga ogʻzaki yoki telefon orqali ayting
        </span>
      </div>

      {berilgan && (
        <div className="mb-3 rounded-lg border border-success bg-success-tint p-3">
          <p className="text-sm font-medium text-foreground">
            {berilgan.login} uchun yangi parol:
          </p>
          <p className="num mt-1 text-2xl font-bold tracking-wider text-foreground">
            {berilgan.password}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Bu parol boshqa koʻrsatilmaydi — hozir yozib oling yoki darhol ayting.
          </p>
          <button
            type="button"
            onClick={() => setBerilgan(null)}
            className="focus-ring mt-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
          >
            Yozib oldim
          </button>
        </div>
      )}

      {xato && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-muted px-3 py-2"
          >
            <span className="font-medium text-foreground">{r.full_name}</span>
            <span className="num text-xs text-foreground-muted">{r.login}</span>
            {r.roles.map((rol) => (
              <Badge key={rol} tone="neutral">
                {ROLE_LABELS[rol as UserRole] ?? rol}
              </Badge>
            ))}
            <span className="num text-xs text-foreground-muted">{r.phone_masked}</span>
            <span className="num ml-auto text-xs text-foreground-muted">
              {vaqt(r.created_at)}
            </span>
            <button
              type="button"
              disabled={band === r.id}
              onClick={() => void hal(r)}
              className="focus-ring rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-dark disabled:opacity-60"
            >
              {band === r.id ? "Tiklanmoqda…" : "Yangi parol berish"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
