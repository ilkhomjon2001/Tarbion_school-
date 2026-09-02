"use client";

/**
 * Parolni tiklash (T-006, AUT-02).
 *
 * Ikki qadam: soʻrov → kod bilan yangi parol.
 *
 * Ota-onada telefon raqami bor — u raqamini kiritadi. Ustoz va
 * maʼmuriyatda raqam yoʻq (hisoblari login bilan ochilgan), ular
 * loginini kiritadi va soʻrov administrator navbatiga tushadi.
 *
 * MUHIM: soʻrovga javob HAR DOIM bir xil, raqam bazada boʻlmasa ham.
 * Aks holda begona odam raqamlarni sinab, qaysi oila maktabda oʻqishini
 * aniqlab olardi. Shuning uchun bu yerda «bunday raqam topilmadi»
 * degan xabar HECH QACHON koʻrsatilmaydi.
 */

import Link from "next/link";
import { useState } from "react";

import { confirmReset, requestReset, resetXato } from "@/lib/password-reset";

type Usul = "phone" | "login";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const tugmaClass =
  "flex h-11 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

export default function PasswordResetPage() {
  const [usul, setUsul] = useState<Usul>("phone");
  const [phone, setPhone] = useState("");
  const [login, setLogin] = useState("");
  const [yuborildi, setYuborildi] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [parol, setParol] = useState("");
  const [tayyor, setTayyor] = useState(false);

  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function sorash(e: React.FormEvent) {
    e.preventDefault();
    setBand(true);
    setXato(null);
    try {
      const javob = await requestReset(
        usul === "phone" ? { phone } : { login },
      );
      setYuborildi(javob);
    } catch (err) {
      setXato(resetXato(err, "Soʻrovni yuborib boʻlmadi. Qayta urinib koʻring."));
    } finally {
      setBand(false);
    }
  }

  async function tasdiqlash(e: React.FormEvent) {
    e.preventDefault();
    setBand(true);
    setXato(null);
    try {
      await confirmReset({ phone, code, newPassword: parol });
      setTayyor(true);
    } catch (err) {
      setXato(resetXato(err, "Kod notoʻgʻri yoki muddati oʻtgan."));
    } finally {
      setBand(false);
    }
  }

  if (tayyor) {
    return (
      <Qobiq sarlavha="Parol yangilandi">
        <p className="text-sm text-foreground-muted">
          Endi yangi parol bilan kirishingiz mumkin. Barcha qurilmalardagi eski
          sessiyalar bekor qilindi.
        </p>
        <Link href="/login" className={`${tugmaClass} mt-4`}>
          Tizimga kirish
        </Link>
      </Qobiq>
    );
  }

  return (
    <Qobiq sarlavha="Parolni tiklash">
      {yuborildi === null ? (
        <form onSubmit={sorash} className="flex flex-col gap-4">
          {/* Ikki usul: raqam (ota-ona) yoki login (xodim). */}
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
            {(["phone", "login"] as Usul[]).map((u) => (
              <button
                key={u}
                type="button"
                role="tab"
                aria-selected={usul === u}
                onClick={() => setUsul(u)}
                className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  usul === u
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {u === "phone" ? "Telefon raqami" : "Login"}
              </button>
            ))}
          </div>

          {usul === "phone" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Telefon raqami</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className={inputClass}
              />
              <span className="text-xs text-foreground-muted">
                Maktabga bergan raqamingizni kiriting. Kod Telegram orqali keladi.
              </span>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Login</span>
              <input
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="familiya.ism"
                className={inputClass}
              />
              <span className="text-xs text-foreground-muted">
                Xodimlar uchun: soʻrov administratorga boradi, u yangi parol beradi.
              </span>
            </label>
          )}

          {xato && (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {xato}
            </p>
          )}

          <button type="submit" disabled={band} className={tugmaClass}>
            {band ? "Yuborilmoqda…" : "Tiklash soʻrovini yuborish"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            {yuborildi}
          </p>

          {usul === "phone" && (
            <form onSubmit={tasdiqlash} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Tasdiqlash kodi</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className={`${inputClass} num tracking-[0.3em]`}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Yangi parol</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={parol}
                  onChange={(e) => setParol(e.target.value)}
                  className={inputClass}
                />
                <span className="text-xs text-foreground-muted">
                  Kamida 8 belgi. Faqat raqamlardan iborat boʻlmasin.
                </span>
              </label>

              {xato && (
                <p
                  role="alert"
                  className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger"
                >
                  {xato}
                </p>
              )}

              <button type="submit" disabled={band} className={tugmaClass}>
                {band ? "Tekshirilmoqda…" : "Yangi parolni saqlash"}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setYuborildi(null);
              setXato(null);
            }}
            className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Boshqa maʼlumot bilan qayta urinish
          </button>
        </div>
      )}

      <Link
        href="/login"
        className="mt-6 block text-center text-sm text-foreground-muted underline-offset-2 hover:underline"
      >
        Kirish sahifasiga qaytish
      </Link>
    </Qobiq>
  );
}

function Qobiq({ sarlavha, children }: { sarlavha: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-[380px] rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-h3 font-bold text-foreground">{sarlavha}</h1>
        <p className="mb-5 text-sm text-foreground-muted">Tarbion maktab platformasi</p>
        {children}
      </div>
    </main>
  );
}
