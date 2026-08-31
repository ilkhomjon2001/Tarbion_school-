"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeTwoFactor, signIn } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import { SessionError } from "@/lib/session";

/**
 * Kirish sahifasi (AUT-01) — Stitch dizayni boʻyicha ikki ustunli:
 * chapda brend paneli, oʻngda forma.
 *
 * HAQIQIY backend bilan ishlaydi. Rol TANLANMAYDI — u serverdan, JWT
 * ichidan keladi va shunga qarab kabinet ochiladi. Avvalgi demo rejimida
 * rol tugmalari bor edi; ular olib tashlandi, chunki rolni foydalanuvchi
 * tanlashi mumkinligi tushunmovchilik tugʻdirardi.
 *
 * "Ushbu qurilmada eslab qolish" — yoqilsa sessiya `localStorage`da (brauzer
 * yopilsa ham saqlanadi), oʻchirilgan boʻlsa `sessionStorage`da (tab/brauzer
 * yopilganda yoki "Chiqish" bosilganda yoʻqoladi). Qarang: `lib/auth.ts`.
 */



export default function LoginPage() {
  const router = useRouter();
  const [userLogin, setUserLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  /** Ikkinchi bosqich uchun challenge — `null` boʻlsa parol formasi. */
  const [challenge, setChallenge] = useState<string | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [code, setCode] = useState("");

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    if (challenge === null) return;

    setError(null);
    setLoading(true);
    try {
      const { role, mustChangePassword } = await completeTwoFactor(
        challenge,
        code.trim(),
        remember,
      );
      router.replace(mustChangePassword ? "/parol" : ROLE_HOME[role]);
    } catch (err) {
      setLoading(false);
      setCode("");
      // Challenge muddati 5 daqiqa. Tugagan boʻlsa parolni qaytadan
      // soʻraymiz — aks holda odam nima boʻlganini tushunmaydi.
      if (err instanceof SessionError && err.status === 401) {
        setError(err.message);
        if (err.message.includes("muddati")) setChallenge(null);
        return;
      }
      setError(
        err instanceof SessionError
          ? err.message
          : "Serverga ulanib boʻlmadi. Internetni tekshiring.",
      );
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLocked(false);

    if (userLogin.trim().length < 2) {
      setError("Loginni kiriting. Namuna: aliyev.sardor");
      return;
    }
    if (!password) {
      setError("Parolni kiriting.");
      return;
    }

    setLoading(true);
    try {
      const natija = await signIn(userLogin.trim(), password, remember);

      // 2FA yoqilgan — token hali berilmagan. Ikkinchi bosqichga
      // oʻtamiz; parol formasi almashadi (X-14).
      if (natija.needsTwoFactor) {
        setLoading(false);
        setChallenge(natija.challenge);
        setRecoveryAvailable(natija.recoveryAvailable);
        return;
      }

      // Boshlangʻich 5 xonali parol doimiy qolib ketmasin.
      router.replace(natija.mustChangePassword ? "/parol" : ROLE_HOME[natija.role]);
    } catch (err) {
      setLoading(false);
      // 423 — AUT-05 boʻyicha hisob vaqtincha bloklangan.
      if (err instanceof SessionError && err.status === 423) {
        setLocked(true);
        return;
      }
      setError(
        err instanceof SessionError
          ? err.message
          : "Serverga ulanib boʻlmadi. Internetni tekshiring.",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* --- Chap: brend paneli --- */}
      <div className="flex items-center justify-center bg-brand px-6 py-12 lg:w-2/5 lg:py-0">
        {/* Yashil fonda oq logotip — 560x87, 2x zichlikda toza chiqadi */}
        <Image
          src="/logo/tarbion-lockup-white.png"
          alt="Tarbion — Tarbiyaga asoslangan zamonaviy taʼlim"
          width={560}
          height={87}
          priority
          className="h-auto w-full max-w-[280px]"
        />
      </div>

      {/* --- Oʻng: forma --- */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <h1 className="text-h2 font-bold">
            {challenge === null ? "Xush kelibsiz" : "Tasdiqlash kodi"}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {challenge === null
              ? "Hisobingizga kirish uchun maʼlumotlarni kiriting."
              : "Ilovadagi 6 xonali kodni kiriting."}
          </p>

          {/* Ikkinchi bosqich: parol allaqachon tasdiqlangan, lekin
              token hali berilmagan (X-14). */}
          {challenge !== null && (
            <form onSubmit={onVerify} className="mt-7 space-y-4" noValidate>
              <div>
                <label htmlFor="code" className="block text-sm font-medium">
                  Kod
                </label>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 16))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  className="num mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-center text-lg tracking-[0.3em] outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                />
                {recoveryAvailable && (
                  <p className="mt-1.5 text-xs text-foreground-muted">
                    Telefoningiz yoʻqmi? Tiklash kodini shu yerga kiriting.
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.trim().length < 6}
                className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {loading ? "Tekshirilmoqda…" : "Tasdiqlash"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setCode("");
                  setError(null);
                }}
                className="focus-ring h-9 w-full rounded-lg text-sm font-medium text-foreground-muted hover:underline"
              >
                Orqaga
              </button>
            </form>
          )}

          <form
            onSubmit={onSubmit}
            className={`mt-7 space-y-4 ${challenge !== null ? "hidden" : ""}`}
            noValidate
          >
            <div>
              <label htmlFor="login" className="block text-sm font-medium">
                Login
              </label>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={userLogin}
                onChange={(e) => setUserLogin(e.target.value)}
                placeholder="familiya.ism"
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

            <div className="flex items-start justify-between gap-3">
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <span>
                  Ushbu qurilmada eslab qolish
                  <span className="block text-xs text-foreground-muted">
                    Umumiy yoki maktab kompyuterida yoqmang
                  </span>
                </span>
              </label>
              <button
                type="button"
                className="shrink-0 text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
            Login va parolni maktab administratori beradi. Login{" "}
            <code className="rounded bg-surface px-1">familiya.ism</code> koʻrinishida.
            Parolni unutsangiz administratorga murojaat qiling.
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
