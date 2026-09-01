"use client";

/**
 * Qoʻngʻiroqlar — BAZADAN.
 *
 * Barcha lidlar boʻylab oxirgi qoʻngʻiroqlar jurnali (sana boʻyicha,
 * yangisi birinchi). Yozish Lidlar sahifasida, lid ichida qilinadi —
 * bu sahifa kuzatuv uchun.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PhoneIcon } from "@/components/ui/icons";
import {
  fetchRecentCalls,
  formatCallTime,
  RESULT_LABELS,
  STATUS_LABELS,
  type CallFeedOut,
} from "@/lib/crm/api";
import { apiXato } from "@/lib/school/api";

const RESULT_TONES: Record<string, "success" | "warning" | "neutral" | "info"> = {
  javob_berdi: "success",
  kotarilmadi: "neutral",
  band: "warning",
  keyin_qaytaraman: "info",
};

export function CallsBoard() {
  const [calls, setCalls] = useState<CallFeedOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    try {
      setCalls(await fetchRecentCalls(100));
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Qoʻngʻiroqlar jurnalini olib boʻlmadi."));
      setCalls([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Qoʻngʻiroqlar</h1>
        <p className="text-sm text-foreground-muted">
          Barcha lidlar boʻylab oxirgi qoʻngʻiroqlar. Yangi qoʻngʻiroq{" "}
          <Link href="/admin/lidlar" className="font-medium text-brand-dark underline">
            Lidlar
          </Link>{" "}
          sahifasida, lid ichida yoziladi.
        </p>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      {calls === null ? (
        <ListSkeleton count={6} />
      ) : calls.length === 0 ? (
        <EmptyState
          icon={<PhoneIcon className="h-5 w-5" />}
          title="Hali qoʻngʻiroq yozilmagan"
          description="Lid bilan aloqa boʻlgach, qoʻngʻiroq natijasi shu yerda koʻrinadi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3">Lid</th>
                  <th className="px-3 py-3">Natija</th>
                  <th className="px-3 py-3">Izoh</th>
                  <th className="px-3 py-3">Kim yozdi</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="num px-3 py-2.5 whitespace-nowrap text-foreground-muted">
                      {formatCallTime(c.called_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground">{c.lead_parent_name}</span>
                      <span className="num ml-2 text-xs text-foreground-muted">
                        {c.lead_phone}
                      </span>
                      <span className="ml-2 text-xs text-foreground-muted">
                        · {STATUS_LABELS[c.lead_status] ?? c.lead_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={RESULT_TONES[c.result] ?? "neutral"}>
                        {RESULT_LABELS[c.result] ?? c.result}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">{c.note || "—"}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {c.created_by_name || "—"}
                    </td>
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
