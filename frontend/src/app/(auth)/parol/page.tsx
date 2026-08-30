"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { currentRole, logout, restore } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import { changePassword } from "@/lib/password";
import { getUser, isAuthenticated, SessionError } from "@/lib/session";

/**
 * Boshlangʻich parolni almashtirish (AUT-08).
 *
 * Administrator hisob ochganda 5 xonali parol beriladi — u faqat
 * birinchi kirish uchun. 5 xonali raqam atigi 100 000 variant, va login
 * ism-familiyadan kelib chiqadi, yaʼni taxmin qilinadi. Shuning uchun
 * `must_change_password` bayrogʻi turgan foydalanuvchi shu sahifadan
 * boshqa hech qayerga oʻta olmaydi (`AuthGuard` ga qara).
 */

const MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = isAuthenticated() || (await restore());
      if (!alive) return;
      if (!ok) {
        router.replace("/login");
        return;
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (next.length < MIN_LENGTH) {
      setError(`Yangi parol kamida ${MIN_LENGTH} belgidan iborat boʻlsin.`);
      return;
    }
    if (/^\d+$/.test(next)) {
      setError("Parol faqat raqamlardan iborat boʻlmasin.");
      return;
    }
    if (next !== repeat) {
      setError("Ikki parol bir xil emas.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(current, next);
      const role = currentRole();
      router.replace(role ? ROLE_HOME[role] : "/login");
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof SessionError ? err.message : "Serverga ulanib boʻlmadi.",
      );
    }
  }

  if (!ready) return null;

  const user = getUser();
  const majburiy = user?.must_change_password ?? false;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Image
          src="/logo/tarbion-wordmark.png"
          alt="Tarbion"
          width={360}
          height={72}
          priority
          className="mb-8 h-auto w-[150px]"
        />

        <h1 className="text-h2 font-bold">Parolni almashtiring</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {majburiy
            ? "Administrator bergan vaqtinchalik parol faqat birinchi kirish uchun. Oʻzingiz biladigan parol qoʻying."
            : "Yangi parol kamida 8 belgidan iborat boʻlsin."}
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
          <Field
            id="current"
            label={majburiy ? "Vaqtinchalik parol" : "Joriy parol"}
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            inputMode={majburiy ? "numeric" : undefined}
          />
          <Field
            id="next"
            label="Yangi parol"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            hint={`Kamida ${MIN_LENGTH} belgi, faqat raqam boʻlmasin`}
          />
          <Field
            id="repeat"
            label="Yangi parolni takrorlang"
            value={repeat}
            onChange={setRepeat}
            autoComplete="new-password"
          />

          {error && (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saqlanmoqda…" : "Parolni saqlash"}
          </button>
        </form>

        <button
          type="button"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          className="focus-ring mt-4 w-full rounded-lg py-2 text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          Chiqish
        </button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  inputMode?: "numeric";
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
      />
      {hint && <p className="mt-1 text-xs text-foreground-muted">{hint}</p>}
    </div>
  );
}
