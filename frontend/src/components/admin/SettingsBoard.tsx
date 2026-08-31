"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, SearchIcon } from "@/components/ui/icons";
import { AccessCenter } from "@/components/admin/AccessCenter";
import { StaffBoard } from "@/components/admin/StaffBoard";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
import type { SchoolSettings, UserAccount } from "@/lib/admin/types";
import {
  CABINET_LABELS,
  ROLE_DEFAULT_SECTIONS,
  SECTIONS,
  effectiveSections,
  sectionsOfCabinet,
  type Cabinet,
} from "@/lib/access";
import { ROLE_CABINET, ROLE_LABELS, ROLES, type UserRole } from "@/lib/roles";

type Tab = "staff" | "users" | "roles" | "school";

const TABS: { id: Tab; label: string }[] = [
  { id: "staff", label: "Xodimlar" },
  { id: "users", label: "Kirish huquqlari" },
  { id: "roles", label: "Rollar va huquqlar" },
  { id: "school", label: "Maktab" },
];

/**
 * Sozlamalar — faqat super administrator uchun.
 *
 * Uchta ish: kimga qaysi rol, kim qaysi boʻlimni koʻradi, maktabning
 * umumiy parametrlari. Boʻlim yashirish HIMOYA EMAS — backend ulanganda
 * har bir endpoint huquqni serverda tekshiradi (CLAUDE.md 7-qoida).
 */
export function SettingsBoard() {
  const [tab, setTab] = useState<Tab>("staff");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Sozlamalar</h1>
        <p className="text-sm text-foreground-muted">
          Xodim hisoblari, kirish huquqlari va maktabning umumiy parametrlari
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Sozlamalar boʻlimlari"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Foydalanuvchilar bandi HAQIQIY API bilan ishlaydi (T-005).
          Qolgan bandlar hali mock ustida. */}
      {tab === "staff" && <StaffBoard />}

      {tab === "users" && <AccessCenter />}
      {tab === "roles" && <RolesTab />}
      {tab === "school" && <SchoolTab />}

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
        Boʻlimni yashirish — qulaylik, himoya emas. Haqiqiy tekshiruv backend
        ulanganda serverda boʻladi: yashiringan boʻlim manzilini qoʻlda yozgan
        odam ham maʼlumotni ololmaydi.
      </p>
    </div>
  );
}

/* ─────────────────────── Foydalanuvchilar ─────────────────────── */

