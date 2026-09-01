"use client";

import { useCallback, useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { AppealThread } from "@/components/shared/AppealThread";
import { messageOf } from "@/components/shared/LiveSession";
import { Badge } from "@/components/ui/Badge";
import {
  APPEAL_STATUS_LABELS,
  type AppealStatus,
  type AppealTarget,
} from "@/lib/contracts";
import {
  fetchAppeal,
  fetchAppeals,
  sendMessage,
  setStatus,
} from "@/lib/appeals/api";
import { isOpen, type Appeal } from "@/lib/school/appeals";

type Filter = "all" | AppealTarget;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "homeroom", label: "Sinf rahbari sifatida" },
  { id: "subject_teacher", label: "Fan oʻqituvchisi sifatida" },
];

const STATUS_TONE: Record<AppealStatus, "info" | "warning" | "success" | "neutral"> = {
  new: "info",
  in_review: "warning",
  answered: "success",
  closed: "neutral",
};

/**
 * Ustozga kelgan murojaatlar (MUR-01…MUR-06) — BAZADAN.
 *
 * Ikki rol bir sahifada: ustoz ham sinf rahbari, ham fan oʻqituvchisi
 * boʻlishi mumkin — filtr bilan ajratiladi. Kim nimani koʻrishi SERVERDA
 * hal boʻladi (`appeals_service._scope()`): roʻyxatda faqat shu ustozga
 * biriktirilgan yoki uning sinfiga tegishli murojaatlar keladi (7-qoida).
 */
export default function TeacherAppealsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selected, setSelected] = useState<Appeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAppeals(
        await fetchAppeals({ target: filter === "all" ? undefined : filter }),
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Yozishma roʻyxat soʻrovida kelmaydi — kartochka ochilganda alohida olinadi.
  async function open(appeal: Appeal) {
    if (selected?.id === appeal.id) {
      setSelected(null);
      return;
    }
    try {
      setSelected(await fetchAppeal(appeal.id));
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function reply(text: string) {
    if (!selected) return;
    try {
      await sendMessage(selected.id, text);
      setSelected(await fetchAppeal(selected.id));
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function close() {
    if (!selected) return;
    try {
      await setStatus(selected.id, "closed");
      setSelected(await fetchAppeal(selected.id));
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  const openCount = appeals.filter(isOpen).length;

  return (
    <TeacherShell
      title="Murojaatlar"
      subtitle={
        loading
          ? "Yuklanmoqda…"
          : `Sizga kelgan ${appeals.length} ta murojaat, ${openCount} tasi ochiq`
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setSelected(null);
            }}
            aria-pressed={filter === f.id}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === f.id
                ? "bg-brand text-brand-foreground"
                : "border border-border text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
      ) : appeals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Murojaat yoʻq</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Ota-onalardan xabar kelganda shu yerda koʻrinadi.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {appeals.map((appeal) => {
            const expanded = selected?.id === appeal.id;
            return (
              <li key={appeal.id}>
                <button
                  type="button"
                  onClick={() => void open(appeal)}
                  aria-expanded={expanded}
                  className={`focus-ring flex w-full items-start justify-between gap-3 rounded-xl border bg-surface p-3 text-left transition-colors hover:bg-surface-muted/50 ${
                    expanded ? "border-brand/40" : "border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {appeal.title}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">
                      {appeal.parentName} · {appeal.studentFullName} ({appeal.className})
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[appeal.status]}>
                      {APPEAL_STATUS_LABELS[appeal.status]}
                    </Badge>
                    <span className="text-[11px] text-foreground-muted">
                      {appeal.createdAt}
                    </span>
                  </div>
                </button>
                {expanded && selected && (
                  <div className="mt-2">
                    <AppealThread
                      appeal={selected}
                      viewer="staff"
                      defaultOpen
                      showCounterparty={false}
                      onSend={(text) => void reply(text)}
                      onClose={() => void close()}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </TeacherShell>
  );
}
