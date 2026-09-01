"use client";

/**
 * Kadrlar — BAZADAN.
 *
 * Xodimlar roʻyxati (lavozim, shartnoma, toifa, oylik, taʼtil belgisi)
 * va taʼtillar. Oylik oʻzgarishi serverda audit_log ga tushadi.
 *
 * Boʻsh ish oʻrinlari boʻlimi olib tashlandi — TZ'da yoʻq va bazasi
 * ham yoʻq; kerak boʻlsa alohida soʻraladi. Ishdan ketish — xodim
 * hisobini arxivlash (Sozlamalar → Xodimlar).
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { UsersIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import {
  addLeave,
  archiveLeave,
  CONTRACT_LABELS,
  fetchEmployees,
  fetchLeaves,
  LEAVE_LABELS,
  QUALIFICATION_LABELS,
  updateProfile,
  type EmployeeOut,
  type LeaveOut,
} from "@/lib/hr/api";
import { apiXato } from "@/lib/school/api";

type Tab = "employees" | "leaves";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

export function HrBoard() {
  const [tab, setTab] = useState<Tab>("employees");
  const [employees, setEmployees] = useState<EmployeeOut[] | null>(null);
  const [leaves, setLeaves] = useState<LeaveOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmployeeOut | null>(null);

  const yukla = useCallback(async () => {
    try {
      const [e, l] = await Promise.all([fetchEmployees(), fetchLeaves()]);
      setEmployees(e);
      setLeaves(l);
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Kadrlar maʼlumotini olib boʻlmadi."));
      setEmployees([]);
      setLeaves([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Kadrlar</h1>
        <p className="text-sm text-foreground-muted">
          Lavozim, shartnoma va taʼtillar. Oylik oʻzgarishi audit jurnaliga tushadi.
        </p>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      <div role="tablist" aria-label="Boʻlimlar" className="flex gap-1 border-b border-border">
        {(
          [
            ["employees", `Xodimlar${employees ? ` (${employees.length})` : ""}`],
            ["leaves", `Taʼtillar${leaves ? ` (${leaves.length})` : ""}`],
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

      {tab === "employees" &&
        (employees === null ? (
          <ListSkeleton count={5} />
        ) : employees.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-5 w-5" />} title="Xodim yoʻq" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="scroll-x">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-3">Xodim</th>
                    <th className="px-3 py-3">Lavozim</th>
                    <th className="px-3 py-3">Shartnoma</th>
                    <th className="px-3 py-3">Toifa</th>
                    <th className="px-3 py-3">Ishga kirgan</th>
                    <th className="px-3 py-3 text-right">Oylik</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr
                      key={e.user_id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-foreground">{e.full_name}</span>
                        {e.on_leave && (
                          <span className="ml-2">
                            <Badge tone="warning">{LEAVE_LABELS[e.on_leave] ?? "Taʼtilda"}</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">{e.position || "—"}</td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        {CONTRACT_LABELS[e.contract_type] ?? e.contract_type}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        {QUALIFICATION_LABELS[e.qualification] ?? e.qualification}
                      </td>
                      <td className="num px-3 py-2.5 text-foreground-muted">
                        {e.hired_on ?? "—"}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-foreground">
                        {e.base_salary === null ? "—" : formatSom(e.base_salary)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(e)}
                          className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark hover:underline"
                        >
                          Tahrirlash
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
              Yangi xodim hisobi Sozlamalar → Xodimlar boʻlimida ochiladi; ishdan
              ketish — oʻsha yerda arxivlash.
            </p>
          </div>
        ))}

      {tab === "leaves" && (
        <LeavesTab
          leaves={leaves}
          employees={employees ?? []}
          onChanged={() => void yukla()}
          onError={setError}
        />
      )}

      {editing && (
        <ProfileDrawer
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void yukla();
          }}
        />
      )}
    </div>
  );
}

function ProfileDrawer({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeOut;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    position: employee.position,
    contract_type: employee.contract_type,
    qualification: employee.qualification,
    hired_on: employee.hired_on ?? "",
    base_salary: employee.base_salary === null ? "" : String(employee.base_salary),
    note: employee.note ?? "",
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
    setBusy(true);
    setError(null);
    try {
      await updateProfile(employee.user_id, {
        position: form.position.trim(),
        contract_type: form.contract_type,
        qualification: form.qualification,
        hired_on: form.hired_on || null,
        base_salary: form.base_salary === "" ? null : Number(form.base_salary),
        note: form.note.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(apiXato(err, "Saqlab boʻlmadi."));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Xodim profili"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto bg-surface p-4 shadow-xl"
      >
        <h2 className="text-base font-semibold text-foreground">{employee.full_name}</h2>
        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={saqla} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Lavozim</span>
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value.slice(0, 80) })}
              placeholder="Masalan, Matematika oʻqituvchisi"
              className={inputClass}
            />
          </label>
          <span className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Shartnoma</span>
              <select
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                className={inputClass}
              >
                {Object.entries(CONTRACT_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Toifa</span>
              <select
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                className={inputClass}
              >
                {Object.entries(QUALIFICATION_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </span>
          <span className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Ishga kirgan sana
              </span>
              <input
                type="date"
                value={form.hired_on}
                onChange={(e) => setForm({ ...form, hired_on: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Oylik (soʻm)
              </span>
              <input
                type="number"
                min={0}
                step={100000}
                value={form.base_salary}
                onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                placeholder="Kiritilmagan"
                className={`${inputClass} num`}
              />
            </label>
          </span>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Izoh</span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 300) })}
              className={inputClass}
            />
          </label>

          <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
            Oylik oʻzgartirilsa eski va yangi qiymat audit jurnaliga yoziladi.
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={ghostBtn}>
              Bekor qilish
            </button>
            <button type="submit" disabled={busy} className={primaryBtn}>
              Saqlash
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function LeavesTab({
  leaves,
  employees,
  onChanged,
  onError,
}: {
  leaves: LeaveOut[] | null;
  employees: EmployeeOut[];
  onChanged: () => void;
  onError: (m: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    leave_type: "tatil",
    starts_on: "",
    ends_on: "",
    note: "",
  });

  async function qosh(e: React.FormEvent) {
    e.preventDefault();
    if (!form.user_id || !form.starts_on || !form.ends_on) return;
    setBusy(true);
    onError(null);
    try {
      await addLeave({
        user_id: form.user_id,
        leave_type: form.leave_type,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        note: form.note.trim() || null,
      });
      setAdding(false);
      setForm({ user_id: "", leave_type: "tatil", starts_on: "", ends_on: "", note: "" });
      onChanged();
    } catch (err) {
      onError(apiXato(err, "Taʼtilni qoʻshib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function olibTashla(id: string) {
    setBusy(true);
    try {
      await archiveLeave(id);
      onChanged();
    } catch (err) {
      onError(apiXato(err, "Olib tashlab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setAdding((v) => !v)} className={primaryBtn}>
          Taʼtil qoʻshish
        </button>
      </div>

      {adding && (
        <form
          onSubmit={qosh}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Xodim</span>
            <select
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Tanlang…</option>
              {employees.map((x) => (
                <option key={x.user_id} value={x.user_id}>
                  {x.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Turi</span>
            <select
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
              className={inputClass}
            >
              {Object.entries(LEAVE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Boshlanishi</span>
            <input
              type="date"
              value={form.starts_on}
              onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Tugashi</span>
            <input
              type="date"
              value={form.ends_on}
              min={form.starts_on || undefined}
              onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
              className={inputClass}
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setAdding(false)} className={ghostBtn}>
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={busy || !form.user_id || !form.starts_on || !form.ends_on}
              className={primaryBtn}
            >
              Saqlash
            </button>
          </div>
        </form>
      )}

      {leaves === null ? (
        <ListSkeleton count={3} />
      ) : leaves.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title="Joriy taʼtillar yoʻq"
          description="Boshlanajak yoki davom etayotgan taʼtillar shu yerda koʻrinadi."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {leaves.map((lv) => (
            <article
              key={lv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-foreground">{lv.employee_name}</p>
                <p className="num mt-0.5 text-sm text-foreground-muted">
                  {LEAVE_LABELS[lv.leave_type] ?? lv.leave_type} · {lv.starts_on} — {lv.ends_on}
                  {lv.note && ` · ${lv.note}`}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void olibTashla(lv.id)}
                className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:opacity-40"
              >
                Olib tashlash
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
