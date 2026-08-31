"use client";

/**
 * Ikki bosqichli tasdiqlashni sozlash (X-14).
 *
 * Administrator va direktor butun bazani koʻradi — ularning bitta
 * paroli butun maktabning maʼlumotini ochib beradi. Shu sababli ular
 * uchun 2FA MAJBURIY: yoqilmaguncha server boshqa hech qanday soʻrovni
 * qabul qilmaydi (`ikki_bosqich_kerak`).
 *
 * Qolganlar — ustoz, ota-ona, super administrator — istasa yoqadi.
 *
 * Uch qadam: sekret → ilovaga qoʻshish → kod bilan tasdiqlash. Oxirida
 * tiklash kodlari BIR MARTA koʻrsatiladi.
 *
 * QR kod YOʻQ: uni chizish kutubxona talab qiladi va CLAUDE.md
 * boʻyicha yangi bogʻliqlik ruxsat bilan qoʻshiladi. Oʻrniga ikki yoʻl
 * berilgan — `otpauth://` havolasi (telefonda ilovani ochadi) va
 * qoʻlda kiritiladigan sekret (kompyuterda). Ikkalasini ham barcha
 * autentifikator ilovalari qoʻllab-quvvatlaydi.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ROLE_HOME } from "@/lib/roles";
import { currentRole } from "@/lib/auth";
import {
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
  twoFactorStatus,
  type TwoFactorStatusOut,
} from "@/lib/twofactor";
import { SessionError, restore } from "@/lib/session";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

type Qadam = "holat" | "sozlash" | "kodlar";

export default function TwoFactorPage() {
  const router = useRouter();
  const [holat, setHolat] = useState<TwoFactorStatusOut | null>(null);
  const [qadam, setQadam] = useState<Qadam>("holat");

  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [kodlar, setKodlar] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nusxa, setNusxa] = useState(false);

  const yukla = useCallback(async () => {
    setError(null);
    try {
      setHolat(await twoFactorStatus());
    } catch {
      // Sessiya yoʻq — kirish sahifasiga.
      const ok = await restore();
      if (!ok) {
        router.replace("/login");
        return;
      }
      try {
        setHolat(await twoFactorStatus());
      } catch (err) {
        setError(err instanceof SessionError ? err.message : "Holatni olib boʻlmadi.");
      }
    }
  }, [router]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function boshla() {
    setBusy(true);
    setError(null);
    try {
      const natija = await setupTwoFactor();
      setSecret(natija.secret);
      setUri(natija.uri);
      setQadam("sozlash");
    } catch (err) {
      setError(err instanceof SessionError ? err.message : "Sozlashni boshlab boʻlmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function yoq() {
    setBusy(true);
    setError(null);
    try {
      setKodlar(await enableTwoFactor(code.trim()));
      setQadam("kodlar");
    } catch (err) {
      setCode("");
      setError(
        err instanceof SessionError ? err.message : "Kodni tasdiqlab boʻlmadi.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function nusxaOl() {
    try {
      await navigator.clipboard.writeText(kodlar.join("\n"));
      setNusxa(true);
    } catch {
      setNusxa(false);
    }
  }

  function tugat() {
    const rol = currentRole();
    router.replace(rol ? ROLE_HOME[rol] : "/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <h1 className="text-h2 font-bold text-foreground">
          Ikki bosqichli tasdiqlash
        </h1>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* ── Holat ── */}
        {qadam === "holat" && holat !== null && (
          <div className="mt-4 flex flex-col gap-4">
            {holat.enabled ? (
              <>
                <p className="rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
                  Yoqilgan. Kirishda ilovadagi kod soʻraladi.
                </p>
                <p className="text-sm text-foreground-muted">
                  Ishlatilmagan tiklash kodlari:{" "}
                  <span className="num font-medium text-foreground">
                    {holat.unused_recovery_codes}
                  </span>
                  {holat.unused_recovery_codes <= 2 && (
                    <span className="text-warning">
                      {" "}
                      — kamayib qoldi, yangilarini oling.
                    </span>
                  )}
                </p>
                <button type="button" onClick={tugat} className={primaryBtn}>
                  Kabinetga oʻtish
                </button>
                {!holat.required && (
                  <DisablePanel
                    onDone={() => {
                      setQadam("holat");
                      void yukla();
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-foreground-muted">
                  {holat.required
                    ? "Sizning rolingizda bu majburiy: siz butun maktab maʼlumotini koʻrasiz, shuning uchun bitta parol yetarli emas."
                    : "Hisobingizni kuchaytiring: parolga qoʻshimcha ravishda telefondagi kod soʻraladi."}
                </p>
                <ol className="flex flex-col gap-1.5 text-sm text-foreground-muted">
                  <li>1. Telefonga autentifikator ilovasini oʻrnating.</li>
                  <li>2. Sekretni ilovaga qoʻshing.</li>
                  <li>3. Ilova bergan 6 xonali kodni tasdiqlang.</li>
                </ol>
                <p className="text-xs text-foreground-muted">
                  Mos ilovalar: Google Authenticator, Aegis, 1Password, Authy.
                </p>
                <button
                  type="button"
                  onClick={boshla}
                  disabled={busy}
                  className={primaryBtn}
                >
                  {busy ? "Tayyorlanmoqda…" : "Sozlashni boshlash"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Sozlash ── */}
        {qadam === "sozlash" && (
          <div className="mt-4 flex flex-col gap-4">
            <AddToApp secret={secret} uri={uri} />

            <label>
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                Ilovadagi kod
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className={`${inputClass} num text-center text-lg tracking-[0.3em]`}
              />
            </label>

            <button
              type="button"
              onClick={yoq}
              disabled={busy || code.length !== 6}
              className={primaryBtn}
            >
              {busy ? "Tekshirilmoqda…" : "Tasdiqlash va yoqish"}
            </button>
          </div>
        )}

        {/* ── Tiklash kodlari ── */}
        {qadam === "kodlar" && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
              Bu kodlarni <strong>hozir</strong> saqlab qoʻying. Ular boshqa
              koʻrsatilmaydi — bazada faqat xeshi qoladi. Telefon yoʻqolganda
              kirishning yagona yoʻli shu.
            </p>

            <ul className="grid grid-cols-2 gap-1.5">
              {kodlar.map((k) => (
                <li
                  key={k}
                  className="num select-all rounded-lg bg-surface-muted px-2.5 py-2 text-center text-sm tracking-wider text-foreground"
                >
                  {k}
                </li>
              ))}
            </ul>

            <button type="button" onClick={nusxaOl} className={ghostBtn}>
              {nusxa ? "Nusxa olindi" : "Hammasini nusxalash"}
            </button>
            <button type="button" onClick={tugat} className={primaryBtn}>
              Saqladim, davom etish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Oʻchirish ───────────────────────────

function DisablePanel({ onDone }: { onDone: () => void }) {
  const [ochiq, setOchiq] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ochir() {
    setBusy(true);
    setError(null);
    try {
      await disableTwoFactor(password, code.trim());
      onDone();
    } catch (err) {
      setError(err instanceof SessionError ? err.message : "Oʻchirib boʻlmadi.");
    } finally {
      setBusy(false);
    }
  }

  if (!ochiq) {
    return (
      <button type="button" onClick={() => setOchiq(true)} className={ghostBtn}>
        Oʻchirish
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <p className="text-xs text-foreground-muted">
        Parol ham, kod ham soʻraladi: parolni bilgan yoki kodni koʻrgan odam
        yolgʻiz oʻchira olmasin.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Parol"
        autoComplete="current-password"
        className={inputClass}
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.slice(0, 16))}
        placeholder="Kod"
        inputMode="numeric"
        className={`${inputClass} num`}
      />
      <button
        type="button"
        onClick={ochir}
        disabled={busy || !password || code.length < 6}
        className={ghostBtn}
      >
        {busy ? "Oʻchirilmoqda…" : "Tasdiqlash"}
      </button>
    </div>
  );
}

// ─────────────────────── Ilovaga qoʻshish ───────────────────────

/**
 * Sekretni ilovaga qoʻshish yoʻllari.
 *
 * QR kod YOʻQ — uni chizish uchun kutubxona kerak (CLAUDE.md boʻyicha
 * yangi bogʻliqlik ruxsat bilan qoʻshiladi). Uning oʻrniga ikki yoʻl,
 * ikkalasi ham barcha ilovalarda ishlaydi:
 *
 *   · telefondan kirilsa — havola ilovani toʻgʻridan-toʻgʻri ochadi
 *   · kompyuterdan — sekret qoʻlda kiritiladi (har ilovada "enter key
 *     manually" tugmasi bor)
 */
function AddToApp({ secret, uri }: { secret: string; uri: string }) {
  const [nusxa, setNusxa] = useState(false);

  async function nusxaOl() {
    try {
      await navigator.clipboard.writeText(secret);
      setNusxa(true);
    } catch {
      setNusxa(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <a href={uri} className={primaryBtn}>
        Autentifikator ilovasida ochish
      </a>
      <p className="text-center text-xs text-foreground-muted">
        Telefondan kirgan boʻlsangiz — havola ilovani ochadi.
      </p>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-foreground">
          Kompyuterdan kiryapsizmi? Ilovada «Enter a setup key» ni tanlab, shu
          sekretni kiriting:
        </p>
        <p className="num mt-1.5 select-all break-all rounded-lg bg-surface-muted px-3 py-2 text-sm tracking-wider text-foreground">
          {secret}
        </p>
        <button type="button" onClick={nusxaOl} className={`${ghostBtn} mt-2`}>
          {nusxa ? "Nusxa olindi" : "Sekretni nusxalash"}
        </button>
      </div>
    </div>
  );
}
