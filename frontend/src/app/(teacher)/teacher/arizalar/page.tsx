"use client";

/**
 * Sababli qoldirish arizalari — sinf rahbari ekrani (DAV-04).
 *
 * Sahifa ROL boʻyicha yopilmagan: fan ustozi ochsa ham roʻyxat boʻsh
 * chiqadi, chunki server arizalarni koʻrish doirasi boʻyicha kesadi
 * (X-1). Har qatordagi `can_decide` ham serverdan keladi — bu yerda
 * qoida takrorlanmaydi (CLAUDE.md 7-qoida).
 *
 * Tasdiqlash oqibati ogohlantirish bilan koʻrsatiladi: u davomatni
 * oʻzgartiradi va bu qaytarilmaydi.
 */

import { useCallback, useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CheckIcon, ClipboardIcon, XIcon } from "@/components/ui/icons";
import {
  ABSENCE_STATUS_LABELS,
  decideAbsenceRequest,
  getAbsenceRequest,
  listAbsenceRequests,
  type AbsenceOut,
} from "@/lib/absence/api";

const TONE: Record<string, string> = {
  kutilmoqda: "bg-warning-tint text-warning",
  tasdiqlangan: "bg-success-tint text-success",
  rad_etilgan: "bg-danger-tint text-danger",
  bekor_qilingan: "bg-surface-muted text-foreground-muted",
};

const FILTRLAR = [
  { id: "kutilmoqda", label: "Koʻrib chiqilmoqda" },
  { id: "", label: "Hammasi" },
] as const;

const inputClass =
  "focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none";

const btnClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

export default function AbsenceRequestsPage() {
  const [filtr, setFiltr] = useState<string>("kutilmoqda");
  const [rows, setRows] = useState<AbsenceOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await listAbsenceRequests(filtr ? { status: filtr } : undefined));
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Arizalarni olib boʻlmadi.",
      );
      setRows([]);
    }
  }, [filtr]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TeacherShell
      title="Sababli qoldirish arizalari"
      subtitle="Ota-ona yuborgan ariza — tasdiqlansa, oʻsha kunlar «sababli» boʻladi"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTRLAR.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltr(f.id)}
              aria-pressed={filtr === f.id}
              className={`focus-ring h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                filtr === f.id
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-surface text-foreground hover:bg-surface-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState description={error} />
        ) : rows === null ? (
          <ListSkeleton count={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon className="h-5 w-5" />}
            title="Ariza yoʻq"
            description="Ota-ona oʻz kabinetidan sababli qoldirish arizasini yuborganda u shu yerda paydo boʻladi."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((a) => (
              <ArizaKarta key={a.id} ariza={a} onChanged={() => void load()} />
            ))}
          </ul>
        )}
      </div>
    </TeacherShell>
  );
}

function ArizaKarta({
  ariza,
  onChanged,
}: {
  ariza: AbsenceOut;
  onChanged: () => void;
}) {
  const [radEtish, setRadEtish] = useState(false);
  const [izoh, setIzoh] = useState("");
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [havola, setHavola] = useState<string | null>(null);

  async function qaror(approve: boolean) {
    if (busy) return;
    setBusy(true);
    setXato(null);
    try {
      await decideAbsenceRequest(ariza.id, approve, approve ? undefined : izoh.trim());
      onChanged();
    } catch (err) {
      setXato(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Saqlab boʻlmadi.",
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Ilova havolasi SOʻRALGANDA olinadi (X-7): roʻyxatda har qatorga
   * 15 daqiqalik kalit tarqatilmaydi.
   */
  async function ilovaniOch() {
    setXato(null);
    try {
      const toliq = await getAbsenceRequest(ariza.id);
      if (toliq.file_url) {
        setHavola(toliq.file_url);
        window.open(toliq.file_url, "_blank", "noopener");
      }
    } catch {
      setXato("Ilovani ochib boʻlmadi. Sahifani yangilab qayta urinib koʻring.");
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {ariza.student_name}
            {ariza.class_name && (
              <span className="ml-2 text-sm font-normal text-foreground-muted">
                {ariza.class_name}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-foreground-muted">
            {ariza.date_from === ariza.date_to
              ? ariza.date_from
              : `${ariza.date_from} — ${ariza.date_to}`}
            {" · "}
            {ariza.created_by_name}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            TONE[ariza.status] ?? TONE.bekor_qilingan
          }`}
        >
          {ABSENCE_STATUS_LABELS[ariza.status] ?? ariza.status}
        </span>
      </div>

      <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm">
        {ariza.reason}
      </p>

      {ariza.file_name && (
        <button
          type="button"
          onClick={() => void ilovaniOch()}
          className={`${btnClass} mt-3`}
        >
          <ClipboardIcon className="h-4 w-4" />
          Ilovani ochish: {ariza.file_name}
        </button>
      )}
      {havola && (
        <p className="mt-1.5 text-xs text-foreground-muted">
          Havola 15 daqiqa amal qiladi — undan keyin qayta bosing.
        </p>
      )}

      {ariza.decision_note && (
        <p className="mt-3 text-sm text-foreground-muted">
          <span className="font-medium">{ariza.decided_by_name}:</span>{" "}
          {ariza.decision_note}
        </p>
      )}

      {ariza.status === "tasdiqlangan" && (
        <p className="mt-3 text-sm text-success">
          {ariza.marked_lessons} ta dars «sababli» deb belgilandi.
        </p>
      )}

      {xato && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}

      {ariza.status === "kutilmoqda" && ariza.can_decide && (
        <div className="mt-4 border-t border-border pt-3">
          {radEtish ? (
            <div className="flex flex-col gap-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Rad etish sababi
                </span>
                <input
                  type="text"
                  value={izoh}
                  onChange={(e) => setIzoh(e.target.value)}
                  placeholder="Masalan: maʼlumotnoma ilova qilinmagan"
                  className={inputClass}
                  autoFocus
                />
              </label>
              <p className="text-xs text-foreground-muted">
                Sabab majburiy — u oilaga koʻrinadi va «rad etildi» oʻzi
                javob emas.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || izoh.trim().length < 3}
                  onClick={() => void qaror(false)}
                  className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-semibold text-brand-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XIcon className="h-4 w-4" />
                  Rad etishni tasdiqlash
                </button>
                <button
                  type="button"
                  onClick={() => setRadEtish(false)}
                  className={btnClass}
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-foreground-muted">
                Tasdiqlansa, {ariza.date_from}
                {ariza.date_to !== ariza.date_from && ` — ${ariza.date_to}`}{" "}
                oraligʻidagi darslar «sababli» deb belgilanadi. Ustoz «keldi»
                degan darslarga tegilmaydi.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void qaror(true)}
                  className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                  {busy ? "Saqlanmoqda…" : "Tasdiqlash"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRadEtish(true)}
                  className={btnClass}
                >
                  <XIcon className="h-4 w-4" />
                  Rad etish
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
