"use client";

/**
 * Lidlar — BAZADAN (CRM voronkasi).
 *
 * Roʻyxat, status filtri, qidiruv, yangi lid formasi. Qator ochilganda
 * yon panelda: maʼlumotlar, qoʻngʻiroqlar tarixi, qoʻngʻiroq yozish va
 * holatni oʻzgartirish. «Qabul qilindi» yopiq holat — undan qaytish
 * yoʻq (serverda 409); oʻquvchini yaratish Qabul boʻlimida qilinadi.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ConfirmArchiveButton } from "@/components/admin/ConfirmArchiveButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PhoneIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import {
  addCall,
  archiveLead,
  CLOSED_STATUSES,
  createLead,
  fetchLeadCalls,
  fetchLeads,
  formatCallTime,
  RESULT_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  updateLead,
  type LeadCallOut,
  type LeadOut,
} from "@/lib/crm/api";
import { apiXato } from "@/lib/school/api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

const STATUS_TONES: Record<string, "brand" | "success" | "warning" | "danger" | "info" | "neutral"> =
  {
    yangi: "info",
    aloqada: "brand",
    tashrif: "warning",
    qabul_qilindi: "success",
    yo_qoldi: "neutral",
  };

export function LeadsBoard() {
  const [leads, setLeads] = useState<LeadOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    try {
      const rows = await fetchLeads({ status: status || undefined, q: q || undefined });
      setLeads(rows);
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Lidlar roʻyxatini olib boʻlmadi."));
      setLeads([]);
    }
  }, [status, q]);

  // Qidiruv yozib boʻlingach 300 ms kutib soʻraladi — har harfda emas.
  useEffect(() => {
    const t = setTimeout(() => void yukla(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [yukla, q]);

  const opened = leads?.find((l) => l.id === openedId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Lidlar</h1>
          <p className="text-sm text-foreground-muted">
            Qiziqish bildirgan oilalar va ular bilan aloqa bosqichlari.
          </p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" /> Yangi lid
        </button>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ism yoki telefon boʻyicha qidirish"
            aria-label="Lidlarni qidirish"
            className={`${inputClass} pl-8`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Holat boʻyicha filtr"
          className={`${inputClass} w-auto`}
        >
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {leads === null ? (
        <ListSkeleton count={6} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<PhoneIcon className="h-5 w-5" />}
          title={q || status ? "Hech narsa topilmadi" : "Hozircha lid yoʻq"}
          description={
            q || status
              ? "Qidiruv yoki filtr shartini oʻzgartirib koʻring."
              : "Birinchi murojaatni «Yangi lid» tugmasi bilan kiriting."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Ota-ona</th>
                  <th className="px-3 py-3">Telefon</th>
                  <th className="px-3 py-3">Bola</th>
                  <th className="px-3 py-3">Manba</th>
                  <th className="px-3 py-3">Holat</th>
                  <th className="px-3 py-3">Masʼul</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setOpenedId(l.id)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{l.parent_name}</td>
                    <td className="num px-3 py-2.5 text-foreground-muted">{l.phone}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {l.child_name || "—"}
                      {l.child_birth_year ? ` (${l.child_birth_year})` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {SOURCE_LABELS[l.source] ?? l.source}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS_TONES[l.status] ?? "neutral"}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {l.assigned_to_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adding && (
        <NewLeadDrawer
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void yukla();
          }}
        />
      )}

      {opened && (
        <LeadDrawer
          lead={opened}
          onClose={() => setOpenedId(null)}
          onChanged={() => void yukla()}
        />
      )}
    </div>
  );
}

function NewLeadDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    parent_name: "",
    phone: "",
    child_name: "",
    child_birth_year: "",
    source: "boshqa",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    if (!form.parent_name.trim() || !form.phone.trim()) {
      setError("Ota-ona ismi va telefon raqami majburiy.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createLead({
        parent_name: form.parent_name.trim(),
        phone: form.phone.trim(),
        child_name: form.child_name.trim() || null,
        child_birth_year: form.child_birth_year ? Number(form.child_birth_year) : null,
        source: form.source,
        note: form.note.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(apiXato(err, "Lidni saqlab boʻlmadi."));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Yangi lid"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto bg-surface p-4 shadow-xl"
      >
        <h2 className="text-base font-semibold text-foreground">Yangi lid</h2>
        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={saqla} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Ota-ona ismi</span>
            <input
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value.slice(0, 120) })}
              placeholder="Masalan, Rustamova Nilufar"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Telefon</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.slice(0, 20) })}
              placeholder="+998 90 123 45 67"
              inputMode="tel"
              className={`${inputClass} num`}
            />
          </label>
          <span className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Bola ismi</span>
              <input
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value.slice(0, 120) })}
                className={inputClass}
              />
            </label>
            <label className="block w-28">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Tugʻilgan yil
              </span>
              <input
                type="number"
                min={1990}
                max={2030}
                value={form.child_birth_year}
                onChange={(e) => setForm({ ...form, child_birth_year: e.target.value })}
                className={`${inputClass} num`}
              />
            </label>
          </span>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Manba</span>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className={inputClass}
            >
              {Object.entries(SOURCE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Izoh</span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 500) })}
              placeholder="Masalan, 5-sinfga qiziqdi"
              className={inputClass}
            />
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={ghostBtn}>
              Bekor qilish
            </button>
            <button type="submit" disabled={busy} className={primaryBtn}>
              Lidni saqlash
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onChanged,
}: {
  lead: LeadOut;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [calls, setCalls] = useState<LeadCallOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [callForm, setCallForm] = useState({ result: "javob_berdi", note: "" });

  const closed = CLOSED_STATUSES.has(lead.status);

  const yuklaCalls = useCallback(async () => {
    try {
      setCalls(await fetchLeadCalls(lead.id));
    } catch (err) {
      setError(apiXato(err, "Qoʻngʻiroqlar tarixini olib boʻlmadi."));
      setCalls([]);
    }
  }, [lead.id]);

  useEffect(() => {
    void yuklaCalls();
  }, [yuklaCalls]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function holatniOzgartir(status: string) {
    setBusy(true);
    setError(null);
    try {
      await updateLead(lead.id, { status });
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Holatni oʻzgartirib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function qongiroqYoz(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addCall(lead.id, {
        result: callForm.result,
        note: callForm.note.trim() || null,
      });
      setCallForm({ result: "javob_berdi", note: "" });
      await yuklaCalls();
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Qoʻngʻiroqni yozib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function arxivla() {
    setBusy(true);
    setError(null);
    try {
      await archiveLead(lead.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(apiXato(err, "Arxivlab boʻlmadi."));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Lid maʼlumotlari"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[440px] flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">{lead.parent_name}</h2>
            <p className="num text-sm text-foreground-muted">{lead.phone}</p>
          </div>
          <Badge tone={STATUS_TONES[lead.status] ?? "neutral"}>
            {STATUS_LABELS[lead.status] ?? lead.status}
          </Badge>
        </div>

        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border bg-surface-muted/40 p-3 text-sm">
          <dt className="text-foreground-muted">Bola</dt>
          <dd className="text-foreground">
            {lead.child_name || "—"}
            {lead.child_birth_year ? ` (${lead.child_birth_year})` : ""}
          </dd>
          <dt className="text-foreground-muted">Manba</dt>
          <dd className="text-foreground">{SOURCE_LABELS[lead.source] ?? lead.source}</dd>
          <dt className="text-foreground-muted">Masʼul</dt>
          <dd className="text-foreground">{lead.assigned_to_name || "—"}</dd>
          <dt className="text-foreground-muted">Kiritilgan</dt>
          <dd className="num text-foreground">{formatCallTime(lead.created_at)}</dd>
          {lead.note && (
            <>
              <dt className="text-foreground-muted">Izoh</dt>
              <dd className="text-foreground">{lead.note}</dd>
            </>
          )}
        </dl>

        {/* Holatni oʻzgartirish */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Holat</h3>
          {closed ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
              Bu lid yopilgan — holat qaytarilmaydi. Yangi murojaat boʻlsa, yangi lid oching.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_LABELS)
                .filter(([id]) => id !== lead.status && id !== "yangi")
                .map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    onClick={() => void holatniOzgartir(id)}
                    className={ghostBtn}
                  >
                    {label}
                  </button>
                ))}
            </div>
          )}
          {lead.status === "qabul_qilindi" && (
            <p className="mt-2 rounded-lg bg-success-tint px-3 py-2 text-xs text-success">
              Oila qabul qilindi.{" "}
              <Link href="/admin/qabul" className="font-semibold underline">
                Qabul boʻlimida oʻquvchi yozuvini oching →
              </Link>
            </p>
          )}
        </div>

        {/* Qoʻngʻiroq yozish */}
        {!closed && (
          <form onSubmit={qongiroqYoz} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">Qoʻngʻiroq yozish</h3>
            <span className="flex gap-2">
              <select
                value={callForm.result}
                onChange={(e) => setCallForm({ ...callForm, result: e.target.value })}
                aria-label="Qoʻngʻiroq natijasi"
                className={inputClass}
              >
                {Object.entries(RESULT_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy} className={primaryBtn}>
                Yozish
              </button>
            </span>
            <input
              value={callForm.note}
              onChange={(e) => setCallForm({ ...callForm, note: e.target.value.slice(0, 500) })}
              placeholder="Izoh (ixtiyoriy)"
              aria-label="Qoʻngʻiroq izohi"
              className={inputClass}
            />
          </form>
        )}

        {/* Qoʻngʻiroqlar tarixi */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Qoʻngʻiroqlar tarixi{calls ? ` (${calls.length})` : ""}
          </h3>
          {calls === null ? (
            <ListSkeleton count={2} />
          ) : calls.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
              Hali qoʻngʻiroq yozilmagan.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {calls.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {RESULT_LABELS[c.result] ?? c.result}
                    </span>
                    <span className="num text-xs text-foreground-muted">
                      {formatCallTime(c.called_at)}
                    </span>
                  </div>
                  {c.note && <p className="mt-0.5 text-xs text-foreground-muted">{c.note}</p>}
                  {c.created_by_name && (
                    <p className="mt-0.5 text-xs text-foreground-muted/80">
                      {c.created_by_name}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <ConfirmArchiveButton
            onConfirm={() => void arxivla()}
            disabled={busy}
            question="Lid roʻyxatdan olinsinmi?"
          />
          <button type="button" onClick={onClose} className={ghostBtn}>
            Yopish
          </button>
        </div>
      </aside>
    </div>
  );
}
