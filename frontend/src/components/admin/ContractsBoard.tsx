"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardIcon, SearchIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { formatSom } from "@/lib/format";
import { useAdmin, useContractMonths } from "@/lib/admin/store";
import {
  CONTRACT_END_REASONS,
  type ContractEndReason,
  type ContractEventType,
} from "@/lib/admin/types";

type Filter = "all" | "start" | "end";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Barchasi",
  start: "Kelganlar",
  end: "Ketganlar",
};

const TYPE_LABELS: Record<ContractEventType, string> = {
  start: "Shartnoma ochildi",
  end: "Shartnoma yopildi",
};

/**
 * Shartnoma harakati — kelgan va ketgan oʻquvchilar bazasi.
 *
 * Yozuvlar qoʻlda kiritilmaydi: qabul qilinganda "ochildi", arxivlanganda
 * sabab va sana bilan "yopildi" yozuvi tushadi. Shu sabab bu jadval
 * haqiqiy amallarga mos keladi va oʻzgartirib boʻlmaydi.
 */
export function ContractsBoard() {
  const { contracts } = useAdmin();
  const months = useContractMonths();
  const [filter, setFilter] = useState<Filter>("all");
  const [reason, setReason] = useState<ContractEndReason | "all">("all");
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contracts.filter((c) => {
      if (filter !== "all" && c.type !== filter) return false;
      if (reason !== "all" && c.reason !== reason) return false;
      if (month !== "all" && !c.date.startsWith(month)) return false;
      if (!q) return true;
      return (
        c.studentName.toLowerCase().includes(q) || c.className.toLowerCase().includes(q)
      );
    });
  }, [contracts, filter, reason, month, query]);

  // Joriy oʻquv yili — 2026-09 dan boshlab.
  const thisYear = useMemo(() => {
    const inYear = contracts.filter((c) => c.date >= "2026-09-01");
    const started = inYear.filter((c) => c.type === "start").length;
    const ended = inYear.filter((c) => c.type === "end").length;
    const lostFee = inYear
      .filter((c) => c.type === "end")
      .reduce((sum, c) => sum + c.monthlyFee, 0);
    return { started, ended, net: started - ended, lostFee };
  }, [contracts]);

  const reasonBreakdown = useMemo(() => {
    const map = new Map<ContractEndReason, number>();
    for (const c of contracts) {
      if (c.type !== "end" || !c.reason) continue;
      map.set(c.reason, (map.get(c.reason) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [contracts]);

  const totalEnded = reasonBreakdown.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Shartnomalar</h1>
          <p className="text-sm text-foreground-muted">
            Kelgan va ketgan oʻquvchilar — sanasi va sababi bilan
          </p>
        </div>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv("tarbion-shartnomalar", [
              ["Sana", "Turi", "Oʻquvchi", "Sinf", "Sababi", "Izoh", "Oylik shartnoma", "Kim"],
              ...rows.map((c) => [
                c.date,
                TYPE_LABELS[c.type],
                c.studentName,
                c.className,
                c.reason ? CONTRACT_END_REASONS[c.reason] : "—",
                c.note,
                String(c.monthlyFee),
                c.createdBy,
              ]),
            ])
          }
          className="focus-ring h-10 shrink-0 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          Bazani yuklab olish (CSV)
        </button>
      </div>

      {/* Joriy oʻquv yili yakuni */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Kelgan"
          value={`+${thisYear.started}`}
          tone="success"
          hint="2026–2027 oʻquv yilida"
        />
        <SummaryCard
          label="Ketgan"
          value={`−${thisYear.ended}`}
          tone="danger"
          hint="shartnoma yopilgan"
        />
        <SummaryCard
          label="Sof oʻzgarish"
          value={thisYear.net >= 0 ? `+${thisYear.net}` : String(thisYear.net)}
          tone={thisYear.net >= 0 ? "success" : "danger"}
          hint="kelgan − ketgan"
        />
        <SummaryCard
          label="Yoʻqotilgan oylik"
          value={formatSom(thisYear.lostFee)}
          tone="neutral"
          hint="ketganlarning shartnoma summasi"
        />
      </div>

      {/* Oylar kesimi */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
          Oylar kesimida harakat
        </h2>
        {months.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground-muted">
            Joriy yil uchun yozuv yoʻq.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {months.map((m) => {
              const scale = Math.max(m.started, m.ended, 1);
              return (
                <li key={m.key} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setMonth(month === m.key ? "all" : m.key)}
                    aria-pressed={month === m.key}
                    className={`focus-ring w-32 shrink-0 rounded px-1 py-0.5 text-left text-sm transition-colors ${
                      month === m.key
                        ? "font-semibold text-brand-dark"
                        : "text-foreground hover:text-brand-dark"
                    }`}
                  >
                    {m.label}
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="bar-fill h-2 rounded-full bg-success"
                        style={{ width: `${(m.started / scale) * 100}%`, minWidth: m.started ? "6px" : "0" }}
                      />
                      <span className="num shrink-0 text-xs text-success">+{m.started}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="bar-fill h-2 rounded-full bg-danger"
                        style={{ width: `${(m.ended / scale) * 100}%`, minWidth: m.ended ? "6px" : "0" }}
                      />
                      <span className="num shrink-0 text-xs text-danger">−{m.ended}</span>
                    </div>
                  </div>

                  <span
                    className={`num w-12 shrink-0 text-right text-sm font-semibold ${
                      m.net >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {m.net >= 0 ? `+${m.net}` : m.net}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-border px-4 py-2.5 text-xs text-foreground-muted">
          Oy nomini bosing — quyidagi jadval shu oyga filtrlanadi.
        </p>
      </section>

      {/* Ketish sabablari */}
      {totalEnded > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-foreground">Ketish sabablari</h2>
          <ul className="flex flex-col gap-2">
            {reasonBreakdown.map(([key, count]) => (
              <li key={key} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReason(reason === key ? "all" : key);
                    setFilter("end");
                  }}
                  aria-pressed={reason === key}
                  className={`focus-ring w-48 shrink-0 truncate rounded px-1 py-0.5 text-left text-sm transition-colors ${
                    reason === key
                      ? "font-semibold text-brand-dark"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {CONTRACT_END_REASONS[key]}
                </button>
                <span className="h-2 min-w-0 flex-1 rounded-full bg-surface-muted">
                  <span
                    className="bar-fill block h-full rounded-full bg-warning"
                    style={{ width: `${(count / totalEnded) * 100}%` }}
                  />
                </span>
                <span className="num w-16 shrink-0 text-right text-sm text-foreground">
                  {count} ta
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtrlar */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Oʻquvchi yoki sinf boʻyicha qidirish…"
            aria-label="Shartnomalarni qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <div className="flex gap-1.5">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                if (key !== "end") setReason("all");
              }}
              aria-pressed={filter === key}
              className={`focus-ring h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        {(month !== "all" || reason !== "all") && (
          <button
            type="button"
            onClick={() => {
              setMonth("all");
              setReason("all");
            }}
            className="focus-ring h-10 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:text-danger"
          >
            Filtrni tozalash
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title="Yozuv topilmadi"
          description="Filtrni oʻzgartiring. Yangi yozuv qabul qilinganda yoki shartnoma yopilganda oʻzi paydo boʻladi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Sana</th>
                  <th className="px-3 py-3">Turi</th>
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3">Sababi va izoh</th>
                  <th className="px-3 py-3">Oylik</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 120).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                      {c.date}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.type === "start" ? "success" : "danger"}>
                        {c.type === "start" ? "Kelgan" : "Ketgan"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{c.studentName}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{c.className}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {c.reason && (
                        <span className="font-medium text-foreground">
                          {CONTRACT_END_REASONS[c.reason]}
                          {c.note ? " · " : ""}
                        </span>
                      )}
                      {c.note}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                      {formatSom(c.monthlyFee)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            {rows.length > 120 && (
              <>
                Birinchi <span className="num">120</span> tasi koʻrsatildi (jami{" "}
                <span className="num">{rows.length}</span>) — hammasi CSV da.{" "}
              </>
            )}
            Yozuv qoʻlda kiritilmaydi va tahrirlanmaydi: qabul va arxivlash amallaridan
            avtomatik tushadi.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral";
  hint: string;
}) {
  const valueClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}
