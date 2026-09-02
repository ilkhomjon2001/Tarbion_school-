"use client";

import { SaveBar } from "@/components/ui/SaveBar";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchPermissionRegistry,
  fetchSections,
  fetchUsers,
  savePermissions,
  saveSections,
  type PermissionOut,
  type SectionOut,
  type UserAccessOut,
} from "@/lib/access-api";
import { SessionError } from "@/lib/session";

/**
 * Huquqlar markazi (T-005) — super administrator ekrani.
 *
 * Ikkita alohida narsa boshqariladi:
 *
 *   BOʻLIM — foydalanuvchi nimani KOʻRADI (menyudagi punkt)
 *   HUQUQ  — nima QILA OLADI (aniq amal)
 *
 * Ikkalasi ham serverda saqlanadi va serverda tekshiriladi. Bu ekran
 * faqat boshqaruv oynasi: bu yerda yashirish himoya emas
 * (CLAUDE.md 7-qoida).
 */

const CABINET_LABELS: Record<string, string> = {
  student: "Oʻquvchi",
  teacher: "Ustoz",
  parent: "Ota-ona",
  director: "Rahbariyat",
  academic: "Oʻquv boʻlimi",
  admin: "Administrator",
};

const ROLE_LABELS: Record<string, string> = {
  student: "Oʻquvchi",
  parent: "Ota-ona",
  teacher: "Ustoz",
  homeroom_teacher: "Sinf rahbari",
  academic: "Oʻquv boʻlimi",
  admin: "Administrator",
  director: "Rahbariyat",
  superadmin: "Super administrator",
};

