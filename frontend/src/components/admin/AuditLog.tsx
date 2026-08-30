"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClockIcon, SearchIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { useAdmin } from "@/lib/admin/store";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/admin/types";

const ACTION_TONE: Record<AuditAction, "success" | "danger" | "warning" | "info" | "brand" | "neutral"> = {
  payment: "success",
  storno: "danger",
  debt: "warning",
  reminder: "info",
  enroll: "brand",
  archive: "neutral",
  restore: "success",
  document: "info",
  note: "neutral",
  survey: "brand",
  reference: "neutral",
  appeal: "info",
  profile: "neutral",
  contract: "brand",
  access: "warning",
  settings: "neutral",
};

/**
 * Audit jurnali — CLAUDE.md 4-qoida.
 *
 * Yozuv oʻchirilmaydi va tahrirlanmaydi. Bu yerda faqat oʻqish mumkin:
 * tahrirlash tugmasi ataylab yoʻq. Backend ulanganda `audit_log`
 * jadvalidan sahifalab olinadi.
 */
export function AuditLog() {
  const { audit } = useAdmin();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<AuditAction | "all">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audit.filter((entry) => {
      if (action !== "all" && entry.action !== action) return false;
      if (!q) return true;
      return (
        entry.entity.toLowerCase().includes(q) ||
        entry.detail.toLowerCase().includes(q) ||
        entry.actor.toLowerCase().includes(q)
      );
    });
  }, [audit, query, action]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Audit jurnali</h1>
          <p className="text-sm text-foreground-muted">
            Baho, davomat, toʻlov va hujjatlardagi har bir oʻzgarish shu yerda qayd etiladi
          </p>
        </div>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv("tarbion-audit-jurnali", [
              ["Vaqt", "Amal", "Obyekt", "Tafsilot", "Kim"],
              ...rows.map((e) => [
                e.at,
                AUDIT_ACTION_LABELS[e.action],
                e.entity,
                e.detail,
                e.actor,
              ]),
            ])
          }
          className="focus-ring h-10 shrink-0 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          Jurnalni yuklab olish (CSV)
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Oʻquvchi, hujjat raqami yoki tafsilot boʻyicha qidirish…"
            aria-label="Audit yozuvlarini qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as AuditAction | "all")}
          aria-label="Amal turi"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Barcha amallar</option>
          {(Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((key) => (
            <option key={key} value={key}>
              {AUDIT_ACTION_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClockIcon className="h-5 w-5" />}
          title="Yozuv topilmadi"
          description="Filtrni oʻzgartiring yoki admin panelda biror amal bajaring — u shu yerga tushadi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3">Amal</th>
                  <th className="px-3 py-3">Obyekt</th>
                  <th className="px-3 py-3">Tafsilot</th>
                  <th className="px-3 py-3">Kim</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                      {entry.at}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={ACTION_TONE[entry.action]}>
                        {AUDIT_ACTION_LABELS[entry.action]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{entry.entity}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{entry.detail}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{entry.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Audit yozuvi oʻchirilmaydi va tahrirlanmaydi — shuning uchun bu sahifada
            faqat oʻqish mumkin. Jami <span className="num">{rows.length}</span> ta yozuv.
          </p>
        </div>
      )}
    </div>
  );
}
