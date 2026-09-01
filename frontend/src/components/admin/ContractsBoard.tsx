"use client";

/**
 * Shartnomalar — BAZADAN (mavjud toʻlov shartnomalari roʻyxati).
 *
 * FAQAT oʻqish: summa oʻzgartirilsa yangi yozuv ochiladi, eskisi
 * arxivlanadi — bu Toʻlovlar boʻlimida (oʻquvchi kartochkasida)
 * qilinadi. «Eski» qatorlar tarix uchun koʻrinib turadi.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SearchIcon, ShieldIcon } from "@/components/ui/icons";
import { fetchContracts, type CrmContractOut } from "@/lib/crm/api";
import { formatDate, formatSom } from "@/lib/format";
import { apiXato } from "@/lib/school/api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

export function ContractsBoard() {
  const [rows, setRows] = useState<CrmContractOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const yukla = useCallback(async () => {
    try {
      setRows(await fetchContracts(q || undefined));
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Shartnomalar roʻyxatini olib boʻlmadi."));
      setRows([]);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void yukla(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [yukla, q]);

  const amalda = rows?.filter((r) => !r.is_archived).length ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Shartnomalar</h1>
        <p className="text-sm text-foreground-muted">
          Oylik toʻlov shartnomalari{rows ? ` — ${amalda} tasi amalda` : ""}. Summani
          oʻzgartirish{" "}
          <Link href="/admin/tolovlar" className="font-medium text-brand-dark underline">
            Toʻlovlar
          </Link>{" "}
          boʻlimida, oʻquvchi kartochkasida qilinadi.
        </p>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="relative min-w-[220px] md:max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Oʻquvchi boʻyicha qidirish"
          aria-label="Shartnomalarni qidirish"
          className={`${inputClass} pl-8`}
        />
      </div>

      {rows === null ? (
        <ListSkeleton count={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ShieldIcon className="h-5 w-5" />}
          title={q ? "Hech narsa topilmadi" : "Hozircha shartnoma yoʻq"}
          description={
            q
              ? "Qidiruv shartini oʻzgartirib koʻring."
              : "Shartnoma oʻquvchi kartochkasining «Toʻlovlar» boʻlimida ochiladi."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3 text-right">Oylik summa</th>
                  <th className="px-3 py-3">Boshlanish</th>
                  <th className="px-3 py-3">Holat</th>
                  <th className="px-3 py-3">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {r.student_name}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {r.class_name || "—"}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground">
                      {formatSom(r.monthly_fee)}
                    </td>
                    <td className="num px-3 py-2.5 text-foreground-muted">
                      {formatDate(r.starts_on)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={r.is_archived ? "neutral" : "success"}>
                        {r.is_archived ? "Eski" : "Amalda"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
