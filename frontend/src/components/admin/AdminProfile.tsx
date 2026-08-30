"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, LogoutIcon, XIcon } from "@/components/ui/icons";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { ACADEMIC_YEAR } from "@/lib/admin/seed";
import { ADMIN_PERMISSIONS, AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/admin/types";
import { isRemembered, logout } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

/**
 * Administrator profili.
 *
 * Bu yerdagi ism audit jurnalidagi "kim" ustuniga tushadi — shuning uchun
 * oʻzgartirilsa faqat KEYINGI yozuvlarga taʼsir qiladi, eskilari
 * tegilmaydi (CLAUDE.md 4-qoida: audit yozuvi tahrirlanmaydi).
 */
export function AdminProfile() {
  const { profile, audit } = useAdmin();
  const dispatch = useAdminDispatch();

  const [fullName, setFullName] = useState(profile.fullName);
  const [position, setPosition] = useState(profile.position);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [workHours, setWorkHours] = useState(profile.workHours);
  const [office, setOffice] = useState(profile.office);
  const [saved, setSaved] = useState(false);

  const dirty =
    fullName !== profile.fullName ||
    position !== profile.position ||
    phone !== profile.phone ||
    email !== profile.email ||
    workHours !== profile.workHours ||
    office !== profile.office;

  const errors: string[] = [];
  if (fullName.trim().split(/\s+/).length < 2) errors.push("F.I.Sh toʻliq kiritilsin.");
  if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(phone.trim())) {
    errors.push("Telefon format: +998 90 123 45 67.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errors.push("Elektron pochta notoʻgʻri.");

  // Faoliyat — audit jurnalidan, faqat shu foydalanuvchi yozuvlari.
  const activity = useMemo(() => {
    const mine = audit.filter((e) => e.actor === profile.fullName);
    const byAction = new Map<AuditAction, number>();
    for (const entry of mine) {
      byAction.set(entry.action, (byAction.get(entry.action) ?? 0) + 1);
    }
    return {
      total: mine.length,
      recent: mine.slice(0, 6),
      byAction: [...byAction.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [audit, profile.fullName]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Profil</h1>
        <p className="text-sm text-foreground-muted">
          Shaxsiy maʼlumot, huquqlar va shu kabinetdagi faoliyatingiz
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-base font-semibold text-brand-foreground">
          {profile.fullName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{profile.fullName}</p>
          <p className="truncate text-sm text-foreground-muted">
            {profile.position} · {ACADEMIC_YEAR} oʻquv yili
          </p>
        </div>
        <div className="ml-auto hidden shrink-0 sm:block">
          <Badge tone="brand">{ROLE_LABELS.admin}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (errors.length > 0) return;
            dispatch({
              type: "UPDATE_PROFILE",
              profile: {
                fullName: fullName.trim(),
                position: position.trim(),
                phone: phone.trim(),
                email: email.trim(),
                workHours: workHours.trim(),
                office: office.trim(),
              },
            });
            setSaved(true);
          }}
          className="rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
          <h2 className="mb-1 text-base font-semibold text-foreground">Shaxsiy maʼlumot</h2>
          <p className="mb-4 text-xs text-foreground-muted">
            Ism va aloqa maʼlumoti maʼlumotnoma pastidagi imzoda va ota-onaga
            yuboriladigan xabarlarda koʻrinadi.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="F.I.Sh" full>
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setSaved(false);
                }}
                className={profileInputClass}
              />
            </Field>
            <Field label="Lavozim" full>
              <input
                value={position}
                onChange={(e) => {
                  setPosition(e.target.value);
                  setSaved(false);
                }}
                className={profileInputClass}
              />
            </Field>
            <Field label="Telefon">
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSaved(false);
                }}
                inputMode="tel"
                className={`${profileInputClass} num`}
              />
            </Field>
            <Field label="Elektron pochta">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaved(false);
                }}
                className={profileInputClass}
              />
            </Field>
            <Field label="Qabul vaqti">
              <input
                value={workHours}
                onChange={(e) => {
                  setWorkHours(e.target.value);
                  setSaved(false);
                }}
                className={profileInputClass}
              />
            </Field>
            <Field label="Ish joyi">
              <input
                value={office}
                onChange={(e) => {
                  setOffice(e.target.value);
                  setSaved(false);
                }}
                className={profileInputClass}
              />
            </Field>
          </div>

          {dirty && errors.length > 0 && (
            <ul className="animate-enter mt-3 space-y-1 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          {saved && (
            <p className="animate-enter mt-3 rounded-lg bg-success-tint px-3 py-2 text-xs text-success">
              Saqlandi. Keyingi audit yozuvlari yangi ism bilan tushadi, eskilari
              oʻzgarmaydi.
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                setFullName(profile.fullName);
                setPosition(profile.position);
                setPhone(profile.phone);
                setEmail(profile.email);
                setWorkHours(profile.workHours);
                setOffice(profile.office);
                setSaved(false);
              }}
              className="focus-ring rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
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

        <div className="flex flex-col gap-4">
          <SessionCard />

          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-foreground">Huquqlar</h2>
            <p className="mb-3 text-xs text-foreground-muted">
              Roʻyxat koʻrsatish uchun — haqiqiy tekshiruv serverda boʻladi.
            </p>
            <ul className="flex flex-col gap-1.5">
              {ADMIN_PERMISSIONS.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      item.allowed ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
                    }`}
                  >
                    {item.allowed ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : (
                      <XIcon className="h-2.5 w-2.5" />
                    )}
                  </span>
                  <span
                    className={item.allowed ? "text-foreground" : "text-foreground-muted"}
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Mening faoliyatim</h2>
          <Link
            href="/admin/audit"
            className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
          >
            Toʻliq audit jurnali →
          </Link>
        </div>

        {activity.total === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-foreground-muted">
            Bu sessiyada hali amal bajarmadingiz.
          </p>
        ) : (
          <>
            <ul className="mb-4 flex flex-wrap gap-1.5">
              {activity.byAction.map(([action, count]) => (
                <li
                  key={action}
                  className="rounded-full bg-surface-muted px-3 py-1 text-xs text-foreground-muted"
                >
                  {AUDIT_ACTION_LABELS[action]}:{" "}
                  <span className="num font-semibold text-foreground">{count}</span>
                </li>
              ))}
            </ul>

            <ul className="flex flex-col gap-2">
              {activity.recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{entry.entity}</span>
                    <span className="text-foreground-muted"> — {entry.detail}</span>
                  </span>
                  <span className="num shrink-0 text-xs text-foreground-muted">{entry.at}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/** Sessiya — brauzer xotirasidan oʻqiladi, shuning uchun faqat mijozda. */
function SessionCard() {
  const [remembered, setRemembered] = useState<boolean | null>(null);

  useEffect(() => setRemembered(isRemembered()), []);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-foreground">Sessiya</h2>
      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Rol">{ROLE_LABELS.admin}</Row>
        <Row label="Kabinet">/admin</Row>
        <Row label="Eslab qolish">
          {remembered === null ? "…" : remembered ? "Yoqilgan" : "Oʻchirilgan"}
        </Row>
      </dl>
      <p className="mt-3 text-xs text-foreground-muted">
        {remembered
          ? "Brauzer yopilsa ham kirgan holatda qolasiz."
          : "Brauzer yopilishi bilan sessiya tugaydi — umumiy kompyuter uchun shu maʼqul."}
      </p>
      <Link
        href="/login"
        onClick={() => logout()}
        className="focus-ring mt-3 flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:border-danger hover:text-danger"
      >
        <LogoutIcon className="h-4 w-4" />
        Kabinetdan chiqish
      </Link>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}

const profileInputClass =
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
