"use client";

/**
 * Yetkazilmagan xabarlar jurnali (BOT-06).
 *
 * TZ: «Yetkazilmagan xabarlar jurnalga yoziladi va qayta yuborish
 * imkoniyati beriladi.»
 *
 * Sukut boʻyicha YIQILGANLAR koʻrsatiladi. Ekranning maqsadi —
 * muammoni topish: minglab muvaffaqiyatli xabar orasida yiqilgan
 * uchtasini qidirish maʼnosiz.
 *
 * Xato matni ochiq koʻrsatiladi va bu muhim: «yuborilmadi» degan
 * yozuv administratorga hech narsa bermaydi, «403: bot bloklangan»
 * esa nima qilish kerakligini aytadi — ota-onaga qoʻngʻiroq qilib,
 * botni blokdan chiqarishni soʻrash.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { apiXato } from "@/lib/school/api";
import {
  fetchOutbox,
  fetchOutboxCounts,
  retryAllFailed,
  retryOutbox,
  OUTBOX_KIND_LABELS,
  OUTBOX_STATUS_LABELS,
  type OutboxCountsOut,
  type OutboxRowOut,
  type OutboxStatus,
} from "@/lib/outbox";

const TABS: OutboxStatus[] = ["failed", "pending", "sent", "cancelled"];

const STATUS_TONE: Record<OutboxStatus, "danger" | "warning" | "success" | "neutral"> = {
  failed: "danger",
  pending: "warning",
  sent: "success",
  cancelled: "neutral",
};

function vaqt(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OutboxLog() {
  const [tab, setTab] = useState<OutboxStatus>("failed");
  const [rows, setRows] = useState<OutboxRowOut[] | null>(null);
  const [counts, setCounts] = useState<OutboxCountsOut | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [xabar, setXabar] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    setXato(null);
    try {
      const [r, c] = await Promise.all([fetchOutbox(tab), fetchOutboxCounts()]);
      setRows(r);
      setCounts(c);
    } catch (err) {
      setXato(apiXato(err, "Jurnalni yuklab boʻlmadi."));
      setRows([]);
    }
  }, [tab]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function qayta(id: string) {
    setBand(id);
    setXato(null);
    try {
      const n = await retryOutbox(id);
      setXabar(n ? "Xabar navbatga qaytarildi." : "Bu xabarni qayta yuborib boʻlmaydi.");
      await yukla();
    } catch (err) {
      setXato(apiXato(err, "Qayta yuborib boʻlmadi."));
    } finally {
      setBand(null);
    }
  }

  async function hammasi() {
    setBand("all");
    setXato(null);
    try {
      const n = await retryAllFailed();
      setXabar(`${n} ta xabar navbatga qaytarildi.`);
      await yukla();
    } catch (err) {
      setXato(apiXato(err, "Qayta yuborib boʻlmadi."));
    } finally {
      setBand(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        Telegram orqali yuborilgan xabarlar. Yiqilgani oʻchirilmaydi — sababi
        bilan shu yerda qoladi va qayta yuborilishi mumkin.
      </p>

      {/* Holat boʻyicha tablar — sanoq bilan. */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === s
                ? "bg-surface text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {OUTBOX_STATUS_LABELS[s]}
            {counts && (
              <span className="num ml-1.5 text-xs text-foreground-muted">
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {xato && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}
      {xabar && (
        <p className="rounded-lg bg-success-tint px-3 py-2 text-sm text-success">{xabar}</p>
      )}

      {tab === "failed" && (counts?.failed ?? 0) > 1 && (
        <div>
          <button
            type="button"
            disabled={band !== null}
            onClick={() => void hammasi()}
            className="focus-ring h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
          >
            {band === "all"
              ? "Yuborilmoqda…"
              : `Hammasini qayta yuborish (${counts?.failed})`}
          </button>
          <p className="mt-1 text-xs text-foreground-muted">
            Telegram bir necha soat tushib qolsa oʻnlab xabar yiqiladi — bittalab
            bosib chiqish shart emas.
          </p>
        </div>
      )}

      {rows === null ? (
        <ListSkeleton count={3} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-foreground-muted">
          {tab === "failed"
            ? "Yiqilgan xabar yoʻq — hammasi yetkazilgan."
            : "Bu holatda xabar yoʻq."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[r.status as OutboxStatus]}>
                  {OUTBOX_STATUS_LABELS[r.status as OutboxStatus] ?? r.status}
                </Badge>
                <span className="text-sm font-medium text-foreground">{r.user_name}</span>
                <span className="text-xs text-foreground-muted">
                  {OUTBOX_KIND_LABELS[r.kind] ?? r.kind}
                </span>
                <span className="num ml-auto text-xs text-foreground-muted">
                  {vaqt(r.created_at)}
                </span>
              </div>

              <p className="mt-1.5 text-sm font-medium text-foreground">{r.title}</p>
              <p className="whitespace-pre-wrap text-sm text-foreground-muted">{r.body}</p>

              {r.last_error && (
                <p className="mt-1.5 rounded-lg bg-danger-tint px-2 py-1 text-xs text-danger">
                  {r.last_error}
                  <span className="num ml-2 opacity-80">({r.attempts} urinish)</span>
                </p>
              )}

              {r.status === "failed" && (
                <button
                  type="button"
                  disabled={band !== null}
                  onClick={() => void qayta(r.id)}
                  className="focus-ring mt-2 h-9 rounded-lg border border-border px-3 text-sm font-medium text-brand-dark hover:bg-surface-muted disabled:opacity-50"
                >
                  {band === r.id ? "Yuborilmoqda…" : "Qayta yuborish"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
