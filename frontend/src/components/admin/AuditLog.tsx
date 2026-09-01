"use client";

/**
 * Audit jurnali — CLAUDE.md 4-qoida (T-021).
 *
 * Maʼlumot serverdan (`/api/v1/audit`). Yozuv oʻchirilmaydi va
 * tahrirlanmaydi — **tahrirlash tugmasi ataylab yoʻq**, va bu faqat
 * interfeys qarori emas: bazada `UPDATE`/`DELETE` trigger bilan
 * toʻsilgan.
 *
 * Filtr roʻyxati ham serverdan: jurnalda haqiqatan uchraydigan turlar
 * va amallar. Qatʼiy yozib qoʻyilsa, yangi modul qoʻshilganda filtr
 * eskirib qolardi.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ClockIcon, SearchIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import {
  ACTION_LABELS,
  ACTION_TONES,
  OBJECT_LABELS,
  describeValue,
  fetchAudit,
  fetchAuditFilters,
  formatMoment,
  type AuditEntryOut,
} from "@/lib/admin/audit-api";

const SAHIFA = 50;

const inputClass =
  "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

export function AuditLog() {
  const [query, setQuery] = useState("");
  const [objectType, setObjectType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<AuditEntryOut[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [turlar, setTurlar] = useState<string[]>([]);
  const [amallar, setAmallar] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetchAuditFilters()
      .then((f) => {
        if (!alive) return;
        setTurlar(f.object_types);
        setAmallar(f.actions);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const yukla = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sahifa = await fetchAudit({
        query,
        objectType,
        action,
        dateFrom,
        dateTo,
        limit: SAHIFA,
        offset,
      });
      setRows(sahifa.rows);
      setTotal(sahifa.total);
      setHasMore(sahifa.has_more);
    } catch {
      setError("Jurnalni olib boʻlmadi. Buni faqat administrator koʻra oladi.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query, objectType, action, dateFrom, dateTo, offset]);

  // Qidiruv har harfda serverga bormasin.
  useEffect(() => {
    const t = setTimeout(() => void yukla(), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [yukla, query]);

  // Filtr oʻzgarsa birinchi sahifaga qaytamiz — aks holda odam
  // boʻsh sahifani koʻrib «hech narsa yoʻq» deb oʻylardi.
  function filtrla<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setOffset(0);
    };
  }

  // `downloadCsv` qatorlar massivini kutadi, birinchisi — sarlavha.
  const csv = useMemo<(string | number)[][]>(
    () => [
      ["Vaqt", "Obyekt", "Amal", "Eski qiymat", "Yangi qiymat", "Kim", "IP"],
      ...rows.map((r) => [
        formatMoment(r.created_at),
        label(OBJECT_LABELS, r.object_type),
        label(ACTION_LABELS, r.action),
        describeValue(r.old_value),
        describeValue(r.new_value),
        r.actor_name ?? "tizim",
        r.ip_address ?? "",
      ]),
    ],
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Audit jurnali</h1>
          <p className="text-sm text-foreground-muted">
            Jami <span className="num font-medium text-foreground">{total}</span> yozuv.
            Yozuv oʻchirilmaydi va tahrirlanmaydi.
          </p>
        </div>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => downloadCsv("audit", csv)}
          className="focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          Shu sahifani CSV ga
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[13rem] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => filtrla(setQuery)(e.target.value)}
            placeholder="Obyekt, amal, xodim yoki qiymat"
            aria-label="Jurnalda qidirish"
            className={`${inputClass} w-full pl-8`}
          />
        </label>

        <select
          value={objectType}
          onChange={(e) => filtrla(setObjectType)(e.target.value)}
          aria-label="Obyekt turi"
          className={inputClass}
        >
          <option value="">Barcha obyektlar</option>
          {turlar.map((t) => (
            <option key={t} value={t}>
              {label(OBJECT_LABELS, t)}
            </option>
          ))}
        </select>

        <select
          value={action}
          onChange={(e) => filtrla(setAction)(e.target.value)}
          aria-label="Amal turi"
          className={inputClass}
        >
          <option value="">Barcha amallar</option>
          {amallar.map((a) => (
            <option key={a} value={a}>
              {label(ACTION_LABELS, a)}
            </option>
          ))}
        </select>

        <label>
          <span className="mb-1 block text-xs text-foreground-muted">Dan</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => filtrla(setDateFrom)(e.target.value)}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-foreground-muted">Gacha</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => filtrla(setDateTo)(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {error ? (
        <ErrorState description={error} />
      ) : loading ? (
        <ListSkeleton count={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ClockIcon className="h-5 w-5" />}
          title="Yozuv topilmadi"
          description="Filtrni kengaytiring yoki boshqa sana oraligʻini tanlang."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3">Obyekt</th>
                  <th className="px-3 py-3">Amal</th>
                  <th className="px-3 py-3">Oʻzgarish</th>
                  <th className="px-3 py-3">Kim</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border align-top transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                      {formatMoment(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {label(OBJECT_LABELS, r.object_type)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={ACTION_TONES[r.action] ?? "neutral"}>
                        {label(ACTION_LABELS, r.action)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {r.old_value && (
                        <span className="block text-xs line-through opacity-60">
                          {describeValue(r.old_value)}
                        </span>
                      )}
                      <span className="block text-xs">{describeValue(r.new_value)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {r.actor_name ?? <span className="italic">tizim</span>}
                      {r.ip_address && (
                        <span className="num block text-xs opacity-60">{r.ip_address}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <p className="text-xs text-foreground-muted">
              <span className="num">{offset + 1}</span>–
              <span className="num">{offset + rows.length}</span> /{" "}
              <span className="num">{total}</span>
            </p>
            <span className="flex gap-1.5">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - SAHIFA))}
                className="focus-ring rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
              >
                Oldingi
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setOffset(offset + SAHIFA)}
                className="focus-ring rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
              >
                Keyingi
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
