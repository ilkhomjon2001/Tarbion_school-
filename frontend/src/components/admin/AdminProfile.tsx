"use client";

/**
 * Administrator profili — SESSIYADAN.
 *
 * Ism-familiya va rol `auth/me` javobidan keladi (u AuthGuard'da
 * yuklanadi); bu yerda tahrirlanmaydi — hisob maʼlumotini super
 * administrator boshqaradi, audit jurnalidagi «kim» ustuni ham oʻsha
 * yozuvga tayanadi. Bu sahifada foydalanuvchi oʻzi qila oladigan
 * yagona amal bor: parolni almashtirish (AUT-08).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { LogoutIcon } from "@/components/ui/icons";
import { isRemembered, logout } from "@/lib/auth";
import { changePassword } from "@/lib/password";
import { getUser } from "@/lib/session";

export function AdminProfile() {
  const user = getUser();
  const fullName = user?.full_name ?? "—";
  const login = user?.login ?? "—";
  const roleLabel = user?.roles.includes("superadmin")
    ? "Super administrator"
    : "Administrator";

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Profil</h1>
        <p className="text-sm text-foreground-muted">
          Hisob maʼlumoti, sessiya va parolni almashtirish
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-base font-semibold text-brand-foreground">
          {initials(fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{fullName}</p>
          <p className="num truncate text-sm text-foreground-muted">Login: {login}</p>
        </div>
        <div className="ml-auto hidden shrink-0 sm:block">
          <Badge tone="brand">{roleLabel}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-foreground">
            Parolni almashtirish
          </h2>
          <p className="mb-4 text-xs text-foreground-muted">
            Xavfsizlik uchun joriy parol soʻraladi. Yangi parol kamida 8 belgi
            boʻlsin.
          </p>
          <PasswordForm />
        </section>

        <div className="flex flex-col gap-4">
          <SessionCard roleLabel={roleLabel} />

          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-foreground">Faoliyat</h2>
            <p className="mb-3 text-xs text-foreground-muted">
              Kiritgan, oʻzgartirgan va eksport qilgan har bir amalingiz audit
              jurnalida saqlanadi.
            </p>
            <Link
              href="/admin/audit"
              className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
            >
              Audit jurnalini ochish →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Parol formasi — BAZAGA yozadi (`auth/change-password`). */
function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "mismatch" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (next.length < 8 || next !== confirm) {
          setStatus("mismatch");
          return;
        }
        setBusy(true);
        changePassword(current, next)
          .then(() => {
            setStatus("success");
            setCurrent("");
            setNext("");
            setConfirm("");
          })
          .catch((err: unknown) => {
            setStatus("error");
            setErrorText(
              err instanceof Error ? err.message : "Parolni almashtirib boʻlmadi.",
            );
          })
          .finally(() => setBusy(false));
      }}
      className="flex max-w-sm flex-col gap-3"
    >
      <Field label="Joriy parol" htmlFor="joriy-parol">
        <input
          id="joriy-parol"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setStatus("idle");
          }}
          className={inputClass}
        />
      </Field>
      <Field label="Yangi parol" htmlFor="yangi-parol">
        <input
          id="yangi-parol"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setStatus("idle");
          }}
          placeholder="Kamida 8 ta belgi"
          className={inputClass}
        />
      </Field>
      <Field label="Yangi parolni takrorlang" htmlFor="yangi-parol-takror">
        <input
          id="yangi-parol-takror"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setStatus("idle");
          }}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!current || !next || !confirm || busy}
          className="focus-ring rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Yangilanmoqda…" : "Parolni yangilash"}
        </button>
        {status === "success" && (
          <span className="text-sm text-success">Parol yangilandi</span>
        )}
        {status === "mismatch" && (
          <span className="text-sm text-danger">
            Yangi parollar mos emas yoki juda qisqa (kamida 8 belgi)
          </span>
        )}
        {status === "error" && <span className="text-sm text-danger">{errorText}</span>}
      </div>
    </form>
  );
}

/** Sessiya — brauzer xotirasidan oʻqiladi, shuning uchun faqat mijozda. */
function SessionCard({ roleLabel }: { roleLabel: string }) {
  const [remembered, setRemembered] = useState<boolean | null>(null);

  useEffect(() => setRemembered(isRemembered()), []);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-foreground">Sessiya</h2>
      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Rol">{roleLabel}</Row>
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

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
