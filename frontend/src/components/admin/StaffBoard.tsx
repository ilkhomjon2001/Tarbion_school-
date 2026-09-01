"use client";

/**
 * Xodimlar — hisob ochish, fan biriktirish, parol tiklash (ADM-04).
 *
 * Maʼlumot serverdan (`/api/v1/school/staff`).
 *
 * Uchta narsa ataylab shunday:
 *
 * 1. **Login administrator tanlamaydi.** Tizim `familiya.ism` yasaydi.
 *    Takrorlansa raqam qoʻshiladi. Shu sabab formada login maydoni yoʻq.
 *
 * 2. **Parol bir marta koʻrsatiladi.** Bazada faqat xeshi bor — keyin
 *    tiklab boʻlmaydi, faqat yangisini berish mumkin. Shuning uchun
 *    javob alohida panelda, nusxa olish tugmasi bilan chiqadi.
 *
 * 3. **Oʻchirish yoʻq.** Ketgan xodim arxivlanadi — uning qoʻygan
 *    baholari va davomati hisobotda qolishi kerak (CLAUDE.md 1-qoida).
 */

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ConfirmArchiveButton } from "@/components/admin/ConfirmArchiveButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CheckIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { useAccess } from "@/lib/access-api";
import {
  STAFF_ROLES,
  apiXato,
  archiveStaff,
  createStaff,
  resetStaffPassword,
  setStaffSubjects,
  useSchoolDirectory,
  type StaffCreatedOut,
  type StaffOut,
  type SubjectOut,
} from "@/lib/school/api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryButtonClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostButtonClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  STAFF_ROLES.map((r) => [r.id, r.label]),
);

function roleLabel(id: string): string {
  return ROLE_LABELS[id] ?? (id === "superadmin" ? "Super administrator" : id);
}

