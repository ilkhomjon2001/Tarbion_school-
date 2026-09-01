"use client";

/**
 * Oʻquvchilar bazasi (ADM-05, ADM-06).
 *
 * Maʼlumot serverdan (`/api/v1/school/students`).
 *
 * Uchta narsa ataylab shunday:
 *
 * 1. **Qidiruv va filtr SERVERDA.** 362 oʻquvchini brauzerga tortib
 *    filtrlash mumkin edi, lekin maktab oʻsganda bu ishlamay qoladi.
 *    Server `limit` ni ham oʻzi cheklaydi.
 *
 * 2. **Roʻyxatda shaxsiy maʼlumot YOʻQ** (X-6). Tugʻilgan sana,
 *    telefon va vasiy faqat kartochkada — roʻyxat koʻproq odamga
 *    ochiq va eksport qilinadi.
 *
 * 3. **Oʻchirish tugmasi yoʻq.** Arxivlash bor va sabab majburiy:
 *    ketgan oʻquvchining baholari va toʻlovlari hisobotda qolishi
 *    kerak (CLAUDE.md 1-qoida).
 */

import { useCallback, useEffect, useState } from "react";

import { StudentCard } from "@/components/admin/StudentCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { useAccess } from "@/lib/access-api";
import {
  apiXato,
  createStudent,
  fetchClasses,
  fetchStudents,
  type ClassOut,
  type StudentListRowOut,
} from "@/lib/school/api";

type StatusFilter = "active" | "archived";

const STATUS_LABELS: Record<StatusFilter, string> = {
  active: "Faol",
  archived: "Arxivlangan",
};

const inputClass =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

export function StudentsBoard({ initialQuery = "" }: { initialQuery?: string }) {
  const { can } = useAccess();
  const canManage = can("students.manage");

  const [query, setQuery] = useState(initialQuery);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");

  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [rows, setRows] = useState<StudentListRowOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchClasses()
      .then((c) => alive && setClasses(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const yukla = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await fetchStudents({
          query: query.trim() || undefined,
          classId: classId || undefined,
          archived: status === "archived",
        }),
      );
    } catch (err) {
      setError(apiXato(err, "Oʻquvchilarni olib boʻlmadi."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query, classId, status]);

  // Qidiruv har harfda serverga bormasin.
  useEffect(() => {
    const t = setTimeout(() => void yukla(), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [yukla, query]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Oʻquvchilar</h1>
          <p className="text-sm text-foreground-muted">
            {loading ? (
              "Yuklanmoqda…"
            ) : (
              <>
                <span className="num font-medium text-foreground">{rows.length}</span> ta{" "}
                {STATUS_LABELS[status].toLowerCase()} oʻquvchi
              </>
            )}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className={primaryBtn}
          >
            <PlusIcon className="h-4 w-4" />
            Yangi oʻquvchi qabul qilish
          </button>
        )}
      </div>

      {adding && canManage && (
        <StudentForm
          classes={classes}
          onCancel={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            setOpenId(id);
            void yukla();
          }}
        />
      )}

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism yoki familiya boʻyicha qidirish…"
            aria-label="Oʻquvchi qidirish"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          aria-label="Sinf"
          className={inputClass}
        >
          <option value="">Barcha sinflar</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Holati"
          className={inputClass}
        >
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => (
            <option key={k} value={k}>
              {STATUS_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState description={error} />
      ) : loading ? (
        <ListSkeleton count={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title="Oʻquvchi topilmadi"
          description={
            query || classId
              ? "Qidiruv soʻzini yoki filtrni oʻzgartirib koʻring."
              : "Bu roʻyxat hozircha boʻsh."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {s.full_name}
                      {s.is_archived && (
                        <span className="ml-2">
                          <Badge tone="neutral">Arxivlangan</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {s.class_name ?? <span className="italic">sinfsiz</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenId(s.id)}
                        className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark hover:underline"
                      >
                        Kartochka
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Roʻyxatda tugʻilgan sana va vasiy telefoni koʻrsatilmaydi — ular
            kartochkada va faqat huquqi borga (X-6).
          </p>
        </div>
      )}

      {openId && (
        <StudentCard
          studentId={openId}
          classes={classes}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={yukla}
        />
      )}
    </div>
  );
}

// ─────────────────────── Yangi oʻquvchi ───────────────────────

function StudentForm({
  classes,
  onCancel,
  onCreated,
}: {
  classes: ClassOut[];
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [classId, setClassId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = lastName.trim().length > 1 && firstName.trim().length > 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const card = await createStudent({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        birth_date: birthDate || null,
        class_id: classId || null,
      });
      onCreated(card.id);
    } catch (err) {
      // Server bir xil ism va tugʻilgan sana boʻlsa `409` beradi —
      // takroriy qabulni ushlaydi.
      setError(apiXato(err, "Oʻquvchini qabul qilib boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Yangi oʻquvchi</h2>

      {error && (
        <p className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Familiya</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value.slice(0, 80))}
            placeholder="Abdullayev"
            className={`${inputClass} w-full`}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Ism</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value.slice(0, 80))}
            placeholder="Alisher"
            className={`${inputClass} w-full`}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Otasining ismi
          </span>
          <input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value.slice(0, 80))}
            className={`${inputClass} w-full`}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Tugʻilgan sana
          </span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={`${inputClass} w-full`}
          >
            <option value="">Hali biriktirilmagan</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-xs text-foreground-muted">
        Bir xil ism, familiya va tugʻilgan sana bilan oʻquvchi allaqachon boʻlsa server
        rad etadi — takroriy qabulning oldini oladi.
      </p>

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={!valid || saving} className={primaryBtn}>
          {saving ? "Qabul qilinmoqda…" : "Qabul qilish"}
        </button>
        <button type="button" onClick={onCancel} className={ghostBtn}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
