"use client";

/**
 * Dars rejalari — BAZADAN.
 *
 * Ustoz topshirgan tematik reja ustidan nazorat: topshirildi →
 * tasdiqlandi / qaytarildi. Qaytarishda sabab MAJBURIY — sababsiz
 * «qaytarildi» ustozga hech narsa demaydi. Rejaning fayli R2 moduli
 * bilan keladi; hozircha holat kuzatiladi.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ClipboardIcon, PlusIcon } from "@/components/ui/icons";
import {
  createPlan,
  fetchPlans,
  PLAN_STATUS_LABELS,
  setPlanStatus,
  type PlanOut,
} from "@/lib/exams/api";
import { apiXato, fetchStaff, useSchoolDirectory, type StaffOut } from "@/lib/school/api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

const STATUS_TONES: Record<string, "info" | "success" | "warning"> = {
  topshirildi: "info",
  tasdiqlandi: "success",
  qaytarildi: "warning",
};

export function PlansBoard() {
  const dir = useSchoolDirectory();
  const [plans, setPlans] = useState<PlanOut[] | null>(null);
  const [teachers, setTeachers] = useState<StaffOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const [form, setForm] = useState({
    teacher_id: "",
    subject_id: "",
    class_id: "",
    period: "1-chorak",
  });

  const yukla = useCallback(async () => {
    try {
      const [p, staff] = await Promise.all([fetchPlans(), fetchStaff()]);
      setPlans(p);
      setTeachers(
        staff.filter(
          (s) => s.is_active && (s.roles.includes("teacher") || s.roles.includes("homeroom_teacher")),
        ),
      );
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Rejalarni olib boʻlmadi."));
      setPlans([]);
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
          <h1 className="text-h2 font-bold text-foreground">Dars rejalari</h1>
          <p className="text-sm text-foreground-muted">
            Tematik rejalar nazorati — qaytarishda sabab majburiy
          </p>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" />
          Reja roʻyxatga olish
        </button>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.teacher_id || !form.subject_id || !form.class_id) return;
            void amal(async () => {
              await createPlan(form);
              setAdding(false);
            });
          }}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Ustoz</span>
            <select
              value={form.teacher_id}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Tanlang…</option>
              {teachers.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Fan</span>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Tanlang…</option>
              {dir.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
            <select
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Tanlang…</option>
              {dir.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Davr</span>
            <input
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value.slice(0, 40) })}
              placeholder="Masalan, 1-chorak"
              className={inputClass}
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setAdding(false)} className={ghostBtn}>
              Bekor qilish
            </button>
            <button type="submit" disabled={busy} className={primaryBtn}>
              Roʻyxatga olish
            </button>
          </div>
        </form>
      )}

      {plans === null ? (
        <ListSkeleton count={4} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title="Reja yoʻq"
          description="Ustoz reja topshirganda shu yerda roʻyxatga olinadi."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {plans.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{p.teacher_name}</p>
                  <p className="mt-0.5 text-sm text-foreground-muted">
                    {p.subject_name} · {p.class_name} · {p.period}
                  </p>
                  {p.comment && (
                    <p className="mt-1 text-xs text-warning">Sabab: {p.comment}</p>
                  )}
                </div>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[p.status] ?? "info"}>
                    {PLAN_STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                  {p.status === "topshirildi" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void amal(() => setPlanStatus(p.id, "tasdiqlandi"))}
                        className={primaryBtn}
                      >
                        Tasdiqlash
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setReturning(returning === p.id ? null : p.id);
                          setReason("");
                        }}
                        className={ghostBtn}
                      >
                        Qaytarish
                      </button>
                    </>
                  )}
                </span>
              </div>

              {returning === p.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reason.trim().length < 3) return;
                    void amal(async () => {
                      await setPlanStatus(p.id, "qaytarildi", reason.trim());
                      setReturning(null);
                    });
                  }}
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
                >
                  <label className="min-w-[14rem] flex-1">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      Qaytarish sababi
                    </span>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value.slice(0, 300))}
                      placeholder="Masalan, mavzular soatlarga mos emas"
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={reason.trim().length < 3 || busy}
                    className={primaryBtn}
                  >
                    Qaytarish
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