export function AccessCenter() {
  const [sections, setSections] = useState<SectionOut[]>([]);
  const [registry, setRegistry] = useState<PermissionOut[]>([]);
  const [users, setUsers] = useState<UserAccessOut[]>([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const [s, p, u] = await Promise.all([
        fetchSections(),
        fetchPermissionRegistry(),
        fetchUsers(q || undefined),
      ]);
      setSections(s);
      setRegistry(p);
      setUsers(u);
    } catch (err) {
      setError(
        err instanceof SessionError && err.status === 403
          ? "Huquqlar markaziga kirish uchun ruxsatingiz yoʻq."
          : "Maʼlumotni yuklab boʻlmadi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Qidiruvda har harfda soʻrov yubormaslik uchun kechikish.
    const t = setTimeout(() => void load(query), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  /** Bitta foydalanuvchi yangilanganda roʻyxatdagi qatorni almashtiradi. */
  function replace(next: UserAccessOut) {
    setUsers((prev) => prev.map((u) => (u.user_id === next.user_id ? next : u)));
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Login yoki ism boʻyicha qidirish"
          aria-label="Foydalanuvchi qidirish"
          className="h-11 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
        <p className="text-sm text-foreground-muted">
          <span className="num font-medium text-foreground">{users.length}</span> foydalanuvchi
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">Foydalanuvchi topilmadi</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u.user_id}
              user={u}
              sections={sections}
              registry={registry}
              open={openId === u.user_id}
              onToggle={() => setOpenId(openId === u.user_id ? null : u.user_id)}
              onChange={replace}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UserRow({
  user,
  sections,
  registry,
  open,
  onToggle,
  onChange,
}: {
  user: UserAccessOut;
  sections: SectionOut[];
  registry: PermissionOut[];
  open: boolean;
  onToggle: () => void;
  onChange: (next: UserAccessOut) => void;
}) {
  const isSuperadmin = user.roles.includes("superadmin");
  const kabinetBolimlari = sections.filter((s) => s.cabinet === user.cabinet);

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{user.full_name}</span>
          <span className="block truncate text-xs text-foreground-muted">{user.login}</span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5">
          {user.roles.map((r) => (
            <span
              key={r}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                r === "superadmin"
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface-muted text-foreground-muted"
              }`}
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
          {user.customized && (
            <span className="rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-medium text-warning">
              Oʻzgartirilgan
            </span>
          )}
          {!user.is_active && (
            <span className="rounded-full bg-danger-tint px-2.5 py-0.5 text-xs font-medium text-danger">
              Faol emas
            </span>
          )}
        </span>

        <span className="num shrink-0 text-sm text-foreground-muted">
          {user.sections.length}/{kabinetBolimlari.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {isSuperadmin ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
              Super administrator barcha boʻlim va huquqlarga ega. Uni cheklab
              boʻlmaydi — aks holda u tizimni sozlay olmay qolardi.
            </p>
          ) : (
            <div className="space-y-5">
              <SectionPicker user={user} sections={kabinetBolimlari} onChange={onChange} />
              <PermissionPicker user={user} registry={registry} onChange={onChange} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function SectionPicker({
  user,
  sections,
  onChange,
}: {
  user: UserAccessOut;
  sections: SectionOut[];
  onChange: (next: UserAccessOut) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const serverdagi = useMemo(() => new Set(user.sections), [user.sections]);
  /** null — oʻzgarish yoʻq (serverdagi holat koʻrsatiladi). */
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const korsatilgan = draft ?? serverdagi;
  const ozgarishlar =
    draft === null
      ? 0
      : [...draft].filter((x) => !serverdagi.has(x)).length +
        [...serverdagi].filter((x) => !draft.has(x)).length;

  async function apply(next: string[] | null) {
    setSaving(true);
    setError(null);
    try {
      onChange(await saveSections(user.user_id, next));
      setDraft(null);
      setSavedAt(
        new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      setError(err instanceof SessionError ? err.message : "Saqlab boʻlmadi.");
    } finally {
      setSaving(false);
    }
  }

  /** Faqat qoralamani oʻzgartiradi — server «Saqlash»da (aniq nazorat). */
  function toggle(id: string) {
    const next = new Set(korsatilgan);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDraft(next);
    setSavedAt(null);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Boʻlimlar — {CABINET_LABELS[user.cabinet] ?? user.cabinet} kabineti
        </h3>
        {user.customized && (
          <button
            type="button"
            onClick={() => void apply(null)}
            disabled={saving}
            className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
          >
            Rol standartiga qaytarish
          </button>
        )}
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {sections.map((s) => {
          const checked = korsatilgan.has(s.id);
          const ozgargan = draft !== null && serverdagi.has(s.id) !== checked;
          return (
            <li key={s.id}>
              <label
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  s.locked
                    ? "cursor-not-allowed border-border bg-surface-muted/50 text-foreground-muted"
                    : ozgargan
                      ? "cursor-pointer border-brand/50 bg-brand-tint/25"
                      : "cursor-pointer border-border hover:bg-surface-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={s.locked || saving}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.locked && (
                  <span className="shrink-0 text-xs text-foreground-muted">
                    doimiy
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-2">
        <SaveBar
          ozgarishlar={ozgarishlar}
          busy={saving}
          savedAt={savedAt}
          xato={error}
          onSave={() => void apply([...korsatilgan])}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
        />
      </div>
    </div>
  );
}

function PermissionPicker({
  user,
  registry,
  onChange,
}: {
  user: UserAccessOut;
  registry: PermissionOut[];
  onChange: (next: UserAccessOut) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const serverdagi = useMemo(() => new Set(user.permissions), [user.permissions]);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const berilgan = draft ?? serverdagi;
  const ozgarishlar =
    draft === null
      ? 0
      : [...draft].filter((x) => !serverdagi.has(x)).length +
        [...serverdagi].filter((x) => !draft.has(x)).length;

  const guruhlar = useMemo(() => {
    const out = new Map<string, PermissionOut[]>();
    for (const p of registry) {
      const list = out.get(p.group) ?? [];
      list.push(p);
      out.set(p.group, list);
    }
    return [...out.entries()];
  }, [registry]);

  function toggle(code: string) {
    const next = new Set(berilgan);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setDraft(next);
    setSavedAt(null);
  }

  async function saqla() {
    setSaving(true);
    setError(null);
    try {
      onChange(await savePermissions(user.user_id, [...berilgan]));
      setDraft(null);
      setSavedAt(
        new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      setError(
        err instanceof SessionError ? err.message : "Huquqlarni saqlab boʻlmadi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">Huquqlar</h3>
      <p className="mb-2 text-xs text-foreground-muted">
        Boʻlim — nimani koʻradi. Huquq — nima qila oladi. Ikkovi alohida:
        bir xil boʻlimni koʻrgan ikki administratordan biri hisob ocha
        olishi, ikkinchisi yoʻqligi mumkin.
      </p>

      <div className="space-y-3">
        {guruhlar.map(([guruh, items]) => (
          <div key={guruh}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted/70">
              {guruh}
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {items.map((p) => (
                <li key={p.code}>
                  <label
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      draft !== null && serverdagi.has(p.code) !== berilgan.has(p.code)
                        ? "border-brand/50 bg-brand-tint/25"
                        : "border-border hover:bg-surface-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={berilgan.has(p.code)}
                      disabled={saving}
                      onChange={() => toggle(p.code)}
                      className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                    />
                    <span className="min-w-0 flex-1">{p.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <SaveBar
          sticky
          ozgarishlar={ozgarishlar}
          busy={saving}
          savedAt={savedAt}
          xato={error}
          onSave={() => void saqla()}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
        />
      </div>
    </div>
  );
}
