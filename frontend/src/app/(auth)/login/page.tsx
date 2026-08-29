"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Kirish sahifasi (AUT-01) — Stitch dizayni boʻyicha ikki ustunli:
 * chapda brend paneli, oʻngda forma.
 *
 * Demo rejimi: backend hali ulanmagan, shuning uchun har qanday parol bilan
 * kiritadi. Xato va blok holatlari koʻrsatish uchun maxsus qiymatlar bor
 * (pastdagi maslahat qatoriga qara).
 */

const DEMO_PHONE = "+998 90 123 45 67";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLocked(false);

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Telefon raqami notoʻgʻri. Namuna: +998 90 123 45 67");
      return;
    }
    if (!password) {
      setError("Parolni kiriting.");
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    // Demo: AUT-05 blok holatini koʻrsatish uchun.
    if (password === "blok") {
      setLoading(false);
      setLocked(true);
      return;
    }
    // Demo: notoʻgʻri parol holati.
    if (password === "xato") {
      setLoading(false);
      setError("Telefon raqami yoki parol notoʻgʻri.");
      return;
    }

    router.push("/teacher");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* --- Chap: brend paneli --- */}
      <div className="flex items-center justify-center bg-brand px-6 py-10 lg:w-2/5 lg:py-0">
        <div className="text-center">
          <p className="text-4xl font-bold tracking-tight text-brand-foreground sm:text-5xl">
            Tarbion
          </p>
          <p className="mx-auto mt-3 max-w-[16rem] text-sm text-brand-foreground/85">
            Tarbiyaga asoslangan zamonaviy taʼlim
          </p>
        </div>
      </div>

      {/* --- Oʻng: forma --- */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-semibold">Xush kelibsiz</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Hisobingizga kirish uchun maʼlumotlarni kiriting.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">
                Telefon raqami
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 00 000 00 00"
                aria-invalid={Boolean(error)}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Parol
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-invalid={Boolean(error)}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 pr-11 text-sm outline-none transition-colors placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni koʻrsatish"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-foreground-muted transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            {locked && (
              <div role="alert" className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
                <p className="font-medium">Hisob 15 daqiqaga bloklandi.</p>
                <p className="mt-0.5">
                  Ketma-ket 5 marta notoʻgʻri parol kiritildi. Keyinroq qayta urinib
                  koʻring yoki administratorga murojaat qiling.
                </p>
              </div>
            )}

            <div className="text-right">
              <button
                type="button"
                className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Parolni unutdingizmi?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Tekshirilmoqda…" : "Tizimga kirish"}
              {!loading && <ArrowIcon />}
            </button>
          </form>

          <p className="mt-6 rounded-lg bg-surface-muted px-3 py-2 text-xs leading-relaxed text-foreground-muted">
            <span className="font-medium text-foreground">Demo rejimi.</span> Istalgan
            parol bilan kiriladi. Xato holatini koʻrish uchun{" "}
            <code className="rounded bg-surface px-1">xato</code>, blok holati uchun{" "}
            <code className="rounded bg-surface px-1">blok</code> deb yozing.
          </p>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.7A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