export function StaffBoard() {
  const { subjects, staff, loading, error, reload } = useSchoolDirectory();
  const { can } = useAccess();
  const canCreate = can("users.create");
  const canManage = can("users.manage");
  const canReset = can("users.reset_password");

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<StaffCreatedOut | null>(null);
  const [reseted, setReseted] = useState<{ login: string; password: string } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.login.toLowerCase().includes(q) ||
        s.subjects.some((f) => f.toLowerCase().includes(q)),
    );
  }, [staff, query]);

  if (loading) return <ListSkeleton count={5} />;
  if (error) return <ErrorState description={error} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, login yoki fan boʻyicha qidirish"
            aria-label="Xodimlarni qidirish"
            className={`${inputClass} pl-8`}
          />
        </label>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setAdding((v) => !v);
              setCreated(null);
            }}
            className={primaryButtonClass}
          >
            <PlusIcon className="h-4 w-4" />
            Yangi xodim qoʻshish
          </button>
        )}
      </div>

      {created && (
        <CredentialsPanel
          title="Hisob ochildi"
          login={created.login}
          password={created.initial_password}
          fullName={created.full_name}
          onClose={() => setCreated(null)}
        />
      )}

      {reseted && (
        <CredentialsPanel
          title="Parol tiklandi"
          login={reseted.login}
          password={reseted.password}
          onClose={() => setReseted(null)}
        />
      )}

      {adding && canCreate && (
        <StaffForm
          subjects={subjects}
          onCancel={() => setAdding(false)}
          onCreated={(res) => {
            setCreated(res);
            setAdding(false);
            reload();
          }}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title={query ? "Hech kim topilmadi" : "Xodim yoʻq"}
          description={
            query
              ? "Boshqa ism yoki fan bilan qidirib koʻring."
              : "Ustoz, administrator va rahbariyat hisoblari shu yerda ochiladi."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Xodim</th>
                  <th className="px-3 py-3">Login</th>
                  <th className="px-3 py-3">Rollari</th>
                  <th className="px-3 py-3">Fanlari</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <StaffRow
                    key={row.user_id}
                    row={row}
                    subjects={subjects}
                    canManage={canManage}
                    canReset={canReset}
                    onChanged={reload}
                    onReset={(login, password) => setReseted({ login, password })}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Jami <span className="num font-medium text-foreground">{rows.length}</span> xodim.
            Ketgan xodim oʻchirilmaydi — arxivlanadi, uning baholari hisobotda qoladi.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Login va parol paneli ───────────────────────

/**
 * Parol bir marta koʻrsatiladi.
 *
 * Ekranga chiqarish — eng zaif joy, lekin muqobili yoʻq: parol bazada
 * xeshlangan va uni qayta oʻqib boʻlmaydi. Shuning uchun panel yopiq
 * tugma bilan va ogohlantirish bilan chiqadi.
 */
function CredentialsPanel({
  title,
  login,
  password,
  fullName,
  onClose,
}: {
  title: string;
  login: string;
  password: string;
  fullName?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Login: ${login}\nParol: ${password}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-xl border border-success/40 bg-success-tint p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-success">{title}</h3>
          {fullName && <p className="text-xs text-foreground-muted">{fullName}</p>}
        </div>
        <button type="button" onClick={onClose} className={ghostButtonClass}>
          Yopish
        </button>
      </div>

      <dl className="mt-3 flex flex-wrap gap-4">
        <div>
          <dt className="text-xs text-foreground-muted">Login</dt>
          <dd className="num text-base font-semibold text-foreground">{login}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Boshlangʻich parol</dt>
          <dd className="num text-base font-semibold tracking-widest text-foreground">
            {password}
          </dd>
        </div>
        <button type="button" onClick={copy} className={`${ghostButtonClass} self-end`}>
          {copied ? <CheckIcon className="h-4 w-4" /> : null}
          {copied ? "Nusxa olindi" : "Nusxa olish"}
        </button>
      </dl>

      <p className="mt-3 text-xs text-foreground-muted">
        Parol faqat shu yerda va faqat hozir koʻrinadi — bazada saqlanmaydi. Xodimga
        yetkazing: birinchi kirishda u yangi parol oʻrnatishga majbur boʻladi.
      </p>
    </section>
  );
}

// ─────────────────────── Yangi xodim formasi ───────────────────────

function StaffForm({
  subjects,
  onCancel,
  onCreated,
}: {
  subjects: SubjectOut[];
  onCancel: () => void;
  onCreated: (res: StaffCreatedOut) => void;
}) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<string[]>(["teacher"]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const ustozmi = roles.includes("teacher") || roles.includes("homeroom_teacher");
  const valid =
    lastName.trim().length > 0 && firstName.trim().length > 0 && roles.length > 0;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function submit() {
    setSaving(true);
    setXato(null);
    try {
      const res = await createStaff({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        phone: phone.trim() || null,
        roles,
        subject_ids: ustozmi ? subjectIds : [],
      });
      onCreated(res);
    } catch (err) {
      setXato(apiXato(err, "Hisob ochib boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Yangi xodim</h3>
      <p className="mb-3 text-xs text-foreground-muted">
        Login <span className="num">familiya.ism</span> shaklida avtomatik yasaladi. Parol
        hisob ochilgach bir marta koʻrsatiladi.
      </p>

      {xato && (
        <p className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">{xato}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Familiya</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value.slice(0, 80))}
            placeholder="Aliyev"
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Ism</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value.slice(0, 80))}
            placeholder="Anvar"
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Otasining ismi
          </span>
          <input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value.slice(0, 80))}
            placeholder="Rustamovich"
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Telefon</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 20))}
            placeholder="998901234567"
            inputMode="tel"
            className={`${inputClass} num`}
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-xs font-medium text-foreground">Rollari</legend>
        <div className="flex flex-wrap gap-1.5">
          {STAFF_ROLES.map((role) => {
            const on = roles.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                title={role.hint}
                aria-pressed={on}
                onClick={() => setRoles((r) => toggle(r, role.id))}
                className={`focus-ring rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "border-brand bg-brand-tint text-brand-dark"
                    : "border-border text-foreground-muted hover:bg-surface-muted"
                }`}
              >
                {role.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-foreground-muted">
          Rol nimani koʻrishini belgilaydi. Nima QILA olishini huquqlar belgilaydi —
          ular «Kirish huquqlari» boʻlimida beriladi.
        </p>
      </fieldset>

      {ustozmi && (
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-xs font-medium text-foreground">
            Oʻqitadigan fanlari
          </legend>
          {subjects.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Fanlar maʼlumotnomasi boʻsh — avval «Maʼlumot bazasi → Fanlar» boʻlimida fan
              qoʻshing.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((s) => {
                const on = subjectIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSubjectIds((v) => toggle(v, s.id))}
                    className={`focus-ring rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "border-brand bg-brand-tint text-brand-dark"
                        : "border-border text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!valid || saving}
          onClick={submit}
          className={primaryButtonClass}
        >
          {saving ? "Ochilmoqda…" : "Hisob ochish"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButtonClass}>
          Bekor qilish
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────── Xodim qatori ───────────────────────────

function StaffRow({
  row,
  subjects,
  canManage,
  canReset,
  onChanged,
  onReset,
}: {
  row: StaffOut;
  subjects: SubjectOut[];
  canManage: boolean;
  canReset: boolean;
  onChanged: () => void;
  onReset: (login: string, password: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(row.subject_ids);
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const ustozmi = row.roles.includes("teacher") || row.roles.includes("homeroom_teacher");

  async function saveSubjects() {
    setBusy(true);
    setXato(null);
    try {
      await setStaffSubjects(row.user_id, draft);
      setEditing(false);
      onChanged();
    } catch (err) {
      setXato(apiXato(err, "Fanlarni saqlab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setXato(null);
    try {
      const res = await resetStaffPassword(row.user_id);
      onReset(res.login, res.new_password);
    } catch (err) {
      setXato(apiXato(err, "Parolni tiklab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setXato(null);
    try {
      await archiveStaff(row.user_id);
      onChanged();
    } catch (err) {
      setXato(apiXato(err, "Arxivlab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-border align-top transition-colors last:border-0 hover:bg-surface-muted/50">
      <td className="px-3 py-2.5 font-medium text-foreground">
        {row.full_name}
        {!row.is_active && (
          <span className="ml-2">
            <Badge tone="warning">Faol emas</Badge>
          </span>
        )}
        {xato && <p className="mt-1 text-xs text-danger">{xato}</p>}
      </td>
      <td className="num px-3 py-2.5 text-foreground-muted">{row.login}</td>
      <td className="px-3 py-2.5">
        <span className="flex flex-wrap gap-1">
          {row.roles.map((r) => (
            <Badge key={r} tone="info">
              {roleLabel(r)}
            </Badge>
          ))}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {editing ? (
          <span className="flex flex-wrap gap-1">
            {subjects.map((s) => {
              const on = draft.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft((v) =>
                      v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id],
                    )
                  }
                  className={`focus-ring rounded border px-2 py-0.5 text-xs transition-colors ${
                    on
                      ? "border-brand bg-brand-tint text-brand-dark"
                      : "border-border text-foreground-muted"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </span>
        ) : row.subjects.length === 0 ? (
          <span className="text-xs text-foreground-muted">
            {ustozmi ? "Fan biriktirilmagan" : "—"}
          </span>
        ) : (
          <span className="text-foreground-muted">{row.subjects.join(", ")}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="flex flex-wrap justify-end gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={saveSubjects}
                className="focus-ring rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground disabled:opacity-50"
              >
                Saqlash
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(row.subject_ids);
                  setEditing(false);
                }}
                className="focus-ring rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted"
              >
                Bekor
              </button>
            </>
          ) : (
            <>
              {canManage && ustozmi && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark hover:underline"
                >
                  Fan biriktirish
                </button>
              )}
              {canReset && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={reset}
                  className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted hover:underline disabled:opacity-50"
                >
                  Parolni tiklash
                </button>
              )}
              {canManage && (
                <ConfirmArchiveButton
                  disabled={busy}
                  onConfirm={() => void archive()}
                  question="Xodim arxivlansinmi?"
                />
              )}
            </>
          )}
        </span>
      </td>
    </tr>
  );
}
