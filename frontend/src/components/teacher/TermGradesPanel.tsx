"use client";

/**
 * Chorak baholari (JUR-04).
 *
 * Bu boʻlim FAN USTOZIGA koʻrsatilmaydi — loyiha egasining qoidasi.
 * Frontend buni oʻzi hal qilmaydi: jurnal `shows_average` bayrogʻini
 * qaytaradi, chaqiruvchi shunga qarab boʻlimni chizadi. Server ham
 * aynan shu tekshiruvni qiladi va fan ustoziga `403` beradi
 * (CLAUDE.md 7-qoida — frontenddagi yashirish himoya emas).
 *
 * Ikkita ustun yonma-yon turadi:
 *   Hisoblangan — joriy baholardan vaznlar boʻyicha, jonli
 *   Chorak bahosi — yakunlangani; qoʻlda tuzatilgan boʻlsa belgisi bilan
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CheckIcon, PencilIcon, StarIcon, XIcon } from "@/components/ui/icons";
import {
  apiXato,
  fetchClassTermGrades,
  fetchCurrentTerms,
  finalizeTermGrades,
  setTermGrade,
  type ClassTermGradesOut,
  type TermGradeRowOut,
  type TermOut,
} from "@/lib/teacher/journal-api";

const inputClass =
  "focus-ring h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors";

const btnClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

const primaryBtnClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  classId: string;
  subjectId: string;
};

export function TermGradesPanel({ classId, subjectId }: Props) {
  const [terms, setTerms] = useState<TermOut[] | null>(null);
  const [termId, setTermId] = useState<string>("");
  const [data, setData] = useState<ClassTermGradesOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xabar, setXabar] = useState<string | null>(null);
  const [tuzatish, setTuzatish] = useState<string | null>(null);

  useEffect(() => {
    let bekor = false;
    void (async () => {
      try {
        const rows = await fetchCurrentTerms();
        if (bekor) return;
        setTerms(rows);
        // Sukut boʻyicha — bugungi kun tushadigan chorak, boʻlmasa oxirgisi.
        const bugun = new Date().toISOString().slice(0, 10);
        const joriy =
          rows.find((t) => t.starts_on <= bugun && bugun <= t.ends_on) ??
          rows[rows.length - 1];
        if (joriy) setTermId(joriy.id);
      } catch {
        if (!bekor) setTerms([]);
      }
    })();
    return () => {
      bekor = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!termId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchClassTermGrades({ classId, subjectId, termId }));
    } catch (err) {
      setError(apiXato(err, "Chorak baholarini olib boʻlmadi."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classId, subjectId, termId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function yakunla() {
    if (!termId) return;
    setXabar(null);
    try {
      const soni = await finalizeTermGrades({ classId, subjectId, termId });
      setXabar(
        soni === 0
          ? "Yangi baho yozilmadi — hammasi allaqachon joyida."
          : `${soni} ta oʻquvchining chorak bahosi yakunlandi.`,
      );
      await load();
    } catch (err) {
      setError(apiXato(err, "Yakunlab boʻlmadi."));
    }
  }

  if (terms !== null && terms.length === 0) {
    return (
      <EmptyState
        icon={<StarIcon className="h-5 w-5" />}
        title="Choraklar belgilanmagan"
        description="Chorak bahosi chorak sanalariga tayanadi. Administrator «Maʼlumotnomalar → Oʻquv yili» da choraklarni kiritsin."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Chorak</span>
          <select
            value={termId}
            onChange={(e) => {
              setTermId(e.target.value);
              setXabar(null);
            }}
            className={`${inputClass} min-w-[10rem]`}
          >
            {(terms ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {data?.can_edit && (
          <button type="button" onClick={() => void yakunla()} className={primaryBtnClass}>
            <CheckIcon className="h-4 w-4" />
            Chorakni yakunlash
          </button>
        )}
      </div>

      {xabar && (
        <p className="border-b border-border bg-success-tint px-4 py-2.5 text-sm text-success">
          {xabar}
        </p>
      )}

      {error ? (
        <div className="p-4">
          <ErrorState description={error} />
        </div>
      ) : loading || data === null ? (
        <div className="p-4">
          <ListSkeleton count={4} />
        </div>
      ) : (
        <div className="scroll-x">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Oʻquvchi</th>
                <th className="px-3 py-3 text-center">Hisoblangan</th>
                <th className="px-3 py-3 text-center">Chorak bahosi</th>
                {data.can_edit && <th className="px-3 py-3" />}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <TermRow
                  key={row.student_id}
                  row={row}
                  canEdit={data.can_edit}
                  open={tuzatish === row.student_id}
                  onOpen={() =>
                    setTuzatish(tuzatish === row.student_id ? null : row.student_id)
                  }
                  onSave={async (value, reason) => {
                    await setTermGrade({
                      studentId: row.student_id,
                      subjectId,
                      termId,
                      value,
                      reason,
                    });
                    setTuzatish(null);
                    await load();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
        Chorak bahosi vaznlar boʻyicha hisoblanadi: nazorat ishi joriy bahodan
        ogʻirroq. «Yakunlash» hisoblangan qiymatni chorak bahosi qilib yozadi —
        qoʻlda tuzatilganlarga tegmaydi. Har tuzatish sababi bilan audit
        jurnaliga tushadi.
      </p>
    </div>
  );
}

type RowProps = {
  row: TermGradeRowOut;
  canEdit: boolean;
  open: boolean;
  onOpen: () => void;
  onSave: (value: number, reason: string) => Promise<void>;
};

function TermRow({ row, canEdit, open, onOpen, onSave }: RowProps) {
  const [value, setValue] = useState<string>(String(row.final ?? row.computed ?? ""));
  const [reason, setReason] = useState("");
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const raqam = Number(value);
  const yaroqli =
    value.trim() !== "" &&
    Number.isInteger(raqam) &&
    raqam >= 0 &&
    raqam <= row.max_value &&
    reason.trim().length >= 3;

  async function saqla() {
    setSaqlanmoqda(true);
    setXato(null);
    try {
      await onSave(raqam, reason.trim());
      setReason("");
    } catch (err) {
      setXato(apiXato(err, "Saqlab boʻlmadi."));
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <>
      <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50">
        <td className="px-3 py-2 font-medium text-foreground">{row.full_name}</td>
        <td className="num px-3 py-2 text-center text-foreground-muted">
          {row.computed ?? "—"}
        </td>
        <td className="px-3 py-2 text-center">
          {row.final === null ? (
            <span className="text-foreground-muted/50">yakunlanmagan</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="num inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted font-semibold text-foreground">
                {row.final}
              </span>
              {row.is_manual && <Badge tone="warning">tuzatilgan</Badge>}
            </span>
          )}
        </td>
        {canEdit && (
          <td className="px-3 py-2 text-right">
            <button
              type="button"
              onClick={onOpen}
              aria-expanded={open}
              className={btnClass}
            >
              {open ? <XIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
              {open ? "Yopish" : "Tuzatish"}
            </button>
          </td>
        )}
      </tr>

      {open && canEdit && (
        <tr className="border-b border-border bg-surface-muted/40">
          <td colSpan={4} className="px-3 py-3">
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Chorak bahosi
                </span>
                <input
                  type="number"
                  min={0}
                  max={row.max_value}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={`${inputClass} w-24`}
                  autoFocus
                />
              </label>
              <label className="min-w-[16rem] flex-1">
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Tuzatish sababi
                </span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Masalan: olimpiadada 2-oʻrin"
                  className={`${inputClass} w-full`}
                />
              </label>
              <button
                type="button"
                disabled={!yaroqli || saqlanmoqda}
                onClick={() => void saqla()}
                className={primaryBtnClass}
              >
                <CheckIcon className="h-4 w-4" />
                {saqlanmoqda ? "Saqlanmoqda…" : "Chorak bahosini saqlash"}
              </button>
            </div>

            {row.is_manual && row.reason && (
              <p className="mt-2 text-xs text-foreground-muted">
                Oldingi sabab: {row.reason}
              </p>
            )}
            {xato && <p className="mt-2 text-xs text-danger">{xato}</p>}
            <p className="mt-2 text-xs text-foreground-muted">
              Sabab majburiy — u audit jurnalida qoladi va «nega 4 emas 5?»
              savoliga javob beradi.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
