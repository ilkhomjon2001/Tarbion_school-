"use client";

/**
 * Maʼlumotnomalar (spravka) — BAZADAN.
 *
 * Ikki koʻrinish: navbat (yangi va kutishdagi soʻrovlar) va reyestr
 * (berilganlar). Berilgan hujjat OʻZGARMAYDI — raqami, kimga va qachon
 * berilgani saqlanadi, berish audit jurnaliga tushadi (X-13): bu bola
 * haqidagi maʼlumotning maktabdan chiqishi.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ConfirmArchiveButton } from "@/components/admin/ConfirmArchiveButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ClipboardIcon, PlusIcon } from "@/components/ui/icons";
import { buildDocumentText, fullDate, SCHOOL_NAME } from "@/lib/admin/documents";
import type { DocumentType } from "@/lib/admin/types";
import {
  archiveDocument,
  createDocumentRequest,
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  fetchQueue,
  fetchRegistry,
  issueDocument,
  setDocumentWaiting,
  type DocumentOut,
} from "@/lib/documents/api";
import { apiXato, fetchStudents, type StudentListRowOut } from "@/lib/school/api";

type Tab = "queue" | "registry";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

const STATUS_TONES: Record<string, "info" | "warning" | "success"> = {
  new: "info",
  waiting: "warning",
  issued: "success",
};

export function DocumentsBoard() {
  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<DocumentOut[] | null>(null);
  const [registry, setRegistry] = useState<DocumentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [issuing, setIssuing] = useState<DocumentOut | null>(null);

  const yukla = useCallback(async () => {
    try {
      const [q, r] = await Promise.all([fetchQueue(), fetchRegistry()]);
      setQueue(q);
      setRegistry(r);
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Maʼlumotnomalarni olib boʻlmadi."));
      setQueue([]);
      setRegistry([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function amal(f: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await f();
      await yukla();
    } catch (err) {
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Maʼlumotnomalar</h1>
          <p className="text-sm text-foreground-muted">
            Berilgan hujjat oʻzgarmaydi va reyestrda qoladi — berish audit jurnaliga tushadi
          </p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" />
          Yangi soʻrov
        </button>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      <div role="tablist" aria-label="Boʻlimlar" className="flex gap-1 border-b border-border">
        {(
          [
            ["queue", `Navbat${queue ? ` (${queue.length})` : ""}`],
            ["registry", "Reyestr"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "queue" &&
        (queue === null ? (
          <ListSkeleton count={4} />
        ) : queue.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon className="h-5 w-5" />}
            title="Navbat boʻsh"
            description="Yangi soʻrov «Yangi soʻrov» tugmasi bilan ochiladi."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {queue.map((d) => (
              <article
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {d.student_name}
                    <span className="ml-2 text-sm text-foreground-muted">
                      {d.class_name ?? "sinfsiz"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-foreground-muted">
                    {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                    {d.requested_by && ` · soʻradi: ${d.requested_by}`} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("uz-UZ")}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[d.status] ?? "info"}>
                    {DOC_STATUS_LABELS[d.status] ?? d.status}
                  </Badge>
                  {d.status === "new" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void amal(() => setDocumentWaiting(d.id))}
                      className={ghostBtn}
                    >
                      Kutishga
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setIssuing(d)}
                    className={primaryBtn}
                  >
                    Berish
                  </button>
                  <ConfirmArchiveButton
                    disabled={busy}
                    onConfirm={() => void amal(() => archiveDocument(d.id))}
                    label="Bekor"
                    question="Soʻrov olib tashlansinmi?"
                    className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:opacity-40"
                  />
                </span>
              </article>
            ))}
          </div>
        ))}

      {tab === "registry" &&
        (registry === null ? (
          <ListSkeleton count={4} />
        ) : registry.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon className="h-5 w-5" />}
            title="Reyestr boʻsh"
            description="Berilgan maʼlumotnomalar shu yerda roʻyxatga olinadi."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="scroll-x">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-3">Raqam</th>
                    <th className="px-3 py-3">Oʻquvchi</th>
                    <th className="px-3 py-3">Turi</th>
                    <th className="px-3 py-3">Kimga</th>
                    <th className="px-3 py-3">Berildi</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="num px-3 py-2.5 font-medium text-foreground">{d.number}</td>
                      <td className="px-3 py-2.5 text-foreground">
                        {d.student_name}
                        <span className="ml-1.5 text-xs text-foreground-muted">
                          {d.class_name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">{d.recipient ?? "—"}</td>
                      <td className="num px-3 py-2.5 text-foreground-muted">
                        {d.issued_at ? new Date(d.issued_at).toLocaleDateString("uz-UZ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {adding && (
        <NewRequestDialog
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            void yukla();
          }}
        />
      )}

      {issuing && (
        <IssueDialog
          doc={issuing}
          onClose={() => setIssuing(null)}
          onIssued={() => {
            setIssuing(null);
            setTab("registry");
            void yukla();
          }}
        />
      )}
    </div>
  );
}

/** Yangi soʻrov: oʻquvchi qidiruvdan tanlanadi, tur roʻyxatdan. */
function NewRequestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentListRowOut[]>([]);
  const [studentId, setStudentId] = useState("");
  const [docType, setDocType] = useState("oquv_joyi");
  const [requestedBy, setRequestedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchStudents({ query: query || undefined })
        .then((rows) => {
          setStudents(rows.slice(0, 30));
          setStudentId((old) => (rows.some((r) => r.id === old) ? old : (rows[0]?.id ?? "")));
        })
        .catch(() => setError("Oʻquvchilarni olib boʻlmadi."));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function yarat(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    setBusy(true);
    setError(null);
    try {
      await createDocumentRequest(studentId, docType, requestedBy.trim());
      onCreated();
    } catch (err) {
      setError(apiXato(err, "Soʻrovni ochib boʻlmadi."));
      setBusy(false);
    }
  }

  return (
    <Dialog title="Yangi soʻrov" onClose={onClose}>
      <form onSubmit={yarat} className="flex flex-col gap-3">
        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Oʻquvchi</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Familiya boʻyicha qidirish…"
            className={inputClass}
          />
        </label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          aria-label="Oʻquvchini tanlash"
          size={5}
          className="w-full rounded-lg border border-border bg-surface p-1 text-sm outline-none focus-visible:border-brand"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} — {s.class_name ?? "sinfsiz"}
            </option>
          ))}
        </select>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Hujjat turi</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className={inputClass}
          >
            {Object.entries(DOC_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Kim soʻradi</span>
          <input
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value.slice(0, 120))}
            placeholder="Masalan, Otasi (tel. orqali)"
            className={inputClass}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Bekor qilish
          </button>
          <button type="submit" disabled={!studentId || busy} className={primaryBtn}>
            Soʻrovni ochish
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Berish: matn oldindan koʻrinadi, «Berish» bosilgach raqam olinadi. */
function IssueDialog({
  doc,
  onClose,
  onIssued,
}: {
  doc: DocumentOut;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [copies, setCopies] = useState(1);
  const [extraText, setExtraText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<DocumentOut | null>(null);

  const koriladigan = issued ?? doc;
  const matn = useMemo(
    () =>
      buildDocumentText(koriladigan.doc_type as DocumentType, {
        student: {
          fullName: koriladigan.student_name,
          birthYear: koriladigan.birth_year ?? "—",
          className: koriladigan.class_name ?? "—",
        },
        academicYear: "2026–2027",
        recipient: issued ? (issued.recipient ?? "") : recipient,
        extraText: issued ? (issued.extra_text ?? "") : extraText,
      }),
    [koriladigan, recipient, extraText, issued],
  );

  async function ber() {
    setBusy(true);
    setError(null);
    try {
      setIssued(
        await issueDocument(doc.id, { recipient: recipient.trim(), copies, extraText }),
      );
    } catch (err) {
      setError(apiXato(err, "Berib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={issued ? `Berildi — ${issued.number}` : "Hujjatni berish"} onClose={issued ? onIssued : onClose}>
      <div className="flex flex-col gap-3">
        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

        {!issued && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Qayerga taqdim etiladi
              </span>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.slice(0, 200))}
                placeholder="Masalan, Ish joyiga"
                className={inputClass}
              />
            </label>
            <span className="flex gap-2">
              <label className="block w-24">
                <span className="mb-1.5 block text-xs font-medium text-foreground">Nusxa</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className={`${inputClass} num`}
                />
              </label>
              <label className="block flex-1">
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Qoʻshimcha matn
                </span>
                <input
                  value={extraText}
                  onChange={(e) => setExtraText(e.target.value.slice(0, 500))}
                  className={inputClass}
                />
              </label>
            </span>
          </>
        )}

        <div className="rounded-lg border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed text-foreground">
          <p className="mb-2 text-center font-semibold">{SCHOOL_NAME}</p>
          <p className="mb-3 text-center text-xs uppercase tracking-wide text-foreground-muted">
            Maʼlumotnoma {issued?.number && `№ ${issued.number}`}
          </p>
          {matn.map((xatboshi) => (
            <p key={xatboshi} className="mb-2 indent-6">
              {xatboshi}
            </p>
          ))}
          {issued?.issued_at && (
            <p className="mt-3 text-xs text-foreground-muted">
              Berilgan sana: {fullDate(issued.issued_at)}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {issued ? (
            <>
              <button type="button" onClick={() => window.print()} className={ghostBtn}>
                Chop etish
              </button>
              <button type="button" onClick={onIssued} className={primaryBtn}>
                Yopish
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className={ghostBtn}>
                Bekor qilish
              </button>
              <button type="button" disabled={busy} onClick={() => void ber()} className={primaryBtn}>
                Berish va raqam olish
              </button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-xl bg-surface p-4 shadow-xl sm:rounded-xl"
      >
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  );
}