function UsersTab() {
  const { users, roleSections } = useAdmin();
  const dispatch = useAdminDispatch();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.login.includes(q) ||
        u.position.toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, login yoki lavozim boʻyicha…"
            aria-label="Foydalanuvchilarni qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          aria-label="Rol boʻyicha filtr"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Barcha rollar</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Foydalanuvchi</th>
                <th className="px-3 py-3">Login</th>
                <th className="px-3 py-3">Rol</th>
                <th className="px-3 py-3">Boʻlimlar</th>
                <th className="px-3 py-3">Holati</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const cabinet = ROLE_CABINET[user.role];
                const visible = effectiveSections(user.role, user.sections, roleSections).length;
                const total = sectionsOfCabinet(cabinet).filter(
                  (s) => !s.superadminOnly || user.role === "superadmin",
                ).length;
                const isOpen = openId === user.id;
                return (
                  <>
                    <tr
                      key={user.id}
                      className="border-b border-border transition-colors hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5">
                        <span className="block font-medium text-foreground">{user.fullName}</span>
                        <span className="block text-xs text-foreground-muted">
                          {user.position} · {user.lastSeen}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">{user.login}</td>
                      <td className="px-3 py-2.5">
                        <select
                          value={user.role}
                          disabled={user.role === "superadmin"}
                          onChange={(e) =>
                            dispatch({
                              type: "SET_USER_ROLE",
                              userId: user.id,
                              role: e.target.value as UserRole,
                            })
                          }
                          aria-label={`${user.fullName} roli`}
                          className="focus-ring h-9 rounded-lg border border-border bg-surface px-2 text-sm disabled:opacity-60"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="num text-foreground">
                          {visible}/{total}
                        </span>
                        {user.sections !== null && (
                          <span className="ml-1.5 text-xs text-warning">istisno</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={user.status === "active" ? "success" : "danger"}>
                          {user.status === "active" ? "Faol" : "Bloklangan"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenId(isOpen ? null : user.id)}
                            aria-expanded={isOpen}
                            className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:underline"
                          >
                            {isOpen ? "Yopish" : "Boʻlimlar"}
                          </button>
                          {user.role !== "superadmin" && (
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: "SET_USER_STATUS",
                                  userId: user.id,
                                  status: user.status === "active" ? "blocked" : "active",
                                })
                              }
                              className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger"
                            >
                              {user.status === "active" ? "Bloklash" : "Ochish"}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${user.id}-sections`}>
                        <td colSpan={6} className="bg-surface-muted/40 px-3 py-3">
                          <SectionPicker user={user} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Hisob oʻchirilmaydi — bloklanadi. Rol oʻzgartirilsa boʻlim istisnolari
          bekor qilinadi va yangi rolning standarti qoʻllanadi.
        </p>
      </div>
    </div>
  );
}

/** Bitta foydalanuvchi uchun boʻlim tanlagichi. */
function SectionPicker({ user }: { user: UserAccount }) {
  const { roleSections } = useAdmin();
  const dispatch = useAdminDispatch();

  const cabinet = ROLE_CABINET[user.role];
  const list = sectionsOfCabinet(cabinet).filter(
    (s) => !s.superadminOnly || user.role === "superadmin",
  );
  const current = new Set(effectiveSections(user.role, user.sections, roleSections));
  const custom = user.sections !== null;

  function toggle(id: string) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    dispatch({ type: "SET_USER_SECTIONS", userId: user.id, sections: [...next] });
  }

  return (
    <div className="animate-expand">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground-muted">
          {CABINET_LABELS[cabinet]} —{" "}
          {custom ? (
            <span className="text-warning">qoʻlda belgilangan</span>
          ) : (
            <span>rol boʻyicha standart</span>
          )}
        </p>
        {custom && (
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_USER_SECTIONS", userId: user.id, sections: null })}
            className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark hover:underline"
          >
            Rol standartiga qaytarish
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {list.map((section) => {
          const on = current.has(section.id);
          const locked = Boolean(section.locked);
          return (
            <label
              key={section.id}
              title={locked ? "Bu boʻlimni oʻchirib boʻlmaydi" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                locked
                  ? "cursor-not-allowed border-border bg-surface-muted text-foreground-muted"
                  : on
                    ? "cursor-pointer border-brand bg-brand-tint text-brand-dark"
                    : "cursor-pointer border-border text-foreground-muted hover:bg-surface"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={locked}
                onChange={() => toggle(section.id)}
              />
              {on && <CheckIcon aria-hidden className="h-3 w-3" />}
              {section.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── Rollar ─────────────────────── */

function RolesTab() {
  const { roleSections, users } = useAdmin();
  const dispatch = useAdminDispatch();

  const cabinets = Object.keys(CABINET_LABELS) as Cabinet[];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        Bu yerdagi belgilar — rol boʻyicha STANDART. Yangi foydalanuvchi shu
        huquqlarni oladi; alohida odam uchun istisno «Foydalanuvchilar»
        boʻlimida beriladi.
      </p>

      {cabinets.map((cabinet) => {
        const roles = ROLES.filter((r) => ROLE_CABINET[r] === cabinet);
        const list = sectionsOfCabinet(cabinet);
        return (
          <section
            key={cabinet}
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">
                {CABINET_LABELS[cabinet]}
              </h2>
              <p className="text-xs text-foreground-muted">
                <span className="num">
                  {users.filter((u) => ROLE_CABINET[u.role] === cabinet).length}
                </span>{" "}
                ta foydalanuvchi ·{" "}
                <span className="num">{list.length}</span> ta boʻlim
              </p>
            </div>

            <div className="scroll-x">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-2.5">Boʻlim</th>
                    {roles.map((r) => (
                      <th key={r} className="px-3 py-2.5 text-center">
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((section) => (
                    <tr
                      key={section.id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/40"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{section.label}</span>
                        <span className="ml-2 text-xs text-foreground-muted">{section.id}</span>
                      </td>
                      {roles.map((role) => {
                        const allowed = (roleSections[role] ?? ROLE_DEFAULT_SECTIONS[role]).includes(
                          section.id,
                        );
                        const unavailable = section.superadminOnly && role !== "superadmin";
                        const locked = Boolean(section.locked) || role === "superadmin";
                        return (
                          <td key={role} className="px-3 py-2 text-center">
                            {unavailable ? (
                              <span className="text-foreground-muted">—</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={allowed}
                                disabled={locked}
                                aria-label={`${ROLE_LABELS[role]} — ${section.label}`}
                                onChange={() => {
                                  const base =
                                    roleSections[role] ?? ROLE_DEFAULT_SECTIONS[role];
                                  const next = allowed
                                    ? base.filter((id) => id !== section.id)
                                    : [...base, section.id];
                                  dispatch({
                                    type: "SET_ROLE_SECTIONS",
                                    role,
                                    sections: next,
                                  });
                                }}
                                className="focus-ring h-4 w-4 accent-[var(--color-brand)] disabled:opacity-40"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Kabinet boshi va «Sozlamalar» qulflangan: ularsiz foydalanuvchi oʻz
        kabinetiga kira olmay qoladi. Jami{" "}
        <span className="num font-medium text-foreground">{SECTIONS.length}</span> ta boʻlim
        roʻyxatga olingan.
      </p>
    </div>
  );
}

/* ─────────────────────── Maktab ─────────────────────── */

function SchoolTab() {
  const { settings } = useAdmin();
  const dispatch = useAdminDispatch();
  const [draft, setDraft] = useState<SchoolSettings>(settings);
  const [saved, setSaved] = useState(false);

  const dirty = (Object.keys(settings) as (keyof SchoolSettings)[]).some(
    (k) => draft[k] !== settings[k],
  );

  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Maktab nomi boʻsh boʻlmasin.");
  if (draft.defaultPayDay < 1 || draft.defaultPayDay > 28) {
    errors.push("Toʻlov kuni 1–28 oraligʻida boʻlsin.");
  }
  if (draft.maxDiscountPercent < 0 || draft.maxDiscountPercent > 100) {
    errors.push("Chegirma chegarasi 0–100% oraligʻida boʻlsin.");
  }
  if (draft.overdueAfterDays < 0) errors.push("Kechikish kuni manfiy boʻlmaydi.");
  if (draft.attendanceLockHours < 1) errors.push("Davomat qulfi kamida 1 soat boʻlsin.");

  function set<K extends keyof SchoolSettings>(key: K, value: SchoolSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.length > 0) return;
        dispatch({ type: "UPDATE_SETTINGS", settings: draft });
        setSaved(true);
      }}
      className="flex flex-col gap-4"
    >
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-foreground">Maktab maʼlumotlari</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nomi" full>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className={settingsInput}
            />
          </Field>
          <Field label="Oʻquv yili">
            <input
              value={draft.academicYear}
              onChange={(e) => set("academicYear", e.target.value)}
              className={settingsInput}
            />
          </Field>
          <Field label="Telefon">
            <input
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={`${settingsInput} num`}
            />
          </Field>
          <Field label="Manzil" full>
            <input
              value={draft.address}
              onChange={(e) => set("address", e.target.value)}
              className={settingsInput}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-foreground-muted">
          Nomi maʼlumotnoma matnida va hujjat sarlavhasida ishlatiladi.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-foreground">Qoidalar</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Standart toʻlov kuni">
            <input
              type="number"
              min={1}
              max={28}
              value={draft.defaultPayDay}
              onChange={(e) => set("defaultPayDay", Number(e.target.value))}
              className={`${settingsInput} num`}
            />
            <span className="mt-1 block text-xs text-foreground-muted">
              Qabul sehrgarida shu kun oldindan qoʻyiladi.
            </span>
          </Field>
          <Field label="Administrator bera oladigan eng katta chegirma">
            <input
              type="number"
              min={0}
              max={100}
              value={draft.maxDiscountPercent}
              onChange={(e) => set("maxDiscountPercent", Number(e.target.value))}
              className={`${settingsInput} num`}
            />
            <span className="mt-1 block text-xs text-foreground-muted">
              Undan yuqorisi rahbariyat tasdigʻini talab qiladi.
            </span>
          </Field>
          <Field label="Necha kundan keyin «kechikkan»">
            <input
              type="number"
              min={0}
              value={draft.overdueAfterDays}
              onChange={(e) => set("overdueAfterDays", Number(e.target.value))}
              className={`${settingsInput} num`}
            />
            <span className="mt-1 block text-xs text-foreground-muted">
              Qarzdorlar roʻyxati va eslatmalar shu chegaraga qarab ishlaydi.
            </span>
          </Field>
          <Field label="Davomat ustoz uchun necha soatdan keyin yopiladi">
            <input
              type="number"
              min={1}
              value={draft.attendanceLockHours}
              onChange={(e) => set("attendanceLockHours", Number(e.target.value))}
              className={`${settingsInput} num`}
            />
            <span className="mt-1 block text-xs text-foreground-muted">
              DAV-03. Keyin faqat administrator tuzata oladi, audit bilan.
            </span>
          </Field>
        </div>
      </section>

      {dirty && errors.length > 0 && (
        <ul className="animate-enter space-y-1 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {saved && (
        <p className="animate-enter rounded-lg bg-success-tint px-3 py-2 text-xs text-success">
          Sozlamalar saqlandi va audit jurnaliga tushdi.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            setDraft(settings);
            setSaved(false);
          }}
          className="focus-ring rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={!dirty || errors.length > 0}
          className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          Oʻzgarishlarni saqlash
        </button>
      </div>
    </form>
  );
}

const settingsInput =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
