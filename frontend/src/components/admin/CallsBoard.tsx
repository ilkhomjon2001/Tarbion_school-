"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PhoneIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { CallForm } from "@/components/admin/LeadsBoard";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
import {
  CALL_DIRECTION_LABELS,
  CALL_OUTCOME_LABELS,
  type CallDirection,
  type CallOutcome,
} from "@/lib/admin/types";

const OUTCOME_TONE: Record<CallOutcome, "success" | "danger" | "warning" | "info"> = {
  javob_berdi: "success",
  javob_bermadi: "danger",
  band: "warning",
  qayta_qongiroq: "info",
};

type LinkFilter = "all" | "lead" | "student" | "other";

const LINK_LABELS: Record<LinkFilter, string> = {
  all: "Barchasi",
  lead: "Lidlar",
  student: "Oʻquvchilar",
  other: "Bogʻlanmagan",
};

/**
 * Qoʻngʻiroqlar logi — call center.
 *
 * Har bir qoʻngʻiroq lidga yoki oʻquvchiga bogʻlanadi; shu sabab
 * oʻquvchi profilidagi tarixda ham koʻrinadi. Bogʻlanmagan qoʻngʻiroq
 * ham qayd etiladi — keyin lidga aylantirish mumkin.
 */
export function CallsBoard() {
  const { calls, leads, students } = useAdmin();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<CallDirection | "all">("all");
  const [outcome, setOutcome] = useState<CallOutcome | "all">("all");
  const [link, setLink] = useState<LinkFilter>("all");
  const [logging, setLogging] = useState(false);

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((c) => {
      if (direction !== "all" && c.direction !== direction) return false;
      if (outcome !== "all" && c.outcome !== outcome) return false;
      if (link === "lead" && !c.leadId) return false;
      if (link === "student" && !c.studentId) return false;
      if (link === "other" && (c.leadId || c.studentId)) return false;
      if (!q) return true;
      return (
        c.contactName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.note.toLowerCase().includes(q)
      );
    });
  }, [calls, query, direction, outcome, link]);

  const summary = useMemo(() => {
    const answered = calls.filter((c) => c.outcome === "javob_berdi");
    const totalMin = Math.round(
      answered.reduce((sum, c) => sum + c.durationSec, 0) / 60,
    );
    return {
      total: calls.length,
      answered: answered.length,
      answerRate: calls.length ? Math.round((answered.length / calls.length) * 100) : 0,
      totalMin,
      avgMin: answered.length ? Math.round(totalMin / answered.length) : 0,
    };
  }, [calls]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Qoʻngʻiroqlar</h1>
          <p className="text-sm text-foreground-muted">
            Lidlar va ota-onalar bilan barcha telefon aloqasi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv("tarbion-qongiroqlar", [
                ["Vaqt", "Yoʻnalish", "Kim", "Telefon", "Bogʻlangan", "Davomiyligi", "Natija", "Izoh", "Operator"],
                ...rows.map((c) => [
                  c.at,
                  CALL_DIRECTION_LABELS[c.direction],
                  c.contactName,
                  c.phone,
                  c.leadId
                    ? `Lid: ${leadById.get(c.leadId)?.childName ?? "—"}`
                    : c.studentId
                      ? `Oʻquvchi: ${studentById.get(c.studentId)?.fullName ?? "—"}`
                      : "—",
                  `${Math.round(c.durationSec / 60)} daq`,
                  CALL_OUTCOME_LABELS[c.outcome],
                  c.note,
                  c.operator,
                ]),
              ])
            }
            className="focus-ring h-10 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Yuklab olish (CSV)
          </button>
          <button
            type="button"
            onClick={() => setLogging((v) => !v)}
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Qoʻngʻiroq qayd etish
          </button>
        </div>
      </div>

      {logging && (
        <div className="rounded-xl border border-brand/40 bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Bogʻlanmagan qoʻngʻiroq
          </h2>
          <p className="mb-3 text-xs text-foreground-muted">
            Lid yoki oʻquvchiga bogʻlash uchun oʻsha kartochkadan qayd eting —
            bu yerdagi yozuv umumiy logga tushadi.
          </p>
          <ManualCall onDone={() => setLogging(false)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Jami qoʻngʻiroq" value={String(summary.total)} hint="oʻquv yili boʻyicha" />
        <Metric
          label="Gaplashildi"
          value={`${summary.answerRate}%`}
          hint={`${summary.answered} ta javob berdi`}
          tone={summary.answerRate >= 70 ? "success" : "warning"}
        />
        <Metric label="Umumiy vaqt" value={`${summary.totalMin} daq`} hint="faqat gaplashilganlari" />
        <Metric label="Oʻrtacha suhbat" value={`${summary.avgMin} daq`} hint="bitta qoʻngʻiroqqa" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, telefon yoki izoh boʻyicha…"
            aria-label="Qoʻngʻiroqlarni qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as CallDirection | "all")}
          aria-label="Yoʻnalish"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Yoʻnalish: barchasi</option>
          {(Object.keys(CALL_DIRECTION_LABELS) as CallDirection[]).map((d) => (
            <option key={d} value={d}>
              {CALL_DIRECTION_LABELS[d]}
            </option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as CallOutcome | "all")}
          aria-label="Natija"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Natija: barchasi</option>
          {(Object.keys(CALL_OUTCOME_LABELS) as CallOutcome[]).map((o) => (
            <option key={o} value={o}>
              {CALL_OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {(Object.keys(LINK_LABELS) as LinkFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setLink(key)}
              aria-pressed={link === key}
              className={`focus-ring h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
                link === key
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {LINK_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PhoneIcon className="h-5 w-5" />}
          title="Qoʻngʻiroq topilmadi"
          description="Filtrni oʻzgartiring yoki yangi qoʻngʻiroq qayd eting."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3">Yoʻnalish</th>
                  <th className="px-3 py-3">Kim bilan</th>
                  <th className="px-3 py-3">Bogʻlangan</th>
                  <th className="px-3 py-3">Davomiyligi</th>
                  <th className="px-3 py-3">Natija</th>
                  <th className="px-3 py-3">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 150).map((c) => {
                  const lead = c.leadId ? leadById.get(c.leadId) : null;
                  const student = c.studentId ? studentById.get(c.studentId) : null;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                        {c.at}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={c.direction === "kirish" ? "info" : "neutral"}>
                          {CALL_DIRECTION_LABELS[c.direction]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block font-medium text-foreground">{c.contactName}</span>
                        <span className="num block text-xs text-foreground-muted">{c.phone}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {lead ? (
                          <Link
                            href="/admin/lidlar"
                            className="focus-ring rounded text-brand-dark hover:underline"
                          >
                            Lid: {lead.childName}
                          </Link>
                        ) : student ? (
                          <Link
                            href={`/admin/oquvchilar?q=${encodeURIComponent(student.fullName)}`}
                            className="focus-ring rounded text-brand-dark hover:underline"
                          >
                            {student.fullName} ({student.className})
                          </Link>
                        ) : (
                          <span className="text-foreground-muted">—</span>
                        )}
                      </td>
                      <td className="num px-3 py-2.5 text-foreground-muted">
                        {Math.round(c.durationSec / 60)} daq
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={OUTCOME_TONE[c.outcome]}>
                          {CALL_OUTCOME_LABELS[c.outcome]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">{c.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            {rows.length > 150 && (
              <>
                Birinchi <span className="num">150</span> tasi koʻrsatildi (jami{" "}
                <span className="num">{rows.length}</span>) — hammasi CSV da.{" "}
              </>
            )}
            Har bir qoʻngʻiroq audit jurnaliga tushadi va oʻquvchi profilidagi
            tarixda koʻrinadi.
          </p>
        </div>
      )}
    </div>
  );
}

/** Lid yoki oʻquvchiga bogʻlanmagan qoʻngʻiroq. */
function ManualCall({ onDone }: { onDone: () => void }) {
  const dispatch = useAdminDispatch();
  const [phone, setPhone] = useState("+998 ");
  const [contactName, setContactName] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Kim bilan</span>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Ism yoki tashkilot"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Telefon</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="num h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </label>
      </div>

      {contactName.trim() && phone.trim().length > 8 ? (
        <CallForm
          phone={phone.trim()}
          contactName={contactName.trim()}
          onCancel={onDone}
          onSave={(call) => {
            dispatch({ type: "LOG_CALL", call });
            onDone();
          }}
        />
      ) : (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
          Ism va telefonni kiriting — keyin qoʻngʻiroq tafsilotlari ochiladi.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const valueClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}
